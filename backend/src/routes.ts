import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { z } from "zod";
import bcrypt from "bcryptjs";
import Jimp from "jimp";
import { prisma } from "./prisma.js";
import { signToken, authRequired, requireRole } from "./auth.js";
import { getAvailableSlots } from "./availability.js";
import { notifQueue } from "./queue.js";
import { addMinutes } from "./time.js";

export const router = Router();

// Uploads (logo / fotos / QR)
const uploadsDir = path.resolve("uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
      const safe = (file.fieldname || "file") + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      cb(null, safe + ext);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
});

const ALLOWED_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".bmp"]);
function ensureAllowedImage(file: Express.Multer.File | undefined) {
  if (!file) return { ok: false as const, error: "Missing file" };
  const ext = path.extname(file.originalname || file.filename || "").toLowerCase();
  if (!ALLOWED_IMAGE_EXT.has(ext)) {
    try { fs.unlinkSync(file.path); } catch {}
    return { ok: false as const, error: "Invalid image format. Use JPG/JPEG, PNG or BMP." };
  }
  return { ok: true as const };
}


const IMAGE_MAX_DIM = 1920;
const JPG_QUALITY = 80;
const COVER_W = 1080;
const COVER_H = 1920;
const COVER_RATIO = COVER_W / COVER_H;

async function processAndReplaceOrgImage(orgId: string, file: Express.Multer.File) {
  const dir = getOrgUploadDir(orgId, "images");
  const stem = path.parse(file.filename).name;
  const fullFilename = `${stem}.jpg`;
  const coverFilename = `${stem}-cover.jpg`;
  const fullPath = path.join(dir, fullFilename);
  const coverPath = path.join(dir, coverFilename);

  const img = await Jimp.read(file.path);

  // ---- Full (optimized) ----
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const maxSide = Math.max(w, h);
  if (maxSide > IMAGE_MAX_DIM) {
    if (w >= h) img.resize(IMAGE_MAX_DIM, Jimp.AUTO);
    else img.resize(Jimp.AUTO, IMAGE_MAX_DIM);
  }
  img.quality(JPG_QUALITY);
  await img.writeAsync(fullPath);

  // ---- Cover (auto-crop center to 9:16 + resize) ----
  const cover = await Jimp.read(file.path);
  const cw = cover.bitmap.width;
  const ch = cover.bitmap.height;
  const curRatio = cw / ch;
  if (curRatio > COVER_RATIO) {
    const newW = Math.floor(ch * COVER_RATIO);
    const x = Math.floor((cw - newW) / 2);
    cover.crop(x, 0, newW, ch);
  } else if (curRatio < COVER_RATIO) {
    const newH = Math.floor(cw / COVER_RATIO);
    const y = Math.floor((ch - newH) / 2);
    cover.crop(0, y, cw, newH);
  }
  cover.resize(COVER_W, COVER_H).quality(JPG_QUALITY);
  await cover.writeAsync(coverPath);

  // Remove original upload
  try { fs.unlinkSync(file.path); } catch {}

  return {
    filename: fullFilename,
    url: `/uploads/org_${orgId}/images/${fullFilename}`,
    coverFilename,
    coverUrl: `/uploads/org_${orgId}/images/${coverFilename}`,
  };
}


function getOrgUploadDir(orgId: string, sub: string) {
  const dir = path.join(uploadsDir, `org_${orgId}`, sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const uploadOrgLogo = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const u = (req as any).user as { orgId: string } | undefined;
      const orgId = u?.orgId || "unknown";
      cb(null, getOrgUploadDir(orgId, "branding"));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
      const safe = "logo-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      cb(null, safe + ext);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
});

const uploadOrgImage = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const u = (req as any).user as { orgId: string } | undefined;
      const orgId = u?.orgId || "unknown";
      cb(null, getOrgUploadDir(orgId, "images"));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
      const safe = "img-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      cb(null, safe + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});



export type Role = "ADMIN" | "STAFF" | "CUSTOMER";

const AppointmentStatus = {
  RESERVED: "RESERVED",
  CONFIRMED: "CONFIRMED",
  IN_CHAIR: "IN_CHAIR",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  NO_SHOW: "NO_SHOW",
} as const;

type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

const MS_HOUR = 60 * 60 * 1000;

async function removeIfExists(jobId: string) {
  const job = await notifQueue.getJob(jobId);
  if (job) await job.remove();
}

async function scheduleReminderJobs(appointmentId: string, startAt: Date) {
  // Remove previous reminders (idempotente)
  await removeIfExists(`rem24-${appointmentId}`);
  await removeIfExists(`rem2-${appointmentId}`);

  const now = Date.now();
  const startMs = startAt.getTime();

  const delay24 = startMs - now - 24 * MS_HOUR;
  if (delay24 > 0) {
    await notifQueue.add(
      "appointment",
      { type: "reminder_24h", appointmentId },
      { jobId: `rem24-${appointmentId}`, delay: delay24 }
    );
  }

  const delay2 = startMs - now - 2 * MS_HOUR;
  if (delay2 > 0) {
    await notifQueue.add(
      "appointment",
      { type: "reminder_2h", appointmentId },
      { jobId: `rem2-${appointmentId}`, delay: delay2 }
    );
  }
}



router.get("/health", (_req, res) => res.json({ ok: true }));

// Auth
router.post("/auth/register", async (req, res) => {
  const schema = z.object({
    orgId: z.string().min(1),
    fullName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(6).optional(),
    password: z.string().min(6),
    whatsappOptIn: z.boolean().optional().default(false),
  });
  const body = schema.parse(req.body);


  const org = await prisma.organization.findUnique({ where: { id: body.orgId } });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) return res.status(409).json({ error: "Email already exists" });

  const passwordHash = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.create({
    data: {
      orgId: body.orgId,
      role: "CUSTOMER",
      email: body.email,
      phone: body.phone,
      passwordHash,
      customer: {
        create: {
          fullName: body.fullName,
          whatsappOptIn: body.whatsappOptIn,
          preferredChannel: "both",
        },
      },
    },
    include: { customer: true },
  });

  const token = signToken({ sub: user.id, orgId: user.orgId, role: user.role, email: user.email });
  res.json({ token, user: { id: user.id, role: user.role, email: user.email, orgId: user.orgId, fullName: user.customer?.fullName } });
});

