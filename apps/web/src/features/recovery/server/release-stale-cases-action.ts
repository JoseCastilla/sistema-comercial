"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isRecoveryCaseStale, recoveryStaleDays } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { RecoveryTriageActionState } from "./recovery-action.types";
import type { Prisma } from "@repo/database";

const releaseRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

/**
 * Devolver a los casos libres del equipo — SPEC-070 BR-010 (decisión de José
 * del 25/09/2026). Los casos de campaña de un asesor que llevan siete días
 * sin gestión, sin una cita pendiente y fuera de verificación vuelven al pool
 * de su equipo, igual que el retorno automático de BR-077, pero lo decide el
 * supervisor: un caso gestionado no se mueve solo (SPEC-030 BR-030). Queda
 * un evento por caso con quién lo devolvió y a quién se le quitó.
 */
export async function releaseStaleCasesAction(
  previousState: RecoveryTriageActionState,
  formData: FormData,
): Promise<RecoveryTriageActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  if (!releaseRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const advisorId = String(formData.get("advisorId") ?? "").trim();
  if (!advisorId) {
    return { type: "error", message: "Falta el asesor." };
  }

  // El supervisor solo toca la cartera de los equipos que supervisa.
  const supervisedTeamIds =
    membership.role === "SUPERVISOR"
      ? (
          await database.commercialTeamMember.findMany({
            where: {
              organizationId: membership.organization.id,
              userId: session.user.id,
              memberRole: "SUPERVISOR",
              isActive: true,
              team: { status: "ACTIVE" },
            },
            select: { teamId: true },
          })
        ).map((item) => item.teamId)
      : null;

  const where: Prisma.RecoveryCaseWhereInput = {
    organizationId: membership.organization.id,
    source: "NATIONAL_BASE",
    assignedUserId: advisorId,
    status: { in: ["ASSIGNED", "IN_PROGRESS"] },
    assignedTeamId: supervisedTeamIds
      ? { in: supervisedTeamIds }
      : { not: null },
  };

  const now = new Date();
  const candidates = await database.recoveryCase.findMany({
    where,
    select: {
      id: true,
      status: true,
      claimedAt: true,
      assignedTeamId: true,
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      commitments: {
        where: { status: "PENDING" },
        take: 1,
        select: { id: true },
      },
    },
  });

  const stale = candidates.filter((item) =>
    isRecoveryCaseStale(
      {
        status: String(item.status),
        lastAttemptAt: item.attempts[0]?.createdAt ?? null,
        claimedAt: item.claimedAt,
        hasPendingCommitment: item.commitments.length > 0,
      },
      now,
    ),
  );

  if (stale.length === 0) {
    return {
      type: "success",
      message: `Este asesor no tiene casos con ${recoveryStaleDays} días o más sin gestión.`,
    };
  }

  const released = await database.$transaction(async (transaction) => {
    const affected = await transaction.recoveryCase.updateMany({
      where: {
        id: { in: stale.map((item) => item.id) },
        assignedUserId: advisorId,
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      data: {
        status: "OPEN",
        assignedUserId: null,
        claimedAt: null,
        nextActionAt: null,
      },
    });

    if (affected.count === 0) return 0;

    await transaction.recoveryCaseEvent.createMany({
      data: stale.map((item) => ({
        organizationId: membership.organization.id,
        caseId: item.id,
        type: "ASSIGNED_TO_TEAM" as const,
        actorUserId: session.user.id,
        previousStatus: item.status,
        newStatus: "OPEN" as const,
        observation: `Devuelto a los casos libres del equipo por su supervisor: ${recoveryStaleDays} días o más sin gestión (SPEC-070).`,
        metadata: {
          mode: "LIBERADO_SIN_GESTION",
          teamId: item.assignedTeamId,
          previousAssignedUserId: advisorId,
        },
      })),
    });

    return affected.count;
  });

  revalidatePath("/recovery/follow-up");
  revalidatePath("/recovery/board");
  revalidatePath("/recovery/distribute");
  revalidatePath("/team/today");

  return {
    type: "success",
    message: `${released} ${released === 1 ? "caso volvió" : "casos volvieron"} a los casos libres del equipo.`,
  };
}
