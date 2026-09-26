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
  { value: "hoy", label: "Con gestión en el período" },
  { value: "no", label: "Sin gestión en el período" },
] as const;

/**
 * SPEC-070 BR-004: cuánto lleva la cartera sin que nadie la toque. Un caso
 * sin gestiones cuenta desde que se asignó.
 */
export type RecoveryIdleFilter = "hoy" | "3" | "7";

export const recoveryIdleOptions: ReadonlyArray<{
  value: RecoveryIdleFilter;
  label: string;
}> = [
  { value: "hoy", label: "Sin gestión hoy" },
  { value: "3", label: "3 días o más" },
  { value: "7", label: "7 días o más" },
];

/** SPEC-070 BR-010: días sin gestión para devolverlo a los casos libres. */
export const recoveryStaleDays = 7;

const dayMs = 24 * 60 * 60 * 1000;

/** El último toque: la última gestión o, sin gestiones, la asignación. */
export function recoveryLastTouchAt(item: {
  lastAttemptAt: Date | null;
  claimedAt: Date | null;
}): Date | null {
  return item.lastAttemptAt ?? item.claimedAt;
}

/** Días enteros desde el último toque; `null` si no hay ninguno. */
export function recoveryDaysUntouched(
  item: { lastAttemptAt: Date | null; claimedAt: Date | null },
  now: Date,
): number | null {
  const touch = recoveryLastTouchAt(item);
  if (!touch) return null;

  return Math.floor((now.getTime() - touch.getTime()) / dayMs);
}

/**
 * SPEC-070 BR-010: se puede devolver a los casos libres del equipo lo que
 * lleva `recoveryStaleDays` sin gestión, no tiene una cita pendiente y no
 * está en verificación. Lo decide el supervisor; nada se devuelve solo.
 */
export function isRecoveryCaseStale(
  item: {
    status: string;
    lastAttemptAt: Date | null;
    claimedAt: Date | null;
    hasPendingCommitment: boolean;
  },
  now: Date,
): boolean {
  if (item.status !== "ASSIGNED" && item.status !== "IN_PROGRESS") return false;
  if (item.hasPendingCommitment) return false;
  const days = recoveryDaysUntouched(item, now);

  return days !== null && days >= recoveryStaleDays;
}

export interface FollowUpCaseLike {
  status: string;
  firstContactAt: Date | null;
  nextActionAt: Date | null;
  /** Resultado del intento más reciente; `null` si nunca hubo (BR-002). */
  lastResult: string | null;
  /** Intentos registrados hoy, en día de Lima (BR-006). */
  attemptsToday: number;
  /**
   * Intentos dentro del período de actividad elegido (SPEC-045 PL-09). Con
   * el período «hoy» coincide con `attemptsToday`.
   */
  attemptsInPeriod: number;
  /** SPEC-070: para «sin tocar desde». */
  lastAttemptAt?: Date | null;
  claimedAt?: Date | null;
}

export interface FollowUpFilters {
  /** Resultado exacto del último intento, o `recoveryLastResultNone`. */
  lastResult?: string | null;
  nextAction?: RecoveryNextActionBucket | null;
  contact?: "sin" | "con" | null;
  worked?: "hoy" | "no" | null;
  status?: RecoveryFollowUpStatus | null;
  /** SPEC-070 BR-008: sin gestión hoy, o hace 3 o 7 días o más. */
  idle?: RecoveryIdleFilter | null;
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
        filters.lastResult === recoveryLastResultNone
          ? null
          : filters.lastResult;

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

    // PL-09: «con gestión» se mide en el período de actividad, no solo hoy.
    if (filters.worked === "hoy" && item.attemptsInPeriod === 0) return false;
    if (filters.worked === "no" && item.attemptsInPeriod > 0) return false;

    if (filters.idle === "hoy" && item.attemptsToday > 0) return false;
    if (filters.idle === "3" || filters.idle === "7") {
      const days = recoveryDaysUntouched(
        {
          lastAttemptAt: item.lastAttemptAt ?? null,
          claimedAt: item.claimedAt ?? null,
        },
        now,
      );
      if (days === null || days < Number(filters.idle)) return false;
    }

    return true;
  });
}

export interface FollowUpAdvisorSummary {
  advisorId: string;
  name: string;
  portfolio: number;
  /** Sin gestión hace `recoveryStaleDays` días o más. */
  stale: number;
  /** Los que se pueden devolver (BR-010): sin cita pendiente ni verificación. */
  releasable: number;
  workedToday: number;
  agendaOverdue: number;
}

/**
 * SPEC-070 BR-004: la cartera por asesor, primero quien más tiene sin tocar.
 */
export function summarizeFollowUpByAdvisor(
  cases: ReadonlyArray<{
    advisorId: string | null;
    advisorName: string;
    status: string;
    nextActionAt: Date | null;
    attemptsToday: number;
    lastAttemptAt: Date | null;
    claimedAt: Date | null;
    hasPendingCommitment: boolean;
  }>,
  now: Date,
): FollowUpAdvisorSummary[] {
  const groups = new Map<string, FollowUpAdvisorSummary>();

  for (const item of cases) {
    if (!item.advisorId) continue;
    const group = groups.get(item.advisorId) ?? {
      advisorId: item.advisorId,
      name: item.advisorName,
      portfolio: 0,
      stale: 0,
      releasable: 0,
      workedToday: 0,
      agendaOverdue: 0,
    };
    group.portfolio += 1;
    const days = recoveryDaysUntouched(item, now);
    if (days !== null && days >= recoveryStaleDays) group.stale += 1;
    if (isRecoveryCaseStale(item, now)) group.releasable += 1;
    if (item.attemptsToday > 0) group.workedToday += 1;
    if (
      item.status === "SCHEDULED" &&
      recoveryNextActionBucket(item.nextActionAt, now) === "vencida"
    ) {
      group.agendaOverdue += 1;
    }
    groups.set(item.advisorId, group);
  }

  return [...groups.values()].sort(
    (left, right) =>
      right.stale - left.stale ||
      right.portfolio - left.portfolio ||
      left.name.localeCompare(right.name, "es"),
  );
}