router.post("/auth/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const body = schema.parse(req.body);


  const user = await prisma.user.findUnique({ where: { email: body.email }, include: { customer: true, staff: true } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ sub: user.id, orgId: user.orgId, role: user.role, email: user.email });
  res.json({
    token,
    user: {
      id: user.id,
      role: user.role,
      email: user.email,
      orgId: user.orgId,
      fullName: user.customer?.fullName ?? user.staff?.displayName ?? user.email,
    },
  });
});

// Auth: who am I?
router.get("/auth/me", authRequired, async (req, res) => {
  const u = (req as any).user as { sub: string; orgId: string; role: Role; email: string };
  const dbUser = await prisma.user.findUnique({
    where: { id: u.sub },
    include: { customer: true, staff: true },
  });
  res.json({ user: { ...u, fullName: dbUser?.customer?.fullName, staffName: dbUser?.staff?.displayName } });
});


// Public-ish
router.get("/org/:orgId/branches", async (req, res) => {
  const orgId = z.string().parse(req.params.orgId);
  const branches = await prisma.branch.findMany({ where: { orgId }, orderBy: { name: "asc" } });
  res.json({ branches });
});

router.get("/branches/:branchId/services", async (req, res) => {
  const branchId = z.string().parse(req.params.branchId);
  const items = await prisma.branchService.findMany({
    where: { branchId, enabled: true },
    include: { service: true },
    orderBy: { service: { name: "asc" } },
  });
  res.json({
    services: items.map(i => ({
      id: i.service.id,
      name: i.service.name,
      durationMin: i.service.durationMin,
      price: i.priceOverride ?? i.service.basePrice,
    })),
  });
});

// Public: staff (barberos) por sucursal, opcional filtrar por servicio
router.get("/branches/:branchId/staff", async (req, res) => {
  const schema = z.object({
    branchId: z.string().min(1),
  });
  const { branchId } = schema.parse(req.params);
  const q = z.object({ serviceId: z.string().optional() }).parse(req.query);

  const staff = await prisma.staffProfile.findMany({
    where: {
      branchId,
      ...(q.serviceId ? { services: { some: { serviceId: q.serviceId } } } : {}),
    },
    orderBy: { displayName: "asc" },
  });

  res.json({
    staff: staff.map(s => ({
      id: s.id,
      name: s.displayName,
      photoUrl: s.photoUrl,
      commissionPct: s.commissionPct,
    })),
  });
});


router.get("/availability", async (req, res) => {
  const schema = z.object({
    branchId: z.string().min(1),
    serviceId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    staffId: z.string().optional(),
  });
  const q = schema.parse(req.query);

  try {
    const result = await getAvailableSlots({ branchId: q.branchId, serviceId: q.serviceId, dateISO: q.date, staffId: q.staffId });
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Bad request" });
  }
});

// Customer actions
router.post("/appointments", authRequired, requireRole("CUSTOMER"), async (req, res) => {
  const user = (req as any).user as { sub: string; orgId: string; role: Role };
  const schema = z.object({
    branchId: z.string().min(1),
    serviceId: z.string().min(1),
    staffId: z.string().optional(),
    startAt: z.string().datetime(),
    notes: z.string().optional(),
  });
  const body = schema.parse(req.body);


  const customer = await prisma.customerProfile.findUnique({ where: { userId: user.sub } });
  if (!customer) return res.status(400).json({ error: "Customer profile missing" });

  const service = await prisma.service.findUnique({ where: { id: body.serviceId } });
  if (!service) return res.status(404).json({ error: "Service not found" });

  // Price: basePrice or override per branch
  const branchService = await prisma.branchService.findUnique({ where: { branchId_serviceId: { branchId: body.branchId, serviceId: body.serviceId } } });
  if (!branchService || branchService.enabled === false) return res.status(400).json({ error: "Service not enabled in this branch" });
  const price = (branchService.priceOverride ?? service.basePrice) || 0;

  const start = new Date(body.startAt);
  const end = addMinutes(start, service.durationMin);

  // if no staffId provided, choose any available staff at that time
  let staffId = body.staffId;
  if (!staffId) {
    const slots = await getAvailableSlots({
      branchId: body.branchId,
      serviceId: body.serviceId,
      dateISO: body.startAt.slice(0, 10),
    });
    // find if startAt exists
    const ok = slots.slots.find(s => s.startAt === start.toISOString());
    if (!ok) return res.status(409).json({ error: "Time not available" });

    // pick first staff who is free at that time
    const staffCandidates = await prisma.staffProfile.findMany({
      where: { branchId: body.branchId, services: { some: { serviceId: body.serviceId } } },
      orderBy: { displayName: "asc" },
    });
    for (const s of staffCandidates) {
      const spec = await getAvailableSlots({
        branchId: body.branchId,
        serviceId: body.serviceId,
        dateISO: body.startAt.slice(0, 10),
        staffId: s.id,
      });
      const ok2 = spec.slots.find(t => t.startAt === start.toISOString());
      if (ok2) { staffId = s.id; break; }
    }
    if (!staffId) return res.status(409).json({ error: "No staff available" });
  } else {
    // verify staff is free
    const spec = await getAvailableSlots({
      branchId: body.branchId,
      serviceId: body.serviceId,
      dateISO: body.startAt.slice(0, 10),
      staffId,
    });
    const ok = spec.slots.find(s => s.startAt === start.toISOString());
    if (!ok) return res.status(409).json({ error: "Time not available for that staff" });
  }

  const appt = await prisma.appointment.create({
    data: {
      orgId: user.orgId,
      branchId: body.branchId,
      serviceId: body.serviceId,
      staffId,
      customerId: customer.id,
      startAt: start,
      endAt: end,
      status: AppointmentStatus.RESERVED,
      price,
      notes: body.notes,
    },
  });

  await notifQueue.add("appointment", { type: "created", appointmentId: appt.id });
  await scheduleReminderJobs(appt.id, start);

  res.json({ appointment: appt });
});

