/**
 * Período del tablero de campaña — SPEC-030 fase 5 del plan de usabilidad
 * (BR-094).
 *
 * El tablero nacía «del día»: todo contaba desde la medianoche de Lima. Para
 * revisar actividad histórica hace falta un período, y el período tiene que
 * distinguir tres fechas que no son la misma: la **fecha de gestión** (cuándo
 * se llamó), la **fecha de resolución** (cuándo se recuperó o perdió) y la
 * **fecha de carga** (cuándo entró el caso). La cartera actual —asignados,
 * sin primer contacto, agenda vencida— no tiene período: es el estado de
 * ahora.
 */
import { getLimaIsoDate } from "./order-period.js";

export type RecoveryBoardPeriodKey = "hoy" | "ayer" | "semana" | "mes";

export const recoveryBoardPeriods: ReadonlyArray<{
  value: RecoveryBoardPeriodKey;
  label: string;
}> = [
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "semana", label: "Últimos 7 días" },
  { value: "mes", label: "Últimos 30 días" },
];

export interface RecoveryBoardPeriod {
  key: RecoveryBoardPeriodKey;
  label: string;
  /** Inicio, incluido: medianoche de Lima. */
  start: Date;
  /** Fin, excluido: medianoche de Lima del día siguiente al último. */
  end: Date;
  /** Días calendario que abarca. */
  days: number;
}

const dayMs = 24 * 60 * 60 * 1000;

function limaDayStart(now: Date, offsetDays: number): Date {
  // Lima no cambia de horario: -05:00 vale todo el año.
  const start = new Date(`${getLimaIsoDate(now)}T00:00:00-05:00`);

  return new Date(start.getTime() + offsetDays * dayMs);
}

export function parseRecoveryBoardPeriod(
  value: string | null | undefined,
): RecoveryBoardPeriodKey {
  const text = String(value ?? "").trim();

  return recoveryBoardPeriods.some((period) => period.value === text)
    ? (text as RecoveryBoardPeriodKey)
    : "hoy";
}

/**
 * Resuelve el período a fechas concretas. Un valor desconocido cae en «hoy»:
 * el tablero siempre responde algo, y lo que responde por defecto es el día.
 */
export function resolveRecoveryBoardPeriod(
  value: string | null | undefined,
  now: Date,
): RecoveryBoardPeriod {
  const key = parseRecoveryBoardPeriod(value);
  const today = limaDayStart(now, 0);
  const tomorrow = limaDayStart(now, 1);
  const label =
    recoveryBoardPeriods.find((period) => period.value === key)?.label ??
    "Hoy";

  switch (key) {
    case "hoy":
      return { key, label, start: today, end: tomorrow, days: 1 };
    case "ayer":
      return {
        key,
        label,
        start: limaDayStart(now, -1),
        end: today,
        days: 1,
      };
    case "semana":
      return {
        key,
        label,
        start: limaDayStart(now, -6),
        end: tomorrow,
        days: 7,
      };
    case "mes":
      return {
        key,
        label,
        start: limaDayStart(now, -29),
        end: tomorrow,
        days: 30,
      };
  }
}
