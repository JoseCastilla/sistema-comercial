import type { QuotaDistributionSummary } from "@repo/validation";

export type QuotaDistributionTone = "UNDER" | "EXACT" | "OVER";

/**
 * SPEC-044 SUP-04: el reparto de una cuota se explica con las tres cifras —
 * objetivo, repartido y diferencia— y distingue repartir de menos, justo o
 * de más. Repartir de más o de menos advierte y no bloquea (SPEC-038
 * BR-009): ante ausencias o refuerzos puede ser una decisión consciente.
 */
export function describeQuotaDistribution(
  summary: QuotaDistributionSummary,
  subject = "del equipo",
): { tone: QuotaDistributionTone; text: string } {
  const { teamTarget, assignedTarget, remaining } = summary;

  if (remaining > 0) {
    return {
      tone: "UNDER",
      text: `Objetivo ${subject}: ${teamTarget}. Repartido: ${assignedTarget}. Faltan ${remaining} por repartir.`,
    };
  }
  if (remaining < 0) {
    return {
      tone: "OVER",
      text: `Objetivo ${subject}: ${teamTarget}. Repartido: ${assignedTarget}, ${Math.abs(remaining)} por encima del objetivo. Puede ser deliberado; no bloquea.`,
    };
  }
  return {
    tone: "EXACT",
    text: `Objetivo ${subject}: ${teamTarget}. Repartido: ${assignedTarget}, justo el objetivo.`,
  };
}