router.patch("/appointments/:id", authRequired, requireRole("CUSTOMER","ADMIN","STAFF"), async (req, res) => {
  const id = z.string().parse(req.params.id);
  const schema = z.object({
    status: z.nativeEnum(AppointmentStatus).optional(),
    startAt: z.string().datetime().optional(),
  });
  const body = schema.parse(req.body);


  const appt = await prisma.appointment.findUnique({ where: { id }, include: { service: true } });
  if (!appt) return res.status(404).json({ error: "Appointment not found" });

  let data: any = {};
  if (body.status) data.status = body.status;

  if (body.startAt) {
    const start = new Date(body.startAt);
    const end = addMinutes(start, appt.service.durationMin);
    // verify availability for same staff
    const spec = await getAvailableSlots({
      branchId: appt.branchId,
      serviceId: appt.serviceId,
      dateISO: body.startAt.slice(0, 10),
      staffId: appt.staffId,
    });
    const ok = spec.slots.find(s => s.startAt === start.toISOString());
    if (!ok) return res.status(409).json({ error: "Time not available" });
    data.startAt = start;
    data.endAt = end;
  }

  const updated = await prisma.appointment.update({ where: { id }, data });

// Si se canceló, elimina recordatorios pendientes
if (body.status === AppointmentStatus.CANCELED) {
  await removeIfExists(`rem24-${updated.id}`);
  await removeIfExists(`rem2-${updated.id}`);
}

// Si se reprogramó (startAt), reprograma recordatorios
if (body.startAt) {
  await scheduleReminderJobs(updated.id, updated.startAt);
}

  const type = body.status === AppointmentStatus.CANCELED ? "canceled" : "updated";
  await notifQueue.add("appointment", { type, appointmentId: updated.id });

  res.json({ appointment: updated });
});

// Admin: list appointments by branch/date
router.get("/admin/appointments", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const schema = z.object({
    branchId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
  const q = schema.parse(req.query);

  const dayStart = new Date(q.date + "T00:00:00");
  const dayEnd = new Date(q.date + "T23:59:59.999");

  const appts = await prisma.appointment.findMany({
    where: { branchId: q.branchId, startAt: { gte: dayStart, lte: dayEnd } },
    include: {
      service: true,
      staff: true,
      customer: { include: { user: true } },
      payment: { include: { voidedBy: true } },
    },
    orderBy: { startAt: "asc" },
  });

  res.json({
    appointments: appts.map(a => ({
      id: a.id,
      startAt: a.startAt,
      endAt: a.endAt,
      status: a.status,
      price: a.price,
      service: { id: a.service.id, name: a.service.name, basePrice: a.service.basePrice, durationMin: a.service.durationMin },
      staff: { id: a.staff.id, displayName: a.staff.displayName, commissionPct: a.staff.commissionPct },
      customer: { id: a.customer.id, fullName: a.customer.fullName, email: a.customer.user.email, phone: a.customer.user.phone },
      payment: a.payment ? {
        id: a.payment.id,
        status: a.payment.status,
        method: a.payment.method,
        amountTotal: a.payment.amountTotal,
        amountCash: a.payment.amountCash,
        amountQr: a.payment.amountQr,
        paidAt: a.payment.paidAt,
        voidedAt: (a.payment as any).voidedAt ?? null,
        voidReason: (a.payment as any).voidReason ?? null,
        voidedBy: (a.payment as any).voidedBy ? { id: (a.payment as any).voidedBy.id, email: (a.payment as any).voidedBy.email } : null,
      } : null,
    })),
  });
});



// -------------------------
// Admin: Configuración Org (logo, WhatsApp, pagos QR, fidelización)
// -------------------------

router.get("/admin/org/settings", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const org = await prisma.organization.findUnique({ where: { id: u.orgId } });
  if (!org) return res.status(404).json({ error: "Organization not found" });
  res.json({ org: { id: org.id, name: org.name, logoUrl: org.logoUrl, settings: org.settings } });
});

router.put("/admin/org/settings", authRequired, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const schema = z.object({
  whatsappDisplayNumber: z.string().optional(),
  loyalty: z.any().optional(),
  payments: z.any().optional(),
  cashPin: z.string().optional(),

  // Datos de empresa + formato impresión/ticket
  company: z.any().optional(),
  print: z.any().optional(),
  branding: z.any().optional(),
}).partial();
  const body = schema.parse(req.body);


  const org = await prisma.organization.findUnique({ where: { id: u.orgId } });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const merged = { ...(org.settings as any), ...body };
  const updated = await prisma.organization.update({
    where: { id: u.orgId },
    data: { settings: merged },
  });
  res.json({ org: { id: updated.id, name: updated.name, logoUrl: updated.logoUrl, settings: updated.settings } });
});

router.post("/admin/org/logo", authRequired, requireRole("ADMIN"), uploadOrgLogo.single("logo"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  if (!req.file) return res.status(400).json({ error: "Missing file" });
  const chk = ensureAllowedImage(req.file);
  if (!chk.ok) return res.status(400).json({ error: chk.error });
  const fileUrl = `/uploads/org_${u.orgId}/branding/${req.file.filename}`;
  const updated = await prisma.organization.update({ where: { id: u.orgId }, data: { logoUrl: fileUrl } });
  res.json({ logoUrl: updated.logoUrl });
});

router.get("/admin/org/images", authRequired, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const dir = getOrgUploadDir(u.orgId, "images");
  const files = fs.readdirSync(dir)
    .filter(f => ALLOWED_IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .filter(f => !f.toLowerCase().endsWith("-cover.jpg"));
  const images = files.map((f) => {
    const stem = path.parse(f).name;
    return {
      filename: f,
      url: `/uploads/org_${u.orgId}/images/${f}`,
      coverUrl: `/uploads/org_${u.orgId}/images/${stem}-cover.jpg`,
    };
  });
  const org = await prisma.organization.findUnique({ where: { id: u.orgId } });
  const settings = (org?.settings as any) || {};
  const branding = settings.branding || {};
  res.json({ images, coverUrl: branding.coverUrl || null, displayMode: branding.displayMode || "both" });
});

router.post("/admin/org/images", authRequired, requireRole("ADMIN"), uploadOrgImage.single("image"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const chk = ensureAllowedImage(req.file);
  if (!chk.ok) return res.status(400).json({ error: chk.error });

  const processed = await processAndReplaceOrgImage(u.orgId, req.file!);
  res.json({ ...processed });
});

router.delete("/admin/org/images/:filename", authRequired, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const filename = req.params.filename;
  const dir = getOrgUploadDir(u.orgId, "images");
  const target = path.join(dir, filename);
  if (fs.existsSync(target)) fs.unlinkSync(target);
  // delete cover variant too
  const stem = path.parse(filename).name;
  const coverFile = path.join(dir, `${stem}-cover.jpg`);
  if (fs.existsSync(coverFile)) fs.unlinkSync(coverFile);

  const org = await prisma.organization.findUnique({ where: { id: u.orgId } });
  if (org) {
    const settings = (org.settings as any) || {};
    const branding = settings.branding || {};
    const coverUrl = branding.coverUrl as string | undefined;
    const maybeUrl = `/uploads/org_${u.orgId}/images/${filename}`;
    const maybeCover = `/uploads/org_${u.orgId}/images/${path.parse(filename).name}-cover.jpg`;
    if (coverUrl === maybeUrl || coverUrl === maybeCover) {
      branding.coverUrl = null;
      settings.branding = branding;
      await prisma.organization.update({ where: { id: u.orgId }, data: { settings } });
    }
  }
  res.json({ ok: true });
});

