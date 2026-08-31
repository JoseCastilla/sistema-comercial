import {
  getLimaDayOfMonth,
  getPerformanceCommissionPolicy,
} from "./performance-metrics.js";

import type { PerformanceAcceleratorWindow } from "./performance-metrics.js";

export type PerformanceQuotaWindowKey = "ONE" | "TWO";

export interface QuotaDistributionSummary {
  teamTarget: number;
  assignedTarget: number;
  /** Positivo cuando falta repartir; negativo cuando se repartió de más. */
  remaining: number;
  covers: boolean;
}

function windows(): PerformanceAcceleratorWindow[] {
  return getPerformanceCommissionPolicy().acceleratorWindows;
}

function containsDay(
  window: PerformanceAcceleratorWindow,
  day: number,
): boolean {
  if (day < window.windowStartDay) return false;
  return window.windowEndDay === null || day <= window.windowEndDay;
}

/**
 * La ventana que contiene el día, o `null` en los días 16 al 24, que quedan
 * deliberadamente fuera de todo acelerador (SPEC-038 BR-002).
 */
export function resolveCurrentAcceleratorWindow(
  reference: Date,
): PerformanceAcceleratorWindow | null {
  const day = getLimaDayOfMonth(reference);
  return windows().find((window) => containsDay(window, day)) ?? null;
}

/**
 * La ventana sobre la que hablar hoy: la vigente si la hay, y si no la última
 * que cerró, para no mostrar un contador vacío entre ventanas
 * (SPEC-038 BR-015).
 */
export function resolveRelevantAcceleratorWindow(
  reference: Date,
): PerformanceAcceleratorWindow | null {
  const current = resolveCurrentAcceleratorWindow(reference);
  if (current) return current;

  const day = getLimaDayOfMonth(reference);
  const closed = windows().filter(
    (window) => window.windowEndDay !== null && window.windowEndDay < day,
  );
  return closed[closed.length - 1] ?? null;
}

/**
 * La cuota por defecto de una ventana es su primer tramo: el objetivo que ya
 * significa dinero, para que el sistema sirva sin configurar nada
 * (SPEC-038 BR-008).
 */
export function getDefaultQuotaTarget(
  windowKey: PerformanceQuotaWindowKey,
): number {
  const window = windows().find((item) => item.key === windowKey);
  return window?.tiers[0]?.target ?? 0;
}

/**
 * BR-009: repartir de menos advierte pero no bloquea, porque ante ausencias
 * puede ser una decisión consciente del supervisor.
 */
export function summarizeQuotaDistribution(input: {
  teamTarget: number;
  advisorTargets: readonly number[];
}): QuotaDistributionSummary {
  const assignedTarget = input.advisorTargets.reduce(
    (total, target) => total + target,
    0,
  );

  return {
    teamTarget: input.teamTarget,
    assignedTarget,
    remaining: input.teamTarget - assignedTarget,
    covers: assignedTarget >= input.teamTarget,
  };
}

/**
 * BR-010: la cuota de un período terminado queda congelada; cambiarla
 * reescribiría la historia de cumplimiento.
 */
export function isQuotaPeriodEditable(
  periodKey: string,
  currentPeriodKey: string,
): boolean {
  return periodKey >= currentPeriodKey;
}

const limaMonthKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
});

/** Cuántos meses hacia adelante se puede planificar una cuota. */
export const quotaPlanningHorizonMonths = 12;

/**
 * Una cuota es un objetivo que se fija **antes** del período, así que su
 * selector de mes admite el futuro. El parser del dashboard no sirve aquí:
 * recorta al mes actual, porque un mes futuro no tiene resultados que
 * mostrar (SPEC-038 BR-010b).
 */
export function parseQuotaPeriod(value: unknown, now = new Date()): string {
  const current = limaMonthKeyFormatter.format(now);
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    return current;
  }

  const [year = 0, month = 0] = value.split("-").map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return current;

  // El pasado se admite para consultar cuotas ya congeladas; el futuro, hasta
  // el horizonte de planificación.
  return value <= getQuotaPlanningLimit(now) ? value : current;
}

export function getQuotaPlanningLimit(now = new Date()): string {
  const current = limaMonthKeyFormatter.format(now);
  const [year = 0, month = 0] = current.split("-").map(Number);
  const limit = new Date(
    Date.UTC(year, month - 1 + quotaPlanningHorizonMonths, 1),
  );
  return `${limit.getUTCFullYear()}-${String(limit.getUTCMonth() + 1).padStart(2, "0")}`;
}
