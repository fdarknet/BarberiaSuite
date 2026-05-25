import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "org_demo" },
    update: {},
    create: { id: "org_demo", name: "", logoUrl: null, settings: { whatsappDisplayNumber: "+59170000000", loyalty: { enabled: true, pointsPerBs: 1 }, payments: { qrEnabled: true } } },
  });

  // Create branches (IDs fixed for easy frontend config)
  const branch1 = await prisma.branch.upsert({
    where: { id: "branch_centro" },
    update: { orgId: org.id },
    create: {
      id: "branch_centro",
      orgId: org.id,
      name: "Sucursal Centro",
      address: "Av. Principal 123",
      timezone: "America/La_Paz",
      settings: {},
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { id: "branch_norte" },
    update: { orgId: org.id },
    create: {
      id: "branch_norte",
      orgId: org.id,
      name: "Sucursal Norte",
      address: "Calle Norte 45",
      timezone: "America/La_Paz",
      settings: {},
    },
  });

  // Services (unique per org by name)
  const sCorte = await prisma.service.upsert({
    where: { orgId_name: { orgId: org.id, name: "Corte" } },
    update: { durationMin: 30, basePrice: 30 },
    create: { orgId: org.id, name: "Corte", durationMin: 30, basePrice: 30 },
  });

  const sBarba = await prisma.service.upsert({
    where: { orgId_name: { orgId: org.id, name: "Barba" } },
    update: { durationMin: 20, basePrice: 20 },
    create: { orgId: org.id, name: "Barba", durationMin: 20, basePrice: 20 },
  });

  const sCorteBarba = await prisma.service.upsert({
    where: { orgId_name: { orgId: org.id, name: "Corte + Barba" } },
    update: { durationMin: 45, basePrice: 45 },
    create: { orgId: org.id, name: "Corte + Barba", durationMin: 45, basePrice: 45 },
  });

  for (const b of [branch1, branch2]) {
    for (const sv of [sCorte, sBarba, sCorteBarba]) {
      await prisma.branchService.upsert({
        where: { branchId_serviceId: { branchId: b.id, serviceId: sv.id } },
        update: { enabled: true },
        create: { branchId: b.id, serviceId: sv.id, enabled: true },
      });
    }
  }

  // Admin user
  const adminPass = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@local.com" },
    update: { passwordHash: adminPass, role: "ADMIN" as any, orgId: org.id },
    create: { orgId: org.id, role: "ADMIN" as any, email: "admin@local.com", passwordHash: adminPass },
  });

  // Staff users
  const staffPass = await bcrypt.hash("staff123", 10);

  const staffUser1 = await prisma.user.upsert({
    where: { email: "barbero1@local.com" },
    update: { passwordHash: staffPass, role: "STAFF" as any, orgId: org.id },
    create: { orgId: org.id, role: "STAFF" as any, email: "barbero1@local.com", passwordHash: staffPass },
  });

  const staffUser2 = await prisma.user.upsert({
    where: { email: "barbero2@local.com" },
    update: { passwordHash: staffPass, role: "STAFF" as any, orgId: org.id },
    create: { orgId: org.id, role: "STAFF" as any, email: "barbero2@local.com", passwordHash: staffPass },
  });

  const staff1 = await prisma.staffProfile.upsert({
    where: { userId: staffUser1.id },
    update: { branchId: branch1.id, displayName: "Luis", photoUrl: null },
    create: { userId: staffUser1.id, branchId: branch1.id, displayName: "Luis", photoUrl: null, commissionPct: 50 },
  });

  const staff2 = await prisma.staffProfile.upsert({
    where: { userId: staffUser2.id },
    update: { branchId: branch2.id, displayName: "Mario", photoUrl: null },
    create: { userId: staffUser2.id, branchId: branch2.id, displayName: "Mario", photoUrl: null, commissionPct: 50 },
  });

  for (const sv of [sCorte, sBarba, sCorteBarba]) {
    await prisma.staffService.upsert({
      where: { staffId_serviceId: { staffId: staff1.id, serviceId: sv.id } },
      update: {},
      create: { staffId: staff1.id, serviceId: sv.id },
    });
    await prisma.staffService.upsert({
      where: { staffId_serviceId: { staffId: staff2.id, serviceId: sv.id } },
      update: {},
      create: { staffId: staff2.id, serviceId: sv.id },
    });
  }

  // Availability Mon-Sat 09:00-19:00 with lunch break
  async function ensureAvail(staffId: string) {
    for (let wd = 1; wd <= 6; wd++) {
      await prisma.staffAvailability.upsert({
        where: { staffId_weekday: { staffId, weekday: wd } },
        update: {
          startTime: "09:00",
          endTime: "19:00",
          breaks: [{ start: "13:00", end: "14:00" }],
        },
        create: {
          staffId,
          weekday: wd,
          startTime: "09:00",
          endTime: "19:00",
          breaks: [{ start: "13:00", end: "14:00" }],
        },
      });
    }
  }
  await ensureAvail(staff1.id);
  await ensureAvail(staff2.id);

  // Customer user
  const custPass = await bcrypt.hash("cliente123", 10);
  await prisma.user.upsert({
    where: { email: "cliente@local.com" },
    update: { passwordHash: custPass, role: "CUSTOMER" as any, orgId: org.id, phone: "+59170000000" },
    create: {
      orgId: org.id,
      role: "CUSTOMER" as any,
      email: "cliente@local.com",
      phone: "+59170000000",
      passwordHash: custPass,
      customer: { create: { fullName: "Cliente Demo", whatsappOptIn: true, preferredChannel: "both", loyaltyPoints: 0 } },
    },
  });

  console.log("✅ Seed completed");
  console.log("ORG_ID:", org.id, "(fijo)");
  console.log("Branches:", branch1.id, branch2.id);
  console.log("Admin:", "admin@local.com / admin123");
  console.log("Staff:", "barbero1@local.com / staff123", "|", "barbero2@local.com / staff123");
  console.log("Customer:", "cliente@local.com / cliente123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