router.post("/admin/org/cover", authRequired, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const schema = z.object({
    coverUrl: z.string().nullable(),
    displayMode: z.enum(["logo","name","both","none"]).optional(),
  });
  const body = schema.parse(req.body);

  let coverUrl = body.coverUrl;
  if (coverUrl && coverUrl.includes(`/uploads/org_${u.orgId}/images/`)) {
    const filename = coverUrl.split("/").pop() || "";
    const stem = path.parse(filename).name;
    coverUrl = `/uploads/org_${u.orgId}/images/${stem}-cover.jpg`;
  }

  const org = await prisma.organization.findUnique({ where: { id: u.orgId } });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const settings = (org.settings as any) || {};
  const branding = settings.branding || {};
  branding.coverUrl = coverUrl;
  if (body.displayMode) branding.displayMode = body.displayMode;
  settings.branding = branding;

  const updated = await prisma.organization.update({ where: { id: u.orgId }, data: { settings } });
  res.json({ org: { id: updated.id, name: updated.name, logoUrl: updated.logoUrl, settings: updated.settings } });
});

router.get("/org/:orgId/public", async (req, res) => {
  const orgId = req.params.orgId;
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return res.status(404).json({ error: "Organization not found" });
  const settings = (org.settings as any) || {};
  const branding = settings.branding || {};
  const company = settings.company || {};
  res.json({
    org: {
      id: org.id,
      name: org.name,
      logoUrl: org.logoUrl,
      company,
      branding: {
        coverUrl: branding.coverUrl || null,
        displayMode: branding.displayMode || "both",
        footerText: (settings.print || {}).footerText || "",
      },
    },
  });
});

// -------------------------
// Admin: Sucursales
// -------------------------
router.get("/admin/branches", authRequired, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const branches = await prisma.branch.findMany({ where: { orgId: u.orgId }, orderBy: { createdAt: "asc" } });
  res.json({ branches });
});

router.post("/admin/branches", authRequired, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const schema = z.object({
    name: z.string().min(2),
    address: z.string().optional(),
    timezone: z.string().optional(),
  });
  const body = schema.parse(req.body);

  const branch = await prisma.branch.create({ data: { orgId: u.orgId, name: body.name, address: body.address, timezone: body.timezone || "America/La_Paz" } });
  res.json({ branch });
});

router.put("/admin/branches/:id", authRequired, requireRole("ADMIN"), async (req, res) => {
  const schema = z.object({ id: z.string().min(1) });
  const { id } = schema.parse(req.params);
  const body = z.object({ name: z.string().min(2).optional(), address: z.string().optional(), timezone: z.string().optional() }).parse(req.body);
  const branch = await prisma.branch.update({ where: { id }, data: body });
  res.json({ branch });
});

router.delete("/admin/branches/:id", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const counts = await Promise.all([
    prisma.staffProfile.count({ where: { branchId: id } }),
    prisma.appointment.count({ where: { branchId: id } }),
    prisma.payment.count({ where: { branchId: id } }).catch(() => 0 as any),
    prisma.cashSession.count({ where: { branchId: id } }).catch(() => 0 as any),
    prisma.queueTicket.count({ where: { branchId: id } }).catch(() => 0 as any),
  ]);

  const [staffCount, apptCount, payCount, cashCount, queueCount] = counts.map(Number);

  if (staffCount || apptCount || payCount || cashCount || queueCount) {
    return res.status(409).json({
      error: "No se puede eliminar: la sucursal tiene datos asociados",
      details: { staffCount, apptCount, payCount, cashCount, queueCount },
    });
  }

  await prisma.branch.delete({ where: { id } });
  res.json({ ok: true });
});

// -------------------------
// Admin: Servicios (org-level) y activación por sucursal
// -------------------------
router.get("/admin/services", authRequired, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const services = await prisma.service.findMany({ where: { orgId: u.orgId }, orderBy: { name: "asc" } });
  res.json({ services });
});

router.post("/admin/services", authRequired, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const schema = z.object({
    name: z.string().min(2),
    durationMin: z.coerce.number().int().min(5),
    basePrice: z.coerce.number().int().min(0),
  });
  const body = schema.parse(req.body);

  const service = await prisma.service.create({ data: { orgId: u.orgId, name: body.name, durationMin: body.durationMin, basePrice: body.basePrice } });
  res.json({ service });
});

router.put("/admin/services/:id", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const body = z.object({
    name: z.string().min(2).optional(),
    durationMin: z.coerce.number().int().min(5).optional(),
    basePrice: z.coerce.number().int().min(0).optional(),
  }).parse(req.body);
  const service = await prisma.service.update({ where: { id }, data: body });
  res.json({ service });
});
router.delete("/admin/services/:id", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const counts = await Promise.all([
    prisma.appointment.count({ where: { serviceId: id } }),
    prisma.payment.count({ where: { serviceId: id } }).catch(() => 0 as any),
    prisma.queueTicket.count({ where: { serviceId: id } }).catch(() => 0 as any),
  ]);

  const [apptCount, payCount, queueCount] = counts.map(Number);

  if (apptCount || payCount || queueCount) {
    return res.status(409).json({
      error: "No se puede eliminar: el servicio tiene datos asociados",
      details: { apptCount, payCount, queueCount },
    });
  }

  await prisma.service.delete({ where: { id } });
  res.json({ ok: true });
});


router.get("/admin/branches/:branchId/services", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { branchId } = z.object({ branchId: z.string().min(1) }).parse(req.params);
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return res.status(404).json({ error: "Branch not found" });

  const services = await prisma.service.findMany({ where: { orgId: branch.orgId }, orderBy: { name: "asc" } });
  const bs = await prisma.branchService.findMany({ where: { branchId } });
  const map = new Map<string, (typeof bs)[number]>(bs.map(x => [x.serviceId, x]));
  res.json({
    services: services.map(s => ({
      id: s.id,
      name: s.name,
      durationMin: s.durationMin,
      basePrice: s.basePrice,
      enabled: map.get(s.id)?.enabled ?? false,
      priceOverride: map.get(s.id)?.priceOverride ?? null,
    })),
  });
});

