"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { SendOrderToRecoveryActionState } from "./recovery-action.types";

/**
 * Reasignación de un caso del carril interno — SPEC-030 BR-029, BR-030,
 * BR-065 y BR-067.
 *
 * - Un caso Crítico jamás puede asignarse al asesor que originó la venta,
 *   sin excepción de rol.
 * - Un supervisor solo asigna dentro de sus equipos y no puede asignarse
 *   casos a sí mismo; ADMIN sí puede asignarle nominalmente.
 */
const assignerRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

const openStatuses = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;

const firstContactMs = 2 * 60 * 60 * 1000;

export async function assignSalesRecoveryCaseAction(
  previousState: SendOrderToRecoveryActionState,
  formData: FormData,
): Promise<SendOrderToRecoveryActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  if (!assignerRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const caseId = String(formData.get("caseId") ?? "").trim();
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();

  if (!caseId || !targetUserId) {
    return { type: "error", message: "Elige el caso y el asesor destino." };
  }

  if (membership.role === "SUPERVISOR" && targetUserId === session.user.id) {
    return {
      type: "error",
      message:
        "No puedes asignarte casos a ti mismo. Pide a administración que lo haga nominalmente.",
    };
  }

  const outcome = await database.$transaction(async (transaction) => {
    const supervisedTeamIds =
      membership.role === "SUPERVISOR"
        ? (
            await transaction.commercialTeamMember.findMany({
              where: {
                userId: session.user.id,
                memberRole: "SUPERVISOR",
                isActive: true,
                team: {
                  organizationId: membership.organization.id,
                  status: "ACTIVE",
                },
              },
              select: { teamId: true },
            })
          ).map((item) => item.teamId)
        : null;

    const recoveryCase = await transaction.recoveryCase.findFirst({
      where: {
        id: caseId,
        organizationId: membership.organization.id,
        source: { in: ["INTERNAL_ORDER_STATE", "MANUAL"] },
        status: { in: [...openStatuses] },
        ...(supervisedTeamIds
          ? {
              OR: [
                { assignedTeamId: { in: supervisedTeamIds } },
                { originalTeamId: { in: supervisedTeamIds } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        priority: true,
        originalAgentUserId: true,
        assignedUserId: true,
        holderName: true,
      },
    });

    if (!recoveryCase) return { kind: "NOT_FOUND" as const };

    // BR-065: la Crítica nunca vuelve al originador, sin excepción de rol.
    if (
      recoveryCase.priority === "CRITICA" &&
      targetUserId === recoveryCase.originalAgentUserId
    ) {
      return { kind: "ORIGINATOR_BLOCKED" as const };
    }

    const targetMembership = await transaction.commercialTeamMember.findFirst({
      where: {
        userId: targetUserId,
        salesEnabled: true,
        isActive: true,
        isPrimary: true,
        team: {
          organizationId: membership.organization.id,
          status: "ACTIVE",
          ...(supervisedTeamIds ? { id: { in: supervisedTeamIds } } : {}),
        },
        user: { status: "ACTIVE" },
      },
      select: { teamId: true, user: { select: { name: true } } },
    });

    if (!targetMembership) return { kind: "TARGET_INVALID" as const };

    const now = new Date();
    await transaction.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        assignedUserId: targetUserId,
        assignedTeamId: targetMembership.teamId,
        claimedAt: now,
        status: recoveryCase.status === "SCHEDULED" ? "SCHEDULED" : "ASSIGNED",
        // El nuevo responsable recibe su propio reloj de primer contacto;
        // una agenda pactada con el cliente no se pisa.
        ...(recoveryCase.status === "SCHEDULED"
          ? {}
          : { nextActionAt: new Date(now.getTime() + firstContactMs) }),
      },
    });

    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId: membership.organization.id,
        caseId: recoveryCase.id,
        type: "ASSIGNED_TO_USER",
        actorUserId: session.user.id,
        previousStatus: recoveryCase.status,
        newStatus:
          recoveryCase.status === "SCHEDULED" ? "SCHEDULED" : "ASSIGNED",
        metadata: {
          targetUserId,
          targetTeamId: targetMembership.teamId,
          previousAssignedUserId: recoveryCase.assignedUserId,
        },
      },
    });

    return {
      kind: "DONE" as const,
      holderName: recoveryCase.holderName,
      targetName: targetMembership.user.name,
    };
  });

  if (outcome.kind === "NOT_FOUND") {
    return {
      type: "error",
      message: "El caso no existe, ya se resolvió o no pertenece a tus equipos.",
    };
  }
  if (outcome.kind === "ORIGINATOR_BLOCKED") {
    return {
      type: "error",
      message:
        "Un caso crítico por promesa incorrecta nunca vuelve al asesor que originó la venta.",
    };
  }
  if (outcome.kind === "TARGET_INVALID") {
    return {
      type: "error",
      message:
        "El asesor destino no está activo con venta habilitada en tus equipos.",
    };
  }

  revalidatePath("/recovery/sales");
  revalidatePath("/orders");

  return {
    type: "success",
    message: `Caso de ${outcome.holderName} asignado a ${outcome.targetName}. Su primer contacto vence en 2 horas.`,
  };
}
