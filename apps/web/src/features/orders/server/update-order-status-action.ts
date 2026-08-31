"use server";

import { revalidatePath } from "next/cache";

import {
  canRequestDitoOrderCancellation,
  canTransitionDitoOrderStatus,
  ditoOrderStatusUpdateSchema,
  normalizeDitoOrderState,
  resolveDitoOrderVisibility,
  resolveDitoDeliveredAt,
  type DitoOrderStatus,
  type DitoSentSubstatus,
} from "@repo/validation";

import {
  closeInternalRecoveryCaseOnDelivery,
  openInternalRecoveryCase,
} from "@/features/recovery/server/open-internal-recovery-case";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { OrderStatusActionState } from "./order-status-action.types";

class OrderStatusUpdateError extends Error {}

function mapStatusRaw(status: DitoOrderStatus): string {
  switch (status) {
    case "OPEN":
      return "ABIERTO";

    case "SENT":
      return "ENVIADO";

    case "CLOSED":
      return "CERRADO";

    case "CANCELLED":
      return "CANCELADO";

    case "UNKNOWN":
      return "DESCONOCIDO";
  }
}

function mapSubstatusRaw(substatus: DitoSentSubstatus | null): string | null {
  switch (substatus) {
    case "NO_STATUS":
      return "SIN ESTADO";

    case "ASSIGNED":
      return "ASIGNADO";

    case "SCHEDULED":
      return "AGENDADO";

    case "NOT_DELIVERED":
      return "NO ENTREGADO";

    case "REJECTED":
      return "RECHAZADO";

    case "DELIVERED":
      return "ENTREGADO";

    case "UNKNOWN":
      return "DESCONOCIDO";

    case null:
      return null;
  }
}

