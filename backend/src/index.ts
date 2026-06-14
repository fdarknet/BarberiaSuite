import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./env.js";
import { router } from "./routes.js";
import { prisma } from "./prisma.js";
import "./queue.js";

const app = express();
app.set("etag", false);
const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// uploads dir (logo/fotos/QR)
const uploadsDir = path.resolve("uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use("/uploads", express.static(uploadsDir));

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", router);

app.get("/", (_req, res) => res.send("Barbería API OK"));

// ─────────────────────────────────────────────────────────────
// Auto-promoción: sube reservas pagadas a "En Espera" 10 min antes
// ─────────────────────────────────────────────────────────────
async function promoteAppointmentsToQueue() {
  try {
    const now = new Date();
    const in10min = new Date(now.getTime() + 10 * 60 * 1000);

    // Busca citas pagadas cuya hora de inicio está en los próximos 10 min
    // y que todavía NO tienen un QueueTicket vinculado
    const appointments = await prisma.appointment.findMany({
      where: {
        startAt: { gte: now, lte: in10min },
        payment: { status: "PAID" },
        queueTicket: null,
      },
      include: { customer: true },
    });

    for (const appt of appointments) {
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(); dayEnd.setHours(23, 59, 59, 999);

      const last = await prisma.queueTicket.findFirst({
        where: { branchId: appt.branchId, createdAt: { gte: dayStart, lte: dayEnd } },
        orderBy: { ticketNumber: "desc" },
      });
      const nextNumber = (last?.ticketNumber ?? 0) + 1;

      await prisma.queueTicket.create({
        data: {
          orgId:        appt.orgId,
          branchId:     appt.branchId,
          ticketNumber: nextNumber,
          customerName: appt.customer.fullName,
          serviceId:    appt.serviceId,
          staffId:      appt.staffId,
          status:       "WAITING",
          appointmentId: appt.id,
        },
      });
      console.log(`⏰ Auto-promovido: cita ${appt.id} → turno #${nextNumber}`);
    }
  } catch (err) {
    console.error("❌ Error en auto-promoción de turnos:", err);
  }
}

// Correr cada 60 segundos
setInterval(promoteAppointmentsToQueue, 60 * 1000);
// También al arrancar el servidor
promoteAppointmentsToQueue();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(env.PORT, () => {
  console.log(`✅ API running on http://localhost:${env.PORT}`);
});
