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

export function parseISODate(dateISO: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!match) throw new Error(`Invalid date: ${dateISO}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function addDaysISO(dateISO: string, days: number): string {
  const { y, m, d } = parseISODate(dateISO);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0, 0));
  return date.toISOString().slice(0, 10);
}

export function weekdayFromISODate(dateISO: string): number {
  const { y, m, d } = parseISODate(dateISO);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)).getUTCDay();
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  // Some Node/ICU builds return midnight as 24:00 even with a 24-hour clock.
  // Treat it as 00:00 of the reported date so the timezone offset stays correct.
  const hour = Number(values.hour) % 24;
  const asUTC = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    hour,
    Number(values.minute),
    Number(values.second),
  );
  return asUTC - date.getTime();
}

export function setDateTimeInZone(dateISO: string, hhmm: string, timeZone: string): Date {
  const { y, m, d } = parseISODate(dateISO);
  const { h, m: minute } = parseHHMM(hhmm);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, h, minute, 0, 0));
  const first = new Date(utcGuess.getTime() - timeZoneOffsetMs(utcGuess, timeZone));
  const second = new Date(utcGuess.getTime() - timeZoneOffsetMs(first, timeZone));
  return second;
}

export function dateISOInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
