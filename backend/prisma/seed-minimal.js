import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const org = await prisma.organization.upsert({
        where: { id: "org_demo" },
        update: {},
        create: {
            id: "org_demo",
            name: "Camarguinho BC",
            logoUrl: null,
            settings: {
                whatsappDisplayNumber: "+59170000000",
                loyalty: { enabled: true, pointsPerBs: 1 },
                payments: { qrEnabled: true },
                cashPin: "1234",
                company: {
                    displayName: "Camarguinho BC",
                    razonSocial: "Camarguinho BC S.R.L.",
                    nit: "0000000000",
                    address: "Centro",
                    phone: "+59170000000",
                    email: "info@barberia.local",
                },
                print: {
                    footerText: "Gracias por tu visita 💈",
                    showRazonSocial: true,
                    showNit: true,
                    showAddress: false,
                    showPhone: false,
                    showEmail: false,
                    showWhatsapp: true,
                },
            },
        },
    });
    // 1 branch
    const branch = await prisma.branch.upsert({
        where: { id: "branch_centro" },
        update: { orgId: org.id, name: "Sucursal Centro", address: "Centro", timezone: "America/La_Paz" },
        create: { id: "branch_centro", orgId: org.id, name: "Sucursal Centro", address: "Centro", timezone: "America/La_Paz" },
    });
    // 1 service
    const service = await prisma.service.upsert({
        // usa la unique compuesta (orgId, name) para evitar choques si cambia el id
        where: { orgId_name: { orgId: org.id, name: "Corte" } },
        update: { durationMin: 30, basePrice: 30 },
        create: { orgId: org.id, name: "Corte", durationMin: 30, basePrice: 30 },
    });
    await prisma.branchService.upsert({
        where: { branchId_serviceId: { branchId: branch.id, serviceId: service.id } },
        update: { enabled: true, priceOverride: null },
        create: { branchId: branch.id, serviceId: service.id, enabled: true, priceOverride: null },
    });
    // Admin user
    const adminEmail = "admin@local.com";
    const adminPass = await bcrypt.hash("admin123", 10);
    const adminUser = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { role: "ADMIN", passwordHash: adminPass, orgId: org.id, phone: "+59170000001" },
        create: { email: adminEmail, passwordHash: adminPass, role: "ADMIN", orgId: org.id, phone: "+59170000001" },
    });
    // Staff user + profile
    const staffEmail = "barbero@local.com";
    const staffPass = await bcrypt.hash("staff123", 10);
    const staffUser = await prisma.user.upsert({
        where: { email: staffEmail },
        update: { role: "STAFF", passwordHash: staffPass, orgId: org.id, phone: "+59170000002" },
        create: { email: staffEmail, passwordHash: staffPass, role: "STAFF", orgId: org.id, phone: "+59170000002" },
    });
    const staff = await prisma.staffProfile.upsert({
        where: { userId: staffUser.id },
        update: { branchId: branch.id, displayName: "Barbero 1", commissionPct: 50, photoUrl: null },
        create: { userId: staffUser.id, branchId: branch.id, displayName: "Barbero 1", commissionPct: 50, photoUrl: null },
    });
    await prisma.staffService.upsert({
        where: { staffId_serviceId: { staffId: staff.id, serviceId: service.id } },
        update: {},
        create: { staffId: staff.id, serviceId: service.id },
    });
    // Customer
    const customerEmail = "cliente@local.com";
    const customerPass = await bcrypt.hash("cliente123", 10);
    const custUser = await prisma.user.upsert({
        where: { email: customerEmail },
        update: { role: "CUSTOMER", passwordHash: customerPass, orgId: org.id, phone: "+59170000003" },
        create: { email: customerEmail, passwordHash: customerPass, role: "CUSTOMER", orgId: org.id, phone: "+59170000003" },
    });
    await prisma.customerProfile.upsert({
        where: { userId: custUser.id },
        update: { fullName: "Cliente Demo" },
        create: { userId: custUser.id, fullName: "Cliente Demo" },
    });
    console.log("✅ Seed MINIMAL completed");
    console.log("ORG_ID: org_demo");
    console.log("Branch: branch_centro");
    console.log("Service: Corte");
    console.log("Staff: barbero@local.com / staff123");
    console.log("Admin: admin@local.com / admin123");
    console.log("Customer: cliente@local.com / cliente123");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
