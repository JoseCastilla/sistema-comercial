import "server-only";

import { recoveryConsultationMaxAgeDays } from "@repo/validation";

import { database } from "@/server/database";

/**
 * BR-084: un caso en triage o espera que cumple siete días desde su registro
 * sin verificación completa de portabilidad caduca solo, con motivo
 * `VENCIDO`. No cuenta como pérdida (BR-056): nunca fue oportunidad
 * confirmada. Barrido perezoso e idempotente, como el retorno al pool de
 * BR-077: corre al abrir la preparación de campaña y antes de cada
 * exportación de números, para que el embudo drene sin proceso programado.
 */
export async function expireUnverifiedCases(
  organizationId: string,
): Promise<number> {
  const now = new Date();
  const threshold = new Date(
    now.getTime() - recoveryConsultationMaxAgeDays * 24 * 60 * 60 * 1000,
  );

  const stale = await database.recoveryCase.findMany({
    where: {
      organizationId,
      source: "NATIONAL_BASE",
      status: { in: ["TRIAGE", "WAITING"] },
      firstRegisteredAt: { lte: threshold },
      // Sin verificación completa: alguna línea activa sigue sin consultar.
      services: {
        some: { discardedAt: null, portabilityCheckedAt: null },
      },
    },
    select: { id: true, status: true },
    take: 500,
  });

  if (stale.length === 0) return 0;

  await database.$transaction(async (transaction) => {
    await transaction.recoveryCase.updateMany({
      where: { id: { in: stale.map((item) => item.id) } },
      data: {
        status: "DISCARDED",
        discardReason: "VENCIDO",
        resolvedAt: now,
      },
    });

    await transaction.recoveryCaseEvent.createMany({
      data: stale.map((item) => ({
        organizationId,
        caseId: item.id,
        type: "CASE_DISCARDED" as const,
        previousStatus: item.status,
        newStatus: "DISCARDED" as const,
        observation: `Vencido: cumplió ${recoveryConsultationMaxAgeDays} días sin verificación completa de portabilidad (BR-084).`,
        metadata: { reason: "VENCIDO" },
      })),
    });
  });

  return stale.length;
}
