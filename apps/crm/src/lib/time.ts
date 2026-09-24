/**
 * Utilidades de tiempo sin dependencias. Se guarda UTC; se lee en la zona de
 * la organización (por defecto America/Lima).
 */
export const DEFAULT_TIMEZONE = "America/Lima";

export function formatDateTime(value: Date | string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-PE", {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(value: Date | string, timeZone = DEFAULT_TIMEZONE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-PE", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDate(value: Date | string, timeZone = DEFAULT_TIMEZONE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-PE", { timeZone, weekday: "short", day: "2-digit", month: "short" }).format(date);
}

/** Partes locales (año, mes, día, hora, minuto, día de semana) de un instante en una zona. */
export function localParts(date: Date, timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

/** Instante UTC de una fecha y hora local («2026-09-12», «09:30») en una zona. */
export function zonedTimeToUtc(dateIso: string, time: string, timeZone = DEFAULT_TIMEZONE): Date {
  const [year = 1970, month = 1, day = 1] = dateIso.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const local = localParts(new Date(guess), timeZone);
  const asIfUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  return new Date(guess - (asIfUtc - guess));
}

export function isWithinBusinessHours(
  date: Date,
  hours: { days: number[]; start: string; end: string },
  timeZone = DEFAULT_TIMEZONE,
): boolean {
  const local = localParts(date, timeZone);
  if (!hours.days.includes(local.weekday)) return false;
  const minutes = local.hour * 60 + local.minute;
  const [sh = 0, sm = 0] = hours.start.split(":").map(Number);
  const [eh = 0, em = 0] = hours.end.split(":").map(Number);
  return minutes >= sh * 60 + sm && minutes < eh * 60 + em;
}

export function hoursBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / 3_600_000;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
