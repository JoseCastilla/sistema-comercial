import { DEFAULT_TIMEZONE, localParts, zonedTimeToUtc } from "@/lib/time";

/**
 * Tope de gasto mensual del asistente (SPEC-058 BR-020).
 *
 * El tope se define en soles y el costo de los turnos se mide en dólares, así
 * que se convierte con un tipo de cambio fijo configurable (`AI_USD_TO_PEN`).
 * No se consulta ninguna cotización: un tope de presupuesto tiene que ser
 * predecible, no moverse solo. Módulo puro.
 */

export const DEFAULT_USD_TO_PEN = 3.7;

/** Tipo de cambio del entorno; con un valor inválido se usa el de siempre. */
export function usdToPenRate(raw: string | undefined = process.env.AI_USD_TO_PEN): number {
  const parsed = Number.parseFloat(String(raw ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_PEN;
}

export type BudgetState = "SIN_TOPE" | "OK" | "AVISO" | "AGOTADO";

export interface BudgetVerdict {
  state: BudgetState;
  spentUsd: number;
  spentPen: number;
  limitPen: number | null;
  /** Fracción del tope ya gastada; 0 cuando no hay tope. */
  ratio: number;
  /** Puede responder el asistente. */
  canRespond: boolean;
}

export const WARNING_RATIO = 0.8;

/** Motivo con el que se deriva la conversación cuando se agotó el tope. */
export const BUDGET_EXHAUSTED_REASON = "tope mensual del asistente alcanzado";

export function budgetVerdict(input: { spentUsd: number; monthlyBudgetPen: number | null; usdToPen?: number }): BudgetVerdict {
  const rate = input.usdToPen && input.usdToPen > 0 ? input.usdToPen : DEFAULT_USD_TO_PEN;
  const spentUsd = Number.isFinite(input.spentUsd) && input.spentUsd > 0 ? input.spentUsd : 0;
  const spentPen = spentUsd * rate;
  const limitPen = input.monthlyBudgetPen !== null && Number.isFinite(input.monthlyBudgetPen) && input.monthlyBudgetPen > 0 ? input.monthlyBudgetPen : null;
  if (limitPen === null) {
    return { state: "SIN_TOPE", spentUsd, spentPen, limitPen: null, ratio: 0, canRespond: true };
  }
  const ratio = spentPen / limitPen;
  if (ratio >= 1) return { state: "AGOTADO", spentUsd, spentPen, limitPen, ratio, canRespond: false };
  if (ratio >= WARNING_RATIO) return { state: "AVISO", spentUsd, spentPen, limitPen, ratio, canRespond: true };
  return { state: "OK", spentUsd, spentPen, limitPen, ratio, canRespond: true };
}

/** Inicio del mes en curso según la zona de la organización, en UTC. */
export function monthStartUtc(now: Date, timeZone = DEFAULT_TIMEZONE): Date {
  const local = localParts(now, timeZone);
  const month = String(local.month).padStart(2, "0");
  return zonedTimeToUtc(`${local.year}-${month}-01`, "00:00", timeZone);
}

export function penAmount(value: number): string {
  return `S/ ${value.toFixed(2)}`;
}
