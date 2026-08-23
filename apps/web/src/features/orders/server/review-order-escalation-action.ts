"use server";

import { revalidatePath } from "next/cache";

import {
  canReviewDitoOrderEscalation,
  ditoOrderEscalationReviewSchema,
  resolveDitoOrderVisibility,
} from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { OrderEscalationActionState } from "./order-escalation-action.types";

class EscalationReviewError extends Error {}

export async function reviewOrderEscalationAction(
  previousState: OrderEscalationActionState,
  formData: FormData,
): Promise<OrderEscalationActionState> {
  void previousState;
  const { session, membership } = await requireCommercialAccess();
  const parsed = ditoOrderEscalationReviewSchema.safeParse({
    escalationId: formData.get("escalationId"),
    decision: formData.get("decision"),
    response: formData.get("response"),
    tdpTemplate: formData.get("tdpTemplate") ?? "",
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      type: "error",
      message: "Revisa la respuesta al asesor.",
      fieldErrors: {
        decision: errors.decision?.[0],
        response: errors.response?.[0],
      },
    };
  }

  try {
    const orderCode = await database.$transaction(async (transaction) => {
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
          : [];
      const escalation = await transaction.deliveryEscalation.findFirst({
        where: {
          id: parsed.data.escalationId,
          organizationId: membership.organization.id,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
        select: {
          id: true,
          status: true,
          createdByUserId: true,
          ditoOrder: {
            select: {
              id: true,
              orderCodeRaw: true,
              agentUserId: true,
              assignedTeamId: true,
              updatedAt: true,
            },
          },
        },
      });
      if (!escalation) {
        throw new EscalationReviewError("La incidencia ya fue resuelta.");
      }
      const visibility = resolveDitoOrderVisibility({
        role: membership.role,
        userId: session.user.id,
        supervisedTeamIds,
        orderAgentUserId: escalation.ditoOrder.agentUserId,
        orderAssignedTeamId: escalation.ditoOrder.assignedTeamId,
        salesEnabled: false,
      });
      if (
        !canReviewDitoOrderEscalation({
          role: membership.role,
          visibility,
          isRequester: escalation.createdByUserId === session.user.id,
        })
      ) {
        throw new EscalationReviewError(
          "No tienes permiso para revisar esta incidencia.",
        );
      }

      const reviewedAt = new Date();
      const resolving = parsed.data.decision === "RESOLVE";
      const escalatingToTdp = parsed.data.decision === "ESCALATE_TDP";
      const updated = await transaction.deliveryEscalation.updateMany({
        where: {
          id: escalation.id,
          organizationId: membership.organization.id,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
        data: resolving
          ? {
              status: "RESOLVED",
              acknowledgedByUserId:
                escalation.status === "OPEN" ? session.user.id : undefined,
              acknowledgedAt:
                escalation.status === "OPEN" ? reviewedAt : undefined,
              resolvedByUserId: session.user.id,
              resolvedAt: reviewedAt,
              resolution: parsed.data.response,
            }
          : escalatingToTdp
            ? {
                status: "ACKNOWLEDGED",
                acknowledgedByUserId: session.user.id,
                acknowledgedAt: reviewedAt,
                acknowledgement:
                  parsed.data.response ||
                  "Escalado al área responsable en TDP.",
                tdpTemplate: parsed.data.tdpTemplate,
                tdpEscalatedByUserId: session.user.id,
                tdpEscalatedAt: reviewedAt,
              }
            : {
                status: "ACKNOWLEDGED",
                acknowledgedByUserId: session.user.id,
                acknowledgedAt: reviewedAt,
                acknowledgement: parsed.data.response || null,
              },
      });
      if (updated.count !== 1) {
        throw new EscalationReviewError(
          "Otro usuario ya atendió esta incidencia. Recarga la bandeja.",
        );
      }
      await transaction.ditoOrder.update({
        where: { id: escalation.ditoOrder.id },
        data: { updatedAt: reviewedAt },
      });
      return escalation.ditoOrder.orderCodeRaw;
    });

    revalidatePath("/orders");
    return {
      type: "success",
      message:
        parsed.data.decision === "RESOLVE"
          ? `Incidencia de ${orderCode} resuelta.`
          : parsed.data.decision === "ESCALATE_TDP"
            ? `Ticket de ${orderCode} preparado y escalado a TDP.`
            : `Incidencia de ${orderCode} marcada como atendida.`,
    };
  } catch (error) {
    if (error instanceof EscalationReviewError) {
      return { type: "conflict", message: error.message };
    }
    console.error("No se pudo revisar la incidencia", error);
    return {
      type: "error",
      message: "No se pudo guardar la respuesta. Inténtalo nuevamente.",
    };
  }
}
