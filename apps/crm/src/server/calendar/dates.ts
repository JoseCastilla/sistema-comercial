import { DEFAULT_TIMEZONE, localParts, zonedTimeToUtc } from "@/lib/time";

/**
 * Fechas de calendario («YYYY-MM-DD») en la zona de la organización.
 * Sin dependencias: la aritmética de días se hace sobre el calendario UTC,
 * que para sumar o restar días enteros es idéntico al de cualquier zona.
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** Fecha local («2026-09-14») de un instante en una zona. */
export function localDateIso(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const parts = localParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function isDateIso(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function utcMidnight(dateIso: string): Date {
  const [year = 1970, month = 1, day = 1] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(dateIso: string, days: number): string {
  const date = utcMidnight(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Día de la semana de una fecha local: 0 domingo … 6 sábado (igual que `BookingRule.weekday`). */
export function weekdayOf(dateIso: string): number {
  return utcMidnight(dateIso).getUTCDay();
}

/** Lunes de la semana a la que pertenece la fecha. */
export function startOfWeekIso(dateIso: string): string {
  return addDays(dateIso, -((weekdayOf(dateIso) + 6) % 7));
}

/** Instante UTC en que empieza el día local. */
export function dayStartUtc(dateIso: string, timeZone = DEFAULT_TIMEZONE): Date {
  return zonedTimeToUtc(dateIso, "00:00", timeZone);
}

/** «09:30» → 570 minutos desde medianoche. Devuelve NaN si no es una hora válida. */
export function minutesOf(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

export function timeOfMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
