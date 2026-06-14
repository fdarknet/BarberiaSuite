import { prisma } from "./prisma.js";
import { addDaysISO, addMinutes, overlaps, setDateTimeInZone, weekdayFromISODate } from "./time.js";

type Slot = { startAt: string; endAt: string; staffId?: string };

export async function getAvailableSlots(params: {
  branchId: string;
  serviceId: string;
  dateISO: string; // YYYY-MM-DD
  staffId?: string;
}): Promise<{ slots: Slot[]; staffCandidates: { staffId: string; name: string; photoUrl?: string|null }[] }> {
  const { branchId, serviceId, dateISO, staffId } = params;

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new Error("Branch not found");

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error("Service not found");

  const timezone = branch.timezone || "America/La_Paz";
  const weekday = weekdayFromISODate(dateISO);

  // Staff who can do the service and belong to this branch
  const staffList = await prisma.staffProfile.findMany({
    where: {
      branchId,
      services: { some: { serviceId } },
      ...(staffId ? { id: staffId } : {}),
    },
    include: { user: true },
    orderBy: { displayName: "asc" },
  });

  const staffCandidates = staffList.map(s => ({ staffId: s.id, name: s.displayName, photoUrl: (s as any).photoUrl ?? null }));
  if (staffList.length === 0) return { slots: [], staffCandidates };

  // Fetch availability for that weekday
  const avails = await prisma.staffAvailability.findMany({
    where: { staffId: { in: staffList.map(s => s.id) }, weekday },
  });

  // Appointments for that day for relevant staff
  const dayStart = setDateTimeInZone(dateISO, "00:00", timezone);
  const dayEnd = new Date(setDateTimeInZone(addDaysISO(dateISO, 1), "00:00", timezone).getTime() - 1);

  const appts = await prisma.appointment.findMany({
    where: {
      branchId,
      staffId: { in: staffList.map(s => s.id) },
      startAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ['CANCELED'] },
    },
  });

  const duration = service.durationMin;
  const step = 15; // minutos
  const now = new Date();
  const out: Slot[] = [];

  // helper: staff has free slot?
  function staffFree(staffId: string, start: Date, end: Date): boolean {
    const conflicts = appts.filter(a => a.staffId === staffId && overlaps(start, end, a.startAt, a.endAt));
    if (conflicts.length > 0) return false;

    const avail = avails.find(a => a.staffId === staffId);
    if (!avail) return false;

    const availStart = setDateTimeInZone(dateISO, avail.startTime, timezone);
    const availEnd = setDateTimeInZone(dateISO, avail.endTime, timezone);
    if (!(start >= availStart && end <= availEnd)) return false;

    const breaks = (avail.breaks as any[]) || [];
    for (const br of breaks) {
      const breakStart = br.start ?? br.startTime;
      const breakEnd = br.end ?? br.endTime;
      if (!breakStart || !breakEnd) continue;
      const bS = setDateTimeInZone(dateISO, breakStart, timezone);
      const bE = setDateTimeInZone(dateISO, breakEnd, timezone);
      if (overlaps(start, end, bS, bE)) return false;
    }
    return true;
  }

  // Generate slots for each staff, then merge
  for (const s of staffList) {
    const avail = avails.find(a => a.staffId === s.id);
    if (!avail) continue;

    let cursor = setDateTimeInZone(dateISO, avail.startTime, timezone);
    const endBoundary = setDateTimeInZone(dateISO, avail.endTime, timezone);

    while (addMinutes(cursor, duration) <= endBoundary) {
      const start = cursor;
      const end = addMinutes(cursor, duration);
      if (start >= now && staffFree(s.id, start, end)) {
        out.push({
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          staffId: s.id,
        });
      }
      cursor = addMinutes(cursor, step);
    }
  }

  // If staff not specified, show unique time slots where any staff is free (choose staff later).
  if (!staffId) {
    const map = new Map<string, Slot>();
    for (const s of out) {
      const key = s.startAt;
      if (!map.has(key)) map.set(key, { startAt: s.startAt, endAt: s.endAt });
    }
    return { slots: Array.from(map.values()).sort((a,b)=>a.startAt.localeCompare(b.startAt)), staffCandidates };
  }

  return { slots: out.sort((a,b)=>a.startAt.localeCompare(b.startAt)), staffCandidates };
}