router.put("/admin/branches/:branchId/services/:serviceId", authRequired, requireRole("ADMIN"), async (req, res) => {
  const params = z.object({ branchId: z.string().min(1), serviceId: z.string().min(1) }).parse(req.params);
  const body = z.object({
    enabled: z.boolean().optional(),
    priceOverride: z.coerce.number().int().min(0).nullable().optional(),
  }).parse(req.body);

  const row = await prisma.branchService.upsert({
    where: { branchId_serviceId: { branchId: params.branchId, serviceId: params.serviceId } },
    update: { enabled: body.enabled ?? true, priceOverride: body.priceOverride },
    create: { branchId: params.branchId, serviceId: params.serviceId, enabled: body.enabled ?? true, priceOverride: body.priceOverride },
  });
  res.json({ branchService: row });
});

// -------------------------
// Admin: Barberos (staff) + foto + servicios asignados
// -------------------------
router.get("/admin/staff", authRequired, requireRole("ADMIN"), async (req, res) => {
  const q = z.object({ branchId: z.string().optional() }).parse(req.query);
  const u = (req as any).user as { orgId: string };
  const staff = await prisma.staffProfile.findMany({
    where: { branch: { orgId: u.orgId }, ...(q.branchId ? { branchId: q.branchId } : {}) },
    include: { user: true, services: true },
    orderBy: { displayName: "asc" },
  });
  res.json({
    staff: staff.map(s => ({
      id: s.id,
      displayName: s.displayName,
      photoUrl: s.photoUrl,
      commissionPct: s.commissionPct,
      branchId: s.branchId,
      email: s.user.email,
      phone: s.user.phone,
      serviceIds: s.services.map(x => x.serviceId),
    })),
  });
});

router.post("/admin/staff", authRequired, requireRole("ADMIN"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const schema = z.object({
    branchId: z.string().min(1),
    displayName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    password: z.string().min(6),
    commissionPct: z.coerce.number().int().min(0).max(100).default(50),
    serviceIds: z.array(z.string()).default([]),
  });
  const body = schema.parse(req.body);


  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: { orgId: u.orgId, role: "STAFF", email: body.email, phone: body.phone, passwordHash },
  });

  const staff = await prisma.staffProfile.create({
    data: {
      userId: user.id,
      branchId: body.branchId,
      displayName: body.displayName,
      commissionPct: body.commissionPct,
      services: { create: body.serviceIds.map(sid => ({ serviceId: sid })) },
    },
  });

  res.json({ staff });
});

router.put("/admin/staff/:id", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const schema = z.object({
  branchId: z.string().min(1).optional(),
  displayName: z.string().min(2).optional(),
  commissionPct: z.coerce.number().int().min(0).max(100).optional(),
  serviceIds: z.array(z.string()).optional(),

  // user fields (optional)
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
});
const body = schema.parse(req.body);

const existing = await prisma.staffProfile.findUnique({ where: { id }, include: { user: true } });
if (!existing) return res.status(404).json({ error: "Staff not found" });

const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : undefined;

const staff = await prisma.$transaction(async (tx) => {
  // update staff profile
  const st = await tx.staffProfile.update({
    where: { id },
    data: {
      branchId: body.branchId,
      displayName: body.displayName,
      commissionPct: body.commissionPct,
    },
  });

  // update linked user (email/phone/password)
  if (body.email || body.phone || passwordHash) {
    await tx.user.update({
      where: { id: existing.userId },
      data: {
        email: body.email,
        phone: body.phone,
        passwordHash: passwordHash,
      },
    });
  }

  if (body.serviceIds) {
    await tx.staffService.deleteMany({ where: { staffId: id } });
    if (body.serviceIds.length) {
      await tx.staffService.createMany({ data: body.serviceIds.map((sid) => ({ staffId: id, serviceId: sid })) });
    }
  }

  return st;
});

res.json({ staff });
});

router.post("/admin/staff/:id/photo", authRequired, requireRole("ADMIN"), uploadOrgLogo.single("photo"), async (req, res) => {
  const u = (req as any).user as { orgId: string };
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  if (!req.file) return res.status(400).json({ error: "Missing file" });
  const chk = ensureAllowedImage(req.file);
  if (!chk.ok) return res.status(400).json({ error: chk.error });
  const fileUrl = `/uploads/org_${u.orgId}/branding/${req.file.filename}`;
  const staff = await prisma.staffProfile.update({ where: { id }, data: { photoUrl: fileUrl } });
  res.json({ photoUrl: staff.photoUrl });
});
router.delete("/admin/staff/:id", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

  const counts = await Promise.all([
    prisma.appointment.count({ where: { staffId: id } }),
    prisma.payment.count({ where: { staffId: id } }).catch(() => 0 as any),
    prisma.queueTicket.count({ where: { staffId: id } }).catch(() => 0 as any),
  ]);
  const [apptCount, payCount, queueCount] = counts.map(Number);

  if (apptCount || payCount || queueCount) {
    return res.status(409).json({
      error: "No se puede eliminar: el barbero tiene datos asociados",
      details: { apptCount, payCount, queueCount },
    });
  }

  const staff = await prisma.staffProfile.findUnique({ where: { id } });
  if (!staff) return res.status(404).json({ error: "Staff not found" });

  await prisma.$transaction(async (tx) => {
    await tx.staffAvailability.deleteMany({ where: { staffId: id } });
    await tx.staffService.deleteMany({ where: { staffId: id } });
    await tx.staffProfile.delete({ where: { id } });
    await tx.user.delete({ where: { id: staff.userId } });
  });

  res.json({ ok: true });
});


// -------------------------
// Admin: Horarios por barbero (disponibilidad semanal)
// -------------------------
router.get("/admin/staff/:id/availability", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const av = await prisma.staffAvailability.findMany({ where: { staffId: id }, orderBy: { weekday: "asc" } });
  res.json({ availability: av });
});

router.put("/admin/staff/:id/availability", authRequired, requireRole("ADMIN"), async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const schema = z.object({
    days: z.array(z.object({
      weekday: z.coerce.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      breaks: z.array(z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })).default([]),
    })),
  });
  const body = schema.parse(req.body);


  for (const d of body.days) {
    await prisma.staffAvailability.upsert({
      where: { staffId_weekday: { staffId: id, weekday: d.weekday } },
      update: { startTime: d.startTime, endTime: d.endTime, breaks: d.breaks },
      create: { staffId: id, weekday: d.weekday, startTime: d.startTime, endTime: d.endTime, breaks: d.breaks },
    });
  }
  res.json({ ok: true });
});