export async function updateOrderStatusAction(
  previousState: OrderStatusActionState,
  formData: FormData,
): Promise<OrderStatusActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  const parsed = ditoOrderStatusUpdateSchema.safeParse({
    orderId: formData.get("orderId"),

    status: formData.get("status"),

    sentSubstatus: formData.get("sentSubstatus"),

    observation: formData.get("observation"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;

    return {
      type: "error",

      message: "Revisa los datos del estado.",

      fieldErrors: {
        status: errors.status?.[0],

        sentSubstatus: errors.sentSubstatus?.[0],

        observation: errors.observation?.[0],
      },
    };
  }

  try {
    const result = await database.$transaction(async (transaction) => {
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
            ).map((membership) => membership.teamId)
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
      const order = await transaction.ditoOrder.findFirst({
        where: {
          id: parsed.data.orderId,

          organizationId: membership.organization.id,
        },

        select: {
          id: true,

          orderCodeRaw: true,

          agentUserId: true,

          assignedTeamId: true,

          status: true,

          sentSubstatus: true,

          deliveryStatus: true,

          deliveryObservation: true,

          closedByUserId: true,

          closedAt: true,

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

          cancellationRequests: {
            where: { status: "PENDING" },
            take: 1,
            select: { id: true },
          },
        },
      });

      if (!order) {
        throw new OrderStatusUpdateError(
          "La orden no existe o pertenece a otra organización.",
        );
      }

      const visibility = resolveDitoOrderVisibility({
        role: membership.role,
        userId: session.user.id,
        supervisedTeamIds,
        orderAgentUserId: order.agentUserId,
        orderAssignedTeamId: order.assignedTeamId,
        salesEnabled,
      });
      const isOwnOrder = order.agentUserId === session.user.id;
      const isSalesOwner =
        isOwnOrder && (membership.role === "AGENT" || salesEnabled);

      if (visibility !== "FULL") {
        throw new OrderStatusUpdateError(
          "No tienes permiso para actualizar esta orden.",
        );
      }

      const changedAt = new Date();

      const normalized = normalizeDitoOrderState({
        statusRaw: parsed.data.status,

        sentSubstatusRaw: parsed.data.sentSubstatus,

        occurredAt: changedAt,

        currentNoStatusDetectedAt: order.noStatusDetectedAt,
      });

      if (normalized.status === "UNKNOWN") {
        throw new OrderStatusUpdateError(
          "El estado seleccionado no es válido.",
        );
      }

      if (isSalesOwner && normalized.status === "CANCELLED") {
        const hasPendingRequest = order.cancellationRequests.length > 0;
        const canRequest = canRequestDitoOrderCancellation({
          role: membership.role,
          visibility,
          currentStatus: order.status,
          hasPendingRequest,
          isSalesOwner,
        });

        if (!canRequest) {
          throw new OrderStatusUpdateError(
            hasPendingRequest
              ? "Esta orden ya tiene una solicitud de cancelación pendiente."
              : "No puedes solicitar la cancelación de esta orden.",
          );
        }

        const reason = parsed.data.observation;

        if (!reason) {
          throw new OrderStatusUpdateError(
            "Indica el motivo de la solicitud de cancelación.",
          );
        }

        const requestedAt = changedAt;
        const touchedOrder = await transaction.ditoOrder.updateMany({
          where: {
            id: order.id,
            organizationId: membership.organization.id,
            updatedAt: order.updatedAt,
          },
          data: { updatedAt: requestedAt },
        });

        if (touchedOrder.count !== 1) {
          throw new OrderStatusUpdateError(
            "La orden fue modificada por otro usuario. Recarga la bandeja e inténtalo nuevamente.",
          );
        }

        await transaction.ditoOrderCancellationRequest.create({
          data: {
            organizationId: membership.organization.id,
            ditoOrderId: order.id,
            reason,
            requestedByUserId: session.user.id,
            requestedAt,
            orderUpdatedAtSnapshot: requestedAt,
          },
        });

        return {
          changed: false,
          cancellationRequested: true,
          orderCode: order.orderCodeRaw,
        };
      }

      if (
        !canTransitionDitoOrderStatus({
          role: membership.role,
          visibility,
          currentStatus: order.status,
          targetStatus: normalized.status,
          isOwnOrder,
        })
      ) {
        if (order.status === "CLOSED" || order.status === "CANCELLED") {
          throw new OrderStatusUpdateError(
            "La orden está finalizada y no puede modificarse desde el seguimiento operativo.",
          );
        }

        if (normalized.status === "CLOSED") {
          throw new OrderStatusUpdateError(
            "Tu rol no está autorizado para cerrar órdenes.",
          );
        }

        throw new OrderStatusUpdateError(
          "No tienes permiso para realizar esta transición.",
        );
      }

      const observation = parsed.data.observation ?? null;

      const enteringClosed =
        order.status !== "CLOSED" && normalized.status === "CLOSED";

      const statusChanged = order.status !== normalized.status;

      const substatusChanged = order.sentSubstatus !== normalized.sentSubstatus;

      const observationChanged =
        (order.deliveryObservation ?? null) !== observation;

      if (!statusChanged && !substatusChanged && !observationChanged) {
        return {
          changed: false,

          orderCode: order.orderCodeRaw,
        };
      }

      const deliveredAt = resolveDitoDeliveredAt(
        normalized.deliveryStatus,
        order.deliveredAt,
        changedAt,
      );

      const updateResult = await transaction.ditoOrder.updateMany({
        where: {
          id: order.id,

          organizationId: membership.organization.id,

          updatedAt: order.updatedAt,
        },

        data: {
          status: normalized.status,

          statusRaw: mapStatusRaw(normalized.status),

          sentSubstatus: normalized.sentSubstatus,

          sentSubstatusRaw: mapSubstatusRaw(normalized.sentSubstatus),

          statusUpdatedAt: statusChanged ? changedAt : order.statusUpdatedAt,

          sentSubstatusUpdatedAt: substatusChanged
            ? changedAt
            : order.sentSubstatusUpdatedAt,

          noStatusDetectedAt: normalized.noStatusDetectedAt,

          deliveryStatus: normalized.deliveryStatus,

          deliveryObservation: observation,

          deliveredAt,

          closedByUserId: enteringClosed
            ? session.user.id
            : order.closedByUserId,

          closedAt: enteringClosed ? changedAt : order.closedAt,
        },
      });

      if (updateResult.count !== 1) {
        throw new OrderStatusUpdateError(
          "La orden fue modificada por otro usuario. Recarga la bandeja e inténtalo nuevamente.",
        );
      }

      await transaction.ditoOrderStatusHistory.create({
        data: {
          organizationId: membership.organization.id,

          ditoOrderId: order.id,

          previousStatus: order.status,

          previousSentSubstatus: order.sentSubstatus,

          newStatus: normalized.status,

          newSentSubstatus: normalized.sentSubstatus,

          previousDeliveryStatus: order.deliveryStatus,

          newDeliveryStatus: normalized.deliveryStatus,

          previousNoStatusDetectedAt: order.noStatusDetectedAt,

          newNoStatusDetectedAt: normalized.noStatusDetectedAt,

          observation,

          changedByUserId: session.user.id,

          changedAt,
        },
      });

      if (normalized.status === "CANCELLED") {
        await transaction.ditoOrderCancellationRequest.updateMany({
          where: {
            organizationId: membership.organization.id,
            ditoOrderId: order.id,
            status: "PENDING",
          },
          data: {
            status: "APPROVED",
            reviewedByUserId: session.user.id,
            reviewedAt: changedAt,
            reviewObservation: observation,
          },
        });
      }

      // SPEC-030 BR-061: la puerta interna de recuperación se abre con la
      // misma transacción que registra la novedad.
      const recoveryTrigger = {
        status: normalized.status,
        sentSubstatus: normalized.sentSubstatus,
        motivoRechazo: order.agrDeliverySnapshot?.motivoRechazo ?? null,
        submotivoRechazo: order.agrDeliverySnapshot?.submotivoRechazo ?? null,
      };
      const recoveryOrder = {
        id: order.id,
        agentUserId: order.agentUserId,
        assignedTeamId: order.assignedTeamId,
        holderFullNameRaw: order.holderFullNameRaw,
        holderDocumentNumber: order.holderDocumentNumber,
        registeredAt: order.registeredAt,
        department: order.department,
        province: order.province,
        district: order.district,
      };

      // BR-073: si la entrega se concretó, el caso abierto se cierra solo.
      if (normalized.deliveryStatus === "DELIVERED") {
        await closeInternalRecoveryCaseOnDelivery(transaction, {
          organizationId: membership.organization.id,
          ditoOrderId: order.id,
          actorUserId: session.user.id,
          deliveredAt: changedAt,
        });
      } else {
        await openInternalRecoveryCase(transaction, {
          organizationId: membership.organization.id,
          order: recoveryOrder,
          trigger: recoveryTrigger,
          actorUserId: session.user.id,
          noveltyAt: changedAt,
          observation,
        });
      }

      return {
        changed: true,

        orderCode: order.orderCodeRaw,
      };
    });

    revalidatePath("/orders");

    return {
      type: "success",

      message: result.changed
        ? `Estado de ${result.orderCode} actualizado.`
        : "cancellationRequested" in result && result.cancellationRequested
          ? `Solicitud de cancelación de ${result.orderCode} enviada para revisión.`
          : "No se encontraron cambios para guardar.",
    };
  } catch (error) {
    if (error instanceof OrderStatusUpdateError) {
      return {
        type: "error",

        message: error.message,
      };
    }

    console.error("No se pudo actualizar la orden DITO", error);

    return {
      type: "error",

      message: "No se pudo guardar el estado. Inténtalo nuevamente.",
    };
  }
}
