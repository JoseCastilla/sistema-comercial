/**
 * Períodos de «Mi agenda» — SPEC-048 BR-013.
 *
 * Semana (lunes a domingo de Lima), día y lista (siete días desde la fecha
 * elegida). Todo se corta a medianoche de Lima (-05:00, sin horario de
 * verano) para que un martes sea el mismo martes en cualquier servidor.
 */
import { getLimaIsoDate } from "./order-period.js";

export const recoveryAgendaViews = ["semana", "dia", "lista"] as const;
export type RecoveryAgendaView = (typeof recoveryAgendaViews)[number];

export const recoveryAgendaViewLabels: Record<RecoveryAgendaView, string> = {
  semana: "Semana",
  dia: "Día",
  lista: "Lista",
};

export function parseRecoveryAgendaView(
  value: string | null | undefined,
): RecoveryAgendaView {
  const text = String(value ?? "").trim();

  return recoveryAgendaViews.includes(text as RecoveryAgendaView)
    ? (text as RecoveryAgendaView)
    : "semana";
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
}

export function recoveryAgendaPeriod(
  view: RecoveryAgendaView,
  date: Date,
): RecoveryAgendaPeriod {
  const length = view === "dia" ? 1 : 7;
  const start =
    view === "semana"
      ? new Date(date.getTime() - limaWeekdayIndex(date) * dayMs)
      : date;
  const days = Array.from(
    { length },
    (_, index) => new Date(start.getTime() + index * dayMs),
  );

  return {
    view,
    start,
    end: new Date(start.getTime() + length * dayMs),
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

/** Jornada que dibuja la cuadrícula (spec §5); una cita fuera la extiende. */
export const recoveryAgendaWorkdayHours = { from: 8, to: 20 } as const;

export function recoveryAgendaGridHours(
  timedHours: ReadonlyArray<number>,
): number[] {
  const from = Math.min(recoveryAgendaWorkdayHours.from, ...timedHours);
  const to = Math.max(recoveryAgendaWorkdayHours.to, ...timedHours);

  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}