// -------------------------
// Admin: Caja (apertura/cierre) + pagos + comisiones + fidelización
// -------------------------
router.post("/admin/cash/open", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const u = (req as any).user as { orgId: string; sub: string };
  const schema = z.object({ branchId: z.string().min(1), openingCash: z.coerce.number().int().min(0).default(0) });
  const body = schema.parse(req.body);


  const existing = await prisma.cashSession.findFirst({ where: { branchId: body.branchId, status: "OPEN" } });
  if (existing) return res.json({ session: existing, alreadyOpen: true });

  const session = await prisma.cashSession.create({
    data: { orgId: u.orgId, branchId: body.branchId, openedByUserId: u.sub, openingCash: body.openingCash, status: "OPEN" },
  });
  res.json({ session });
});

router.get("/admin/cash/current", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const q = z.object({ branchId: z.string().min(1) }).parse(req.query);
  const session = await prisma.cashSession.findFirst({ where: { branchId: q.branchId, status: "OPEN" }, include: { movements: true, payments: true } });
  if (!session) return res.json({ session: null });

  const movIn = session.movements.filter(m => m.type === "IN").reduce((s,m)=>s+m.amount,0);
  const movOut = session.movements.filter(m => m.type === "OUT").reduce((s,m)=>s+m.amount,0);
  const cashFromPayments = session.payments.filter(p=>p.status === "PAID").reduce((s,p)=>s+p.amountCash,0);
  const expectedCash = session.openingCash + movIn - movOut + cashFromPayments;

  res.json({ session, totals: { movIn, movOut, cashFromPayments, expectedCash } });
});

router.post("/admin/cash/close", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const u = (req as any).user as { sub: string };
  const schema = z.object({ branchId: z.string().min(1), closingCashCounted: z.coerce.number().int().min(0), notes: z.string().optional() });
  const body = schema.parse(req.body);


  const session = await prisma.cashSession.findFirst({ where: { branchId: body.branchId, status: "OPEN" }, include: { movements: true, payments: true } });
  if (!session) return res.status(404).json({ error: "No open cash session" });

  const movIn = session.movements.filter(m => m.type === "IN").reduce((s,m)=>s+m.amount,0);
  const movOut = session.movements.filter(m => m.type === "OUT").reduce((s,m)=>s+m.amount,0);
  const cashFromPayments = session.payments.filter(p=>p.status === "PAID").reduce((s,p)=>s+p.amountCash,0);
  const expectedCash = session.openingCash + movIn - movOut + cashFromPayments;

  const updated = await prisma.cashSession.update({
    where: { id: session.id },
    data: { status: "CLOSED", closedAt: new Date(), closedByUserId: u.sub, closingCashCounted: body.closingCashCounted, notes: body.notes },
  });

  res.json({ session: updated, summary: { movIn, movOut, cashFromPayments, expectedCash, counted: body.closingCashCounted, diff: body.closingCashCounted - expectedCash } });
});


router.post("/admin/cash/movements", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const u = (req as any).user as { orgId: string; sub: string };
  const body = z.object({
    branchId: z.string().min(1),
    type: z.enum(["IN","OUT"]),
    amount: z.coerce.number().int().min(1),
    reason: z.string().min(1),
  }).parse(req.body);

  let session = await prisma.cashSession.findFirst({ where: { branchId: body.branchId, status: "OPEN" } });
  if (!session) {
    session = await prisma.cashSession.create({ data: { orgId: u.orgId, branchId: body.branchId, openedByUserId: u.sub, openingCash: 0, status: "OPEN" } });
  }

  const mov = await prisma.cashMovement.create({ data: { sessionId: session.id, type: body.type, amount: body.amount, reason: body.reason } });
  res.json({ sessionId: session.id, movement: mov });
});

router.get("/admin/cash/sessions", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const q = z.object({
    branchId: z.string().min(1),
    from: z.string().optional(),
    to: z.string().optional(),
  }).parse(req.query);

  const where: any = { branchId: q.branchId };
  if (q.from) where.openedAt = { ...(where.openedAt || {}), gte: new Date(q.from + "T00:00:00") };
  if (q.to) where.openedAt = { ...(where.openedAt || {}), lte: new Date(q.to + "T23:59:59.999") };

  const sessions = await prisma.cashSession.findMany({
    where,
    include: { movements: true, payments: true, branch: true },
    orderBy: { openedAt: "desc" },
    take: 200,
  });

  const result = sessions.map(s => {
    const movIn = s.movements.filter(m => m.type === "IN").reduce((a,m)=>a+m.amount,0);
    const movOut = s.movements.filter(m => m.type === "OUT").reduce((a,m)=>a+m.amount,0);
    const paidPayments = s.payments.filter(p => p.status === "PAID");
    const cashFromPayments = paidPayments.reduce((a,p)=>a+p.amountCash,0);
    const qrFromPayments = paidPayments.reduce((a,p)=>a+p.amountQr,0);
    const totalSales = paidPayments.reduce((a,p)=>a+p.amountTotal,0);
    const expectedCash = s.openingCash + movIn - movOut + cashFromPayments;
    const counted = s.closingCashCounted ?? null;
    const diff = counted !== null ? counted - expectedCash : null;
    return {
      id: s.id,
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      openingCash: s.openingCash,
      closingCashCounted: s.closingCashCounted,
      branch: { id: s.branch.id, name: s.branch.name },
      summary: { movIn, movOut, cashFromPayments, qrFromPayments, totalSales, expectedCash, counted, diff },
    };
  });

  res.json({ sessions: result });
});

