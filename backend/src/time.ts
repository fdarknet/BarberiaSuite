export function parseHHMM(hhmm: string): { h: number; m: number } {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error(`Invalid time: ${hhmm}`);
  return { h: Number(m[1]), m: Number(m[2]) };
}

export function setDateTime(date: Date, hhmm: string): Date {
  const { h, m } = parseHHMM(hhmm);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function weekday0Sunday(d: Date): number {
  return d.getDay();
}
