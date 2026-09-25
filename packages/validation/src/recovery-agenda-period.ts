/**
 * Períodos de «Mi agenda» — SPEC-048 BR-013, SPEC-066 BR-012.
 *
 * «Próximas» (catorce días desde la fecha elegida, en lista por día) y el
 * mes (rejilla de semanas completas). Las cuadrículas de semana y día se
 * retiraron: con pocas citas dibujaban trece horas vacías y en el celular no
 * cabían. Todo se corta a medianoche de Lima (-05:00, sin horario de
 * verano) para que un martes sea el mismo martes en cualquier servidor.
 */
import { getLimaIsoDate } from "./order-period.js";

export const recoveryAgendaViews = ["proximas", "mes"] as const;
export type RecoveryAgendaView = (typeof recoveryAgendaViews)[number];

export const recoveryAgendaViewLabels: Record<RecoveryAgendaView, string> = {
  proximas: "Próximas",
  mes: "Mes",
};

/** Días que cubre «Próximas» desde la fecha elegida. */
export const recoveryAgendaUpcomingDays = 14;

/**
 * Cualquier otra vista —también las retiradas «semana», «dia» y «lista» de
 * un enlace guardado— abre «Próximas».
 */
export function parseRecoveryAgendaView(
  value: string | null | undefined,
): RecoveryAgendaView {
  return String(value ?? "").trim() === "mes" ? "mes" : "proximas";
}

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayMs = 24 * 60 * 60 * 1000;

/** Medianoche de Lima de un día `AAAA-MM-DD`; nulo si no es una fecha real. */
export function limaDayStartFromIso(iso: string): Date | null {
  const match = isoDatePattern.exec(iso.trim());
  if (!match) return null;

  const start = new Date(`${match[0]}T00:00:00-05:00`);
  if (Number.isNaN(start.getTime())) return null;

  // Un 31/02 se desliza a marzo: se rechaza en vez de aceptar otro día.
  return getLimaIsoDate(start) === match[0] ? start : null;
}

/** La fecha pedida en la URL, o el día de hoy en Lima si no vale. */
export function parseRecoveryAgendaDate(
  value: string | null | undefined,
  now: Date,
): Date {
  return (
    limaDayStartFromIso(String(value ?? "")) ??
    (limaDayStartFromIso(getLimaIsoDate(now)) as Date)
  );
}

/** Lunes = 0 … domingo = 6, en Lima. */
export function limaWeekdayIndex(dayStart: Date): number {
  // Al mediodía de Lima el día UTC coincide con el día de Lima.
  const noon = new Date(dayStart.getTime() + 12 * 60 * 60 * 1000);

  return (noon.getUTCDay() + 6) % 7;
}

export interface RecoveryAgendaPeriod {
  view: RecoveryAgendaView;
  /** Primer instante incluido. */
  start: Date;
  /** Primer instante excluido. */
  end: Date;
  /** Medianoche de Lima de cada día del período, en orden. */
  days: Date[];
  /** La fecha del período anterior y siguiente, para navegar. */
  previous: Date;
  next: Date;
  /** Solo en el mes: el mes propiamente dicho, dentro de la rejilla. */
  monthStart?: Date;
  monthEnd?: Date;
}

/** Medianoche de Lima del primer día del mes que contiene `date`. */
export function limaMonthStart(date: Date): Date {
  const iso = getLimaIsoDate(date);

  return limaDayStartFromIso(`${iso.slice(0, 7)}-01`) as Date;
}

/** El primer día del mes desplazado `delta` meses. */
export function limaAddMonths(monthStart: Date, delta: number): Date {
  const [year, month] = getLimaIsoDate(monthStart).split("-").map(Number);
  const shifted = new Date(Date.UTC(year as number, (month as number) - 1 + delta, 1));
  const iso = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-01`;

  return limaDayStartFromIso(iso) as Date;
}

export function recoveryAgendaPeriod(
  view: RecoveryAgendaView,
  date: Date,
): RecoveryAgendaPeriod {
  if (view === "mes") {
    // Rejilla de semanas completas, de lunes a domingo, que cubre el mes.
    const monthStart = limaMonthStart(date);
    const monthEnd = limaAddMonths(monthStart, 1);
    const start = new Date(
      monthStart.getTime() - limaWeekdayIndex(monthStart) * dayMs,
    );
    const lastDay = new Date(monthEnd.getTime() - dayMs);
    const end = new Date(
      lastDay.getTime() + (7 - limaWeekdayIndex(lastDay)) * dayMs,
    );
    const length = Math.round((end.getTime() - start.getTime()) / dayMs);

    return {
      view,
      start,
      end,
      days: Array.from(
        { length },
        (_, index) => new Date(start.getTime() + index * dayMs),
      ),
      previous: limaAddMonths(monthStart, -1),
      next: monthEnd,
      monthStart,
      monthEnd,
    };
  }

  const length = recoveryAgendaUpcomingDays;
  const days = Array.from(
    { length },
    (_, index) => new Date(date.getTime() + index * dayMs),
  );

  return {
    view,
    start: date,
    end: new Date(date.getTime() + length * dayMs),
    days,
    previous: new Date(date.getTime() - length * dayMs),
    next: new Date(date.getTime() + length * dayMs),
  };
}

/** Hora y minuto de Lima de un instante, para colocarlo en la cuadrícula. */
export function limaHourMinute(value: Date): { hour: number; minute: number } {
  const shifted = new Date(value.getTime() - 5 * 60 * 60 * 1000);

  return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}
