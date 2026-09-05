/**
 * Seguimiento de la cartera asignada — SPEC-040.
 *
 * Tres preguntas que ningún `where` responde limpio: cuál fue el resultado
 * del intento **más reciente**, en qué tramo cae la próxima acción según la
 * hora de Lima, y si el caso sigue sin primer contacto. El tablero ya las
 * resuelve en memoria sobre la cartera asignada; esta regla es la misma
 * función, escrita una vez y probada, para que el indicador y la lista que
 * abre cuenten exactamente lo mismo (BR-001).
 */
import { getLimaIsoDate } from "./order-period.js";

/** Estados de un caso de base con asesor: la cartera viva. */
export const recoveryFollowUpStatuses = [
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;

export type RecoveryFollowUpStatus = (typeof recoveryFollowUpStatuses)[number];

export const recoveryFollowUpStatusOptions: ReadonlyArray<{
  value: RecoveryFollowUpStatus;
  label: string;
}> = [
  { value: "ASSIGNED", label: "Asignado" },
  { value: "IN_PROGRESS", label: "En gestión" },
  { value: "SCHEDULED", label: "Agendado" },
  { value: "WAITING", label: "Esperando confirmación" },
];

/**
 * Tramos de próxima acción, excluyentes y sobre la hora de Lima (BR-003):
 * nada cae en dos ni fuera de todos, así que no hay solapamientos que
 * explicar.
 */
export type RecoveryNextActionBucket = "vencida" | "hoy" | "futura" | "sin";

export const recoveryNextActionBuckets: ReadonlyArray<{
  value: RecoveryNextActionBucket;
  label: string;
}> = [
  { value: "vencida", label: "Vencida" },
  { value: "hoy", label: "Hoy" },
  { value: "futura", label: "Futura" },
  { value: "sin", label: "Sin fecha" },
];

function limaNextMidnight(now: Date): Date {
  const start = new Date(`${getLimaIsoDate(now)}T00:00:00-05:00`);

  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function recoveryNextActionBucket(
  nextActionAt: Date | null,
  now: Date,
): RecoveryNextActionBucket {
  if (nextActionAt === null) return "sin";
  if (nextActionAt.getTime() < now.getTime()) return "vencida";
  if (nextActionAt.getTime() < limaNextMidnight(now).getTime()) return "hoy";

  return "futura";
}

/** Valor del filtro de última tipificación para «nunca tuvo intentos». */
export const recoveryLastResultNone = "SIN_GESTION";

export const recoveryFollowUpContactOptions = [
  { value: "sin", label: "Sin primer contacto" },
  { value: "con", label: "Con primer contacto" },
] as const;

export const recoveryFollowUpWorkedOptions = [
  { value: "hoy", label: "Con gestión hoy" },
  { value: "no", label: "Sin gestión hoy" },
] as const;

export interface FollowUpCaseLike {
  status: string;
  firstContactAt: Date | null;
  nextActionAt: Date | null;
  /** Resultado del intento más reciente; `null` si nunca hubo (BR-002). */
  lastResult: string | null;
  /** Intentos registrados hoy, en día de Lima (BR-006). */
  attemptsToday: number;
}

export interface FollowUpFilters {
  /** Resultado exacto del último intento, o `recoveryLastResultNone`. */
  lastResult?: string | null;
  nextAction?: RecoveryNextActionBucket | null;
  contact?: "sin" | "con" | null;
  worked?: "hoy" | "no" | null;
  status?: RecoveryFollowUpStatus | null;
}

/**
 * BR-053, tal como lo cuenta el tablero: sin primer contacto y no en espera
 * — un caso en verificación no es un caso al que nadie llamó.
 */
export function isWithoutFirstContact(item: {
  status: string;
  firstContactAt: Date | null;
}): boolean {
  return item.firstContactAt === null && item.status !== "WAITING";
}

export function selectFollowUpCases<T extends FollowUpCaseLike>(
  cases: readonly T[],
  filters: FollowUpFilters,
  now: Date,
): T[] {
  return cases.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;

    if (filters.lastResult) {
      const expected =
        filters.lastResult === recoveryLastResultNone ? null : filters.lastResult;

      if (item.lastResult !== expected) return false;
    }

    if (
      filters.nextAction &&
      recoveryNextActionBucket(item.nextActionAt, now) !== filters.nextAction
    ) {
      return false;
    }

    if (filters.contact === "sin" && !isWithoutFirstContact(item)) return false;
    if (filters.contact === "con" && isWithoutFirstContact(item)) return false;

    if (filters.worked === "hoy" && item.attemptsToday === 0) return false;
    if (filters.worked === "no" && item.attemptsToday > 0) return false;

    return true;
  });
}