router.get("/admin/cash/sessions/:id/report", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
  const session = await prisma.cashSession.findUnique({
    where: { id },
    include: {
      movements: true,
      org: true,
      branch: true,
      payments: {
        include: {
          service: true,
          staff: true,
        },
        orderBy: { paidAt: "asc" },
      },
    },
  });
  if (!session) return res.status(404).json({ error: "Session not found" });

  const movIn = session.movements.filter(m => m.type === "IN").reduce((a,m)=>a+m.amount,0);
  const movOut = session.movements.filter(m => m.type === "OUT").reduce((a,m)=>a+m.amount,0);
  const paidPayments = session.payments.filter(p => p.status === "PAID");
  const cashFromPayments = paidPayments.reduce((a,p)=>a+p.amountCash,0);
  const qrFromPayments = paidPayments.reduce((a,p)=>a+p.amountQr,0);
  const totalSales = paidPayments.reduce((a,p)=>a+p.amountTotal,0);
  const expectedCash = session.openingCash + movIn - movOut + cashFromPayments;
  const counted = session.closingCashCounted ?? null;
  const diff = counted !== null ? counted - expectedCash : null;

  res.json({
    session: {
      id: session.id,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openingCash: session.openingCash,
      closingCashCounted: session.closingCashCounted,
      branch: { id: session.branch.id, name: session.branch.name, address: session.branch.address, timezone: session.branch.timezone },
      org: { id: session.org.id, name: session.org.name, logoUrl: session.org.logoUrl, settings: session.org.settings },
    },
    summary: { openingCash: session.openingCash, movIn, movOut, cashFromPayments, qrFromPayments, totalSales, expectedCash, counted, diff },
    payments: session.payments.map(p => ({
      id: p.id,
      status: p.status,
      method: p.method,
      amountTotal: p.amountTotal,
      amountCash: p.amountCash,
      amountQr: p.amountQr,
      paidAt: p.paidAt,
      service: p.service.name,
      staff: p.staff.displayName,
    })),
  });
});

router.get("/admin/commissions", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const q = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    branchId: z.string().optional(),
    staffId: z.string().optional(),
  }).parse(req.query);

  const from = new Date(q.from + "T00:00:00");
  const to = new Date(q.to + "T23:59:59.999");

  // Sum commissions from CommissionRecord (includes negative reversals)
  const records = await prisma.commissionRecord.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      ...(q.staffId ? { staffId: q.staffId } : {}),
      ...(q.branchId ? { payment: { branchId: q.branchId } } : {}),
    },
    include: {
      staff: true,
      payment: { include: { voidedBy: true } },
    },
  });

  const map = new Map<string, any>();
  for (const r of records) {
    const sid = r.staffId;
    const row = map.get(sid) ?? { staffId: sid, staffName: r.staff.displayName, count: 0, amount: 0 };
    if (r.amount > 0) row.count += 1; // count only positive commission events
    row.amount += r.amount;
    map.set(sid, row);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  const totals = { amount: rows.reduce((a, r) => a + r.amount, 0) };

  res.json({ rows, totals });
});


router.post("/admin/payments/:id/void", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const u = (req as any).user as { orgId: string; sub: string };
  const params = z.object({ id: z.string().min(1) }).parse(req.params);
  const body = z.object({ pin: z.string().min(1), reason: z.string().min(3).max(200) }).parse(req.body);

  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: { appointment: true, staff: true, customer: true, org: true, commissions: true, voidedBy: true },
  });
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  const settings: any = (payment.org.settings as any) ?? {};
  const expectedPin = String(settings.cashPin ?? "1234");
  if (String(body.pin) !== expectedPin) return res.status(403).json({ error: "Invalid PIN" });

  if (payment.status === "VOID") return res.status(409).json({ error: "Payment already void" });

  const pointsPerBs = Number((settings.loyalty?.pointsPerBs ?? 0));
  const pointsToRevert = settings.loyalty?.enabled ? Math.floor(payment.amountTotal * pointsPerBs) : 0;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: "VOID", voidedAt: new Date(), voidedByUserId: u.sub, voidReason: body.reason } });

    // commission reversal (negative record)
    const origCommission = payment.commissions.reduce((a,c)=>a+c.amount,0);
    if (origCommission !== 0) {
      await tx.commissionRecord.create({
        data: { paymentId: payment.id, staffId: payment.staffId, pct: payment.staff.commissionPct ?? 0, amount: -origCommission },
      });
    }

    if (pointsToRevert > 0) {
      const cust = await tx.customerProfile.findUnique({ where: { id: payment.customerId } });
      const current = cust?.loyaltyPoints ?? 0;
      const next = Math.max(0, current - pointsToRevert);
      await tx.customerProfile.update({ where: { id: payment.customerId }, data: { loyaltyPoints: next } });
    }

    await tx.appointment.update({ where: { id: payment.appointmentId }, data: { status: "CONFIRMED" } });

    return { payment: updated, pointsReverted: pointsToRevert, commissionReverted: origCommission };
  });

  res.json(result);
});


router.post("/admin/payments", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const schema = z.object({
    appointmentId: z.string().min(1),
    method: z.enum(["QR","CASH","MIXED"]),
    amountTotal: z.coerce.number().int().min(1),
    amountCash: z.coerce.number().int().min(0).optional(),
    amountQr: z.coerce.number().int().min(0).optional(),
    qrReference: z.string().optional(),
  });
  const body = schema.parse(req.body);


  const appt = await prisma.appointment.findUnique({
    where: { id: body.appointmentId },
    include: { service: true, staff: true, customer: true, branch: true },
  });
  if (!appt) return res.status(404).json({ error: "Appointment not found" });

  // Idempotencia: 1 pago por cita (para MIXED, usar amountCash + amountQr en el mismo pago)
  const existing = await prisma.payment.findUnique({ where: { appointmentId: appt.id } });
  if (existing) {
    return res.status(409).json({ error: "Payment already registered for this appointment", payment: existing });
  }

  // Normalize amounts by method
  let cash = body.amountCash ?? 0;
  let qr = body.amountQr ?? 0;
  if (body.method === "CASH") {
    cash = body.amountTotal;
    qr = 0;
  } else if (body.method === "QR") {
    qr = body.amountTotal;
    cash = 0;
  } else {
    // MIXED
    const sum = cash + qr;
    if (sum !== body.amountTotal) {
      return res.status(400).json({ error: "MIXED payment must satisfy amountCash + amountQr == amountTotal" });
    }
  }

  // Ensure cash session (auto-open if none)
  let cashSessionId: string | null = null;
  {

    const u = (req as any).user as { orgId: string; sub: string };
    const session = await prisma.cashSession.findFirst({
      where: { orgId: appt.orgId, branchId: appt.branchId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
    if (!session) {
      // Auto-open minimal session if none exists
      const created = await prisma.cashSession.create({
        data: {
          orgId: appt.orgId,
          branchId: appt.branchId,
          openedByUserId: u.sub,
          openingCash: 0,
          status: "OPEN",
        },
      });
      cashSessionId = created.id;
    } else {
      cashSessionId = session.id;
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orgId: appt.orgId,
          branchId: appt.branchId,
          appointmentId: appt.id,
          customerId: appt.customerId,
          staffId: appt.staffId,
          serviceId: appt.serviceId,
          method: body.method,
          amountTotal: body.amountTotal,
          amountCash: cash,
          amountQr: qr,
          qrReference: body.qrReference,
          status: "PAID",
          paidAt: new Date(),
          cashSessionId: cashSessionId || undefined,
        },
      });

      const pct = appt.staff.commissionPct ?? 0;
      const commissionAmount = Math.floor((body.amountTotal * pct) / 100);
      const commission = await tx.commissionRecord.create({
        data: { paymentId: payment.id, staffId: appt.staffId, pct, amount: commissionAmount },
      });

      // Loyalty points (si está habilitado en org.settings.loyalty)
      const org = await tx.organization.findUnique({ where: { id: appt.orgId } });
      const loyalty = (org?.settings as any)?.loyalty || {};
      let pointsAdded = 0;
      if (loyalty?.enabled) {
        const pointsPerBs = Number(loyalty.pointsPerBs ?? 0);
        pointsAdded = Math.floor(body.amountTotal * pointsPerBs);
        if (pointsAdded > 0) {
          await tx.customerProfile.update({
            where: { id: appt.customerId },
            data: { loyaltyPoints: { increment: pointsAdded } },
          });
        }
      }

      await tx.appointment.update({
        where: { id: appt.id },
        data: { status: "COMPLETED", price: body.amountTotal },
      });

      return { payment, commission, pointsAdded };
    });

    return res.json(result);
  } catch (e: any) {
    // Concurrency-safe: si dos requests intentan pagar al mismo tiempo
    if (e?.code === "P2002" && (e?.meta?.target || []).includes("appointmentId")) {
      const existing2 = await prisma.payment.findUnique({ where: { appointmentId: appt.id } });
      return res.status(409).json({ error: "Payment already registered for this appointment", payment: existing2 });
    }
    throw e;
  }
});


