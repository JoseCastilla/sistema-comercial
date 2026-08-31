"use server";

import { revalidatePath } from "next/cache";

import {
  canCancelDitoOrder,
  ditoOrderCancellationReviewSchema,
  normalizeDitoOrderState,
  resolveDitoDeliveredAt,
  resolveDitoOrderVisibility,
} from "@repo/validation";

import { openInternalRecoveryCase } from "@/features/recovery/server/open-internal-recovery-case";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { OrderCancellationActionState } from "./order-cancellation-action.types";

class CancellationReviewError extends Error {}

export async function reviewOrderCancellationAction(
  previousState: OrderCancellationActionState,
  formData: FormData,
): Promise<OrderCancellationActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();
  const parsed = ditoOrderCancellationReviewSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    observation: formData.get("observation"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;

    return {
      type: "error",
      message: "Revisa la decisión de cancelación.",
      fieldErrors: {
        decision: errors.decision?.[0],
        observation: errors.observation?.[0],
      },
    };
  }

  try {
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
            ).map((teamMembership) => teamMembership.teamId)
          : [];
      const primarySalesMembership =
        membership.role === "SUPERVISOR"
          ? await transaction.commercialTeamMember.findFirst({
              where: {
                userId: session.user.id,
                salesEnabled: true,
                isPrimary: true,
                isActive: true,
                team: {
                  organizationId: membership.organization.id,
                  status: "ACTIVE",
                },
              },
              select: { teamId: true },
            })
          : null;
      const salesEnabled = primarySalesMembership !== null;

      const request = await transaction.ditoOrderCancellationRequest.findFirst({
        where: {
          id: parsed.data.requestId,
          organizationId: membership.organization.id,
          status: "PENDING",
        },
        select: {
          id: true,
          reason: true,
          requestedByUserId: true,
          ditoOrder: {
            select: {
              id: true,
              orderCodeRaw: true,
              agentUserId: true,
              assignedTeamId: true,
              status: true,
              sentSubstatus: true,
              deliveryStatus: true,
              noStatusDetectedAt: true,
              statusUpdatedAt: true,
              sentSubstatusUpdatedAt: true,
              deliveredAt: true,
              updatedAt: true,
              holderFullNameRaw: true,
              holderDocumentNumber: true,
              registeredAt: true,
              department: true,
              province: true,
              district: true,
              agrDeliverySnapshot: {
                select: { motivoRechazo: true, submotivoRechazo: true },
              },
            },
          },
        },
      });

      if (!request) {
        throw new CancellationReviewError(
          "La solicitud ya fue resuelta o no está disponible.",
        );
      }

      const order = request.ditoOrder;
      const visibility = resolveDitoOrderVisibility({
        role: membership.role,
        userId: session.user.id,
        supervisedTeamIds,
        orderAgentUserId: order.agentUserId,
        orderAssignedTeamId: order.assignedTeamId,
        salesEnabled,
      });
      const isOwnOrder = order.agentUserId === session.user.id;

      if (
        !canCancelDitoOrder({
          role: membership.role,
          visibility,
          isOwnOrder,
        })
      ) {
        throw new CancellationReviewError(
          "No tienes permiso para revisar esta solicitud.",
        );
      }

      if (request.requestedByUserId === session.user.id) {
        throw new CancellationReviewError(
          "La solicitud debe ser revisada por un usuario diferente al solicitante.",
        );
      }

      if (order.status === "CLOSED" || order.status === "CANCELLED") {
        throw new CancellationReviewError(
          "La orden ya está finalizada y la solicitud no puede aplicarse.",
        );
      }

      const reviewedAt = new Date();
      const reviewUpdate =
        await transaction.ditoOrderCancellationRequest.updateMany({
          where: {
            id: request.id,
            organizationId: membership.organization.id,
            status: "PENDING",
          },
          data: {
            status:
              parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
            reviewedByUserId: session.user.id,
            reviewedAt,
            reviewObservation: parsed.data.observation,
          },
        });

      if (reviewUpdate.count !== 1) {
        throw new CancellationReviewError(
          "Otro usuario ya resolvió esta solicitud. Recarga la bandeja.",
        );
      }

      if (parsed.data.decision === "REJECT") {
        const touchedOrder = await transaction.ditoOrder.updateMany({
          where: {
            id: order.id,
            organizationId: membership.organization.id,
            updatedAt: order.updatedAt,
          },
          data: { updatedAt: reviewedAt },
        });

        if (touchedOrder.count !== 1) {
          throw new CancellationReviewError(
            "La orden cambió durante la revisión. Recarga la bandeja.",
          );
        }

        return {
          decision: "REJECT" as const,
          orderCode: order.orderCodeRaw,
        };
      }

      const normalized = normalizeDitoOrderState({
        statusRaw: "CANCELLED",
        sentSubstatusRaw: null,
        occurredAt: reviewedAt,
        currentNoStatusDetectedAt: order.noStatusDetectedAt,
      });
      const deliveredAt = resolveDitoDeliveredAt(
        normalized.deliveryStatus,
        order.deliveredAt,
        reviewedAt,
      );

      const orderUpdate = await transaction.ditoOrder.updateMany({
        where: {
          id: order.id,
          organizationId: membership.organization.id,
          updatedAt: order.updatedAt,
        },
        data: {
          status: "CANCELLED",
          statusRaw: "CANCELADO",
          sentSubstatus: null,
          sentSubstatusRaw: null,
          statusUpdatedAt: reviewedAt,
          sentSubstatusUpdatedAt:
            order.sentSubstatus === null
              ? order.sentSubstatusUpdatedAt
              : reviewedAt,
          noStatusDetectedAt: normalized.noStatusDetectedAt,
          deliveryStatus: normalized.deliveryStatus,
          deliveryObservation: request.reason,
          deliveredAt,
        },
      });

      if (orderUpdate.count !== 1) {
        throw new CancellationReviewError(
          "La orden cambió durante la revisión. Recarga la bandeja.",
        );
      }

      await transaction.ditoOrderStatusHistory.create({
        data: {
          organizationId: membership.organization.id,
          ditoOrderId: order.id,
          previousStatus: order.status,
          previousSentSubstatus: order.sentSubstatus,
          newStatus: "CANCELLED",
          newSentSubstatus: null,
          previousDeliveryStatus: order.deliveryStatus,
          newDeliveryStatus: normalized.deliveryStatus,
          previousNoStatusDetectedAt: order.noStatusDetectedAt,
          newNoStatusDetectedAt: normalized.noStatusDetectedAt,
          observation: request.reason,
          changedByUserId: session.user.id,
          changedAt: reviewedAt,
        },
      });

      // SPEC-030 BR-061: una cancelación aprobada también abre la puerta
      // interna de recuperación, con el motivo del asesor como observación.
      await openInternalRecoveryCase(transaction, {
        organizationId: membership.organization.id,
        order: {
          id: order.id,
          agentUserId: order.agentUserId,
          assignedTeamId: order.assignedTeamId,
          holderFullNameRaw: order.holderFullNameRaw,
          holderDocumentNumber: order.holderDocumentNumber,
          registeredAt: order.registeredAt,
          department: order.department,
          province: order.province,
          district: order.district,
        },
        trigger: {
          status: "CANCELLED",
          sentSubstatus: null,
          motivoRechazo: order.agrDeliverySnapshot?.motivoRechazo ?? null,
          submotivoRechazo: order.agrDeliverySnapshot?.submotivoRechazo ?? null,
        },
        actorUserId: session.user.id,
        noveltyAt: reviewedAt,
        observation: request.reason,
      });

      return {
        decision: "APPROVE" as const,
        orderCode: order.orderCodeRaw,
      };
    });

    revalidatePath("/orders");

    return {
      type: "success",
      message:
        outcome.decision === "APPROVE"
          ? `Cancelación de ${outcome.orderCode} aprobada.`
          : `Solicitud de ${outcome.orderCode} rechazada.`,
    };
  } catch (error) {
    if (error instanceof CancellationReviewError) {
      return { type: "conflict", message: error.message };
    }

    console.error("No se pudo revisar la cancelación DITO", error);

    return {
      type: "error",
      message: "No se pudo guardar la decisión. Inténtalo nuevamente.",
    };
  }
}
