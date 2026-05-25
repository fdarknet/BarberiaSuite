import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env.js";
import { sendAppointmentNotification } from "./notifications.js";

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const notifQueue = new Queue("notifications", { connection });

export const notifWorker = new Worker(
  "notifications",
  async (job) => {
    const { type, appointmentId } = job.data as { type: string; appointmentId: string };
    await sendAppointmentNotification(type, appointmentId);
  },
  { connection }
);

notifWorker.on("failed", (job, err) => {
  console.error("[worker] job failed", job?.id, err);
});