// -------------------------
// Reservas pagadas (público - para kiosco)
// -------------------------
router.get("/queue/paid-appointments", async (req, res) => {
  try {
    const q = z.object({
      branchId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(req.query);

    const dateStr = q.date ?? new Date().toISOString().slice(0, 10);
    const dayStart = new Date(dateStr + "T00:00:00");
    const dayEnd   = new Date(dateStr + "T23:59:59.999");

    const payments = await prisma.payment.findMany({
      where: {
        branchId: q.branchId,
        status: "PAID",
        paidAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        appointment: {
          include: {
            customer: true,
            service:  true,
            staff:    true,
            queueTicket: true,
          },
        },
        service: true,
        staff:   true,
      },
      orderBy: { paidAt: "desc" },
    });

    res.json({
      paidAppointments: payments.map((p) => ({
        id:           p.id,
        appointmentId: p.appointmentId,
        customerName: p.appointment?.customer?.fullName ?? "Cliente",
        ticketNumber: p.appointment?.queueTicket?.ticketNumber ?? null,
        serviceName:  (p.appointment?.service ?? p.service)?.name ?? "—",
        staffName:    (p.appointment?.staff ?? p.staff)?.displayName ?? "—",
        startAt:      p.appointment?.startAt ?? null,
        paidAt:       p.paidAt,
      })),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------
// Cola / Walk-ins
// -------------------------
router.post("/queue/tickets", async (req, res) => {
  const schema = z.object({
    branchId: z.string().min(1),
    customerName: z.string().min(2),
    serviceId: z.string().min(1),
    staffId: z.string().optional(),
    notes: z.string().optional(),
  });
  const body = schema.parse(req.body);


  const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
  if (!branch) return res.status(404).json({ error: "Branch not found" });

  const dayStart = new Date(); dayStart.setHours(0,0,0,0);
  const dayEnd = new Date(); dayEnd.setHours(23,59,59,999);

  const last = await prisma.queueTicket.findFirst({
    where: { branchId: body.branchId, createdAt: { gte: dayStart, lte: dayEnd } },
    orderBy: { ticketNumber: "desc" },
  });
  const nextNumber = (last?.ticketNumber ?? 0) + 1;

  const ticket = await prisma.queueTicket.create({
    data: {
      orgId: branch.orgId,
      branchId: body.branchId,
      ticketNumber: nextNumber,
      customerName: body.customerName,
      serviceId: body.serviceId,
      staffId: body.staffId,
      notes: body.notes,
      status: "WAITING",
    },
    include: { service: true, staff: true },
  });

  res.json({ ticket });
});

router.get("/queue/tickets", async (req, res) => {
  const q = z.object({ branchId: z.string().min(1) }).parse(req.query);
  const tickets = await prisma.queueTicket.findMany({
    where: { branchId: q.branchId, status: { in: ["WAITING","CALLED","IN_CHAIR"] } },
    include: { service: true, staff: true, appointment: true },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const mapped = tickets.map(t => ({
    id: t.id,
    n: t.ticketNumber,
    name: t.customerName,
    service: t.service.name,
    staff: t.staff?.displayName || null,
    status: t.status,
    createdAt: t.createdAt,
    fromAppointment: !!t.appointmentId,
    scheduledAt: (t.appointment as any)?.startAt ?? null,
  }));

  // Priority: within WAITING, appointment-based tickets come first (sorted by scheduledAt)
  mapped.sort((a, b) => {
    const order: Record<string, number> = { CALLED: 0, IN_CHAIR: 1, WAITING: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === "WAITING") {
      if (a.fromAppointment && !b.fromAppointment) return -1;
      if (!a.fromAppointment && b.fromAppointment) return 1;
      if (a.fromAppointment && b.fromAppointment && a.scheduledAt && b.scheduledAt)
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  res.json({ tickets: mapped });
});

router.patch("/queue/tickets/:id", authRequired, requireRole("ADMIN","STAFF"), async (req, res) => {
  const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
  const body = z.object({ status: z.enum(["WAITING","CALLED","IN_CHAIR","DONE","CANCELED"]) }).parse(req.body);

  const now = new Date();
  const data: any = { status: body.status };
  if (body.status === "CALLED") data.calledAt = now;
  if (body.status === "IN_CHAIR") data.startedAt = now;
  if (body.status === "DONE") data.doneAt = now;

  const ticket = await prisma.queueTicket.update({ where: { id }, data });
  res.json({ ticket });
});
