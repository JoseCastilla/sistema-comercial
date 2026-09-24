import { DEFAULT_TIMEZONE, localParts } from "@/lib/time";
import { zonedTimeToUtc } from "@/lib/time";

import { addDays, localDateIso, minutesOf, timeOfMinutes, weekdayOf } from "./dates";

/**
 * Generación de horarios con cupo (SPEC-058 BR-022). Funciones puras: reciben
 * las franjas de la organización, las citas ya tomadas, el «ahora» y la zona.
 * El servicio (`service.ts`) las alimenta desde la base.
 */

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  booked: number;
  available: boolean;
  /** «lun 14 sep, 10:00» en la zona de la organización. */
  label: string;
}

/** Lo que importa de una `BookingRule`. */
export interface SlotRule {
  /** 0 domingo … 6 sábado, en la zona de la organización. */
  weekday: number;
  /** «HH:MM». */
  startTime: string;
  /** «HH:MM», exclusivo. */
  endTime: string;
  slotMinutes: number;
  capacity: number;
}

/** Lo que importa de una cita para contar cupo: solo las PENDING ocupan lugar. */
export interface SlotBooking {
  scheduledAt: Date;
  status: string;
}

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pad = (value: number) => String(value).padStart(2, "0");

export function slotLabel(startsAt: Date, timeZone = DEFAULT_TIMEZONE): string {
  const parts = localParts(startsAt, timeZone);
  return `${WEEKDAYS[parts.weekday]} ${parts.day} ${MONTHS[parts.month - 1]}, ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Citas PENDING que empiezan dentro del horario [startsAt, endsAt). */
export function countBooked(bookings: readonly SlotBooking[], startsAt: Date, endsAt: Date): number {
  let count = 0;
  for (const booking of bookings) {
    if (booking.status !== "PENDING") continue;
    const at = booking.scheduledAt.getTime();
    if (at >= startsAt.getTime() && at < endsAt.getTime()) count += 1;
  }
  return count;
}

export interface GenerateSlotsInput {
  rules: readonly SlotRule[];
  bookings: readonly SlotBooking[];
  now: Date;
  /** Desde qué instante ofrecer; por defecto `now`. Se recorren días locales completos a partir de su fecha local. */
  from?: Date;
  /** Cuántos días locales recorrer; por defecto 7. */
  days?: number;
  timeZone?: string;
  onlyAvailable?: boolean;
}

/**
 * Horarios ordenados por inicio. Nunca devuelve horarios que ya empezaron ni
 * anteriores a `from`. Si dos franjas del mismo día producen el mismo inicio,
 * gana la de mayor cupo.
 */
export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const { rules, bookings, now } = input;
  if (rules.length === 0) return [];
  const timeZone = input.timeZone ?? DEFAULT_TIMEZONE;
  const from = input.from ?? now;
  const days = Math.max(1, Math.floor(input.days ?? 7));
  const firstDay = localDateIso(from, timeZone);
  const byStart = new Map<number, Slot>();

  for (let offset = 0; offset < days; offset += 1) {
    const dateIso = addDays(firstDay, offset);
    const weekday = weekdayOf(dateIso);
    for (const rule of rules) {
      if (rule.weekday !== weekday || rule.slotMinutes <= 0 || rule.capacity <= 0) continue;
      const start = minutesOf(rule.startTime);
      const end = minutesOf(rule.endTime);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      for (let minute = start; minute + rule.slotMinutes <= end; minute += rule.slotMinutes) {
        const startsAt = zonedTimeToUtc(dateIso, timeOfMinutes(minute), timeZone);
        const key = startsAt.getTime();
        if (key <= now.getTime() || key < from.getTime()) continue;
        const existing = byStart.get(key);
        if (existing && existing.capacity >= rule.capacity) continue;
        const endsAt = new Date(key + rule.slotMinutes * 60_000);
        const booked = countBooked(bookings, startsAt, endsAt);
        byStart.set(key, {
          startsAt,
          endsAt,
          capacity: rule.capacity,
          booked,
          available: booked < rule.capacity,
          label: slotLabel(startsAt, timeZone),
        });
      }
    }
  }

  const slots = [...byStart.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return input.onlyAvailable ? slots.filter((slot) => slot.available) : slots;
}

/** El horario que empieza exactamente en `at`, o null si no existe o ya pasó. */
export function findSlot(input: { rules: readonly SlotRule[]; bookings: readonly SlotBooking[]; now: Date; at: Date; timeZone?: string }): Slot | null {
  const slots = generateSlots({ rules: input.rules, bookings: input.bookings, now: input.now, from: input.at, days: 1, timeZone: input.timeZone });
  return slots.find((slot) => slot.startsAt.getTime() === input.at.getTime()) ?? null;
}
