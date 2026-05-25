import nodemailer from "nodemailer";
import { env } from "./env.js";
import { prisma } from "./prisma.js";

function hasSmtp() {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

export async function sendEmail(to: string, subject: string, text: string) {
  if (!hasSmtp()) {
    console.log("\n[EMAIL DEV] to:", to, "\nsubject:", subject, "\n", text, "\n");
    return;
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  await transporter.sendMail({ from: env.MAIL_FROM, to, subject, text });
}

async function sendWhatsApp(toPhone: string, text: string) {
  const token = env.WHATSAPP_TOKEN || "";
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID || "";
  if (!token || !phoneId) {
    console.log("\n[WHATSAPP DEV] to:", toPhone, "\n", text, "\n");
    return;
  }
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone.replace(/\D/g, ""),
      type: "text",
      text: { body: text },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error("[whatsapp] failed", resp.status, body);
  }
}

function canSendEmail(channel: string) {
  return channel === "email" || channel === "both" || !channel;
}
function canSendWhatsApp(channel: string) {
  return channel === "whatsapp" || channel === "both";
}

export async function sendAppointmentNotification(type: string, appointmentId: string) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      branch: true,
      service: true,
      staff: { include: { user: true } },
      customer: { include: { user: true } },
    },
  });
  if (!appt) return;

  const org = await prisma.organization.findUnique({ where: { id: appt.orgId } });
  const waDisplay = (org?.settings as any)?.whatsappDisplayNumber as string | undefined;
  const contactLine = waDisplay ? `\nContacto WhatsApp: ${waDisplay}` : "";
  const channel = (appt.customer.preferredChannel ?? "both") as string;

  const customerEmail = appt.customer.user.email;
  const customerPhone = appt.customer.user.phone || "";

  const when = appt.startAt.toLocaleString("es-BO", { timeZone: appt.branch.timezone });
  const msg = `Sucursal: ${appt.branch.name}\nServicio: ${appt.service.name}\nBarbero: ${appt.staff.displayName}\nFecha/Hora: ${when}\nEstado: ${appt.status}`;

  const emailText = (lead: string) => `${lead}\n\n${msg}${contactLine}`;
  const waText = (lead: string) => `${lead}\n\n${msg}${contactLine}`;

  if (type === "created") {
    if (canSendEmail(channel)) {
      await sendEmail(customerEmail, "✅ Reserva confirmada", emailText("Tu reserva fue creada."));
    }
    if (canSendWhatsApp(channel) && appt.customer.whatsappOptIn && customerPhone) {
      await sendWhatsApp(customerPhone, waText("✅ Reserva creada"));
    }
  } else if (type === "updated") {
    if (canSendEmail(channel)) {
      await sendEmail(customerEmail, "🔁 Reserva actualizada", emailText("Tu reserva fue actualizada."));
    }
    if (canSendWhatsApp(channel) && appt.customer.whatsappOptIn && customerPhone) {
      await sendWhatsApp(customerPhone, waText("🔁 Reserva actualizada"));
    }
  } else if (type === "canceled") {
    if (canSendEmail(channel)) {
      await sendEmail(customerEmail, "❌ Reserva cancelada", emailText("Tu reserva fue cancelada."));
    }
    if (canSendWhatsApp(channel) && appt.customer.whatsappOptIn && customerPhone) {
      await sendWhatsApp(customerPhone, waText("❌ Reserva cancelada"));
    }
  } else if (type === "reminder_24h") {
    if (canSendEmail(channel)) {
      await sendEmail(customerEmail, "⏰ Recordatorio: tu cita es mañana", emailText("Te recordamos tu cita (24h antes)."));
    }
    if (canSendWhatsApp(channel) && appt.customer.whatsappOptIn && customerPhone) {
      await sendWhatsApp(customerPhone, waText("⏰ Recordatorio (24h): tu cita es mañana"));
    }
  } else if (type === "reminder_2h") {
    if (canSendEmail(channel)) {
      await sendEmail(customerEmail, "⏰ Recordatorio: tu cita es en 2 horas", emailText("Te recordamos tu cita (2h antes)."));
    }
    if (canSendWhatsApp(channel) && appt.customer.whatsappOptIn && customerPhone) {
      await sendWhatsApp(customerPhone, waText("⏰ Recordatorio (2h): tu cita es en 2 horas"));
    }
  }
}
