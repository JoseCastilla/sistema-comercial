import "server-only";

import {
  baseRecoveryPoolReturnDays,
  shouldReturnBaseCaseToPool,
} from "@repo/validation";

import { database } from "@/server/database";

/**
 * BR-077: un caso de base asignado sin ningún intento durante dos días
 * vuelve solo al pool de su equipo, conservando el historial de la
 * asignación. El barrido es perezoso e idempotente: corre al abrir las
 * superficies de campaña y antes de cada toma del pool, de modo que nadie
 * cargue inventario muerto sin necesitar un proceso programado.
 */
export async function returnStaleBaseCasesToPool(
  organizationId: string,
): Promise<number> {
  const now = new Date();
  const threshold = new Date(
    now.getTime() - baseRecoveryPoolReturnDays * 24 * 60 * 60 * 1000,
  );

  const candidates = await database.recoveryCase.findMany({
    where: {
      organizationId,
      source: "NATIONAL_BASE",
      status: "ASSIGNED",
      claimedAt: { lte: threshold },
    },
    select: {
      id: true,
      claimedAt: true,
      assignedUserId: true,
      assignedTeamId: true,
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    take: 500,
  });

  const stale = candidates.filter(
    (item) =>
      item.claimedAt !== null &&
      shouldReturnBaseCaseToPool({
        claimedAt: item.claimedAt,
        lastAttemptAt: item.attempts[0]?.createdAt ?? null,
        now,
      }),
  );

  if (stale.length === 0) return 0;

  await database.$transaction(async (transaction) => {
    const affected = await transaction.recoveryCase.updateMany({
      where: {
        id: { in: stale.map((item) => item.id) },
        status: "ASSIGNED",
      },
      data: {
        status: "OPEN",
        assignedUserId: null,
        claimedAt: null,
        nextActionAt: null,
      },
    });

    if (affected.count === 0) return;

    await transaction.recoveryCaseEvent.createMany({
      data: stale.map((item) => ({
        organizationId,
        caseId: item.id,
        type: "ASSIGNED_TO_TEAM" as const,
        previousStatus: "ASSIGNED" as const,
        newStatus: "OPEN" as const,
        observation:
          "Retorno automático al pool: dos días asignado sin ningún intento (BR-077).",
        metadata: {
          mode: "RETORNO_POOL",
          teamId: item.assignedTeamId,
          previousAssignedUserId: item.assignedUserId,
        },
      })),
    });
  });

  return stale.length;
}
