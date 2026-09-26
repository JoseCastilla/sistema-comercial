import "server-only";

import {
  canRequestDitoOrderCancellation,
  canTransitionDitoOrderStatus,
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

import type { Prisma } from "@repo/database";

/**
 * El cambio de estado de un pedido, con todas sus reglas: alcance, permiso
 * de la transición, historial, quién cerró, cancelación pedida y la puerta
 * de recupero. Lo usan el cambio de uno en uno (`updateOrderStatusAction`) y
 * el cierre de varios (`closeOrdersAction`, SPEC-079), para que ninguno se
 * salte una regla. No es una acción de servidor: el contexto lo pone quien
 * ya verificó la sesión.
 */
export class OrderStatusUpdateError extends Error {}

export interface OrderStatusChangeContext {
  organizationId: string;
  userId: string;
  role: "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
}

export interface OrderStatusChangeInput {
  orderId: string;
  status: DitoOrderStatus;
  sentSubstatus: DitoSentSubstatus | null;
  /** `undefined` conserva la nota que ya tenía el pedido. */
  observation?: string | null;
}

export type OrderStatusChangeResult =
  | { changed: boolean; orderCode: string; cancellationRequested?: false }
  | { changed: false; orderCode: string; cancellationRequested: true };

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

export async function applyOrderStatusChange(
  transaction: Prisma.TransactionClient,
  context: OrderStatusChangeContext,
  input: OrderStatusChangeInput,
): Promise<OrderStatusChangeResult> {
  const supervisedTeamIds =
    context.role === "SUPERVISOR"
      ? (
          await transaction.commercialTeamMember.findMany({
            where: {
              userId: context.userId,
              memberRole: "SUPERVISOR",
              isActive: true,
              team: {
                organizationId: context.organizationId,
                status: "ACTIVE",
              },
            },
            select: { teamId: true },
          })
        ).map((member) => member.teamId)
      : [];
  const primarySalesMembership =
    context.role === "SUPERVISOR"
      ? await transaction.commercialTeamMember.findFirst({
          where: {
            userId: context.userId,
            salesEnabled: true,
            isPrimary: true,
            isActive: true,
            team: {
              organizationId: context.organizationId,
              status: "ACTIVE",
            },
          },
          select: { teamId: true },
        })
      : null;
  const salesEnabled = primarySalesMembership !== null;
  const order = await transaction.ditoOrder.findFirst({
    where: {
      id: input.orderId,

      organizationId: context.organizationId,
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

  // Sin nota en la entrada (cierre en bloque), se conserva la de siempre.
  const inputObservation =
    input.observation === undefined
      ? (order.deliveryObservation ?? null)
      : input.observation;

  const visibility = resolveDitoOrderVisibility({
    role: context.role,
    userId: context.userId,
    supervisedTeamIds,
    orderAgentUserId: order.agentUserId,
    orderAssignedTeamId: order.assignedTeamId,
    salesEnabled,
  });
  const isOwnOrder = order.agentUserId === context.userId;
  const isSalesOwner =
    isOwnOrder && (context.role === "AGENT" || salesEnabled);

  if (visibility !== "FULL") {
    throw new OrderStatusUpdateError(
      "No tienes permiso para actualizar esta orden.",
    );
  }

  const changedAt = new Date();

  const normalized = normalizeDitoOrderState({
    statusRaw: input.status,

    sentSubstatusRaw: input.sentSubstatus,

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
      role: context.role,
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

    const reason = inputObservation;

    if (!reason) {
      throw new OrderStatusUpdateError(
        "Indica el motivo de la solicitud de cancelación.",
      );
    }

    const requestedAt = changedAt;
    const touchedOrder = await transaction.ditoOrder.updateMany({
      where: {
        id: order.id,
        organizationId: context.organizationId,
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
        organizationId: context.organizationId,
        ditoOrderId: order.id,
        reason,
        requestedByUserId: context.userId,
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
      role: context.role,
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

  // SPEC-084: con una cancelación por revisar el pedido no se cierra; ni
  // uno por uno ni en bloque (SPEC-013).
  if (
    normalized.status === "CLOSED" &&
    order.cancellationRequests.length > 0
  ) {
    throw new OrderStatusUpdateError(
      "Tiene una cancelación por revisar: resuélvela antes de cerrar.",
    );
  }

  const observation = inputObservation;

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

      organizationId: context.organizationId,

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
        ? context.userId
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
      organizationId: context.organizationId,

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

      changedByUserId: context.userId,

      changedAt,
    },
  });

  if (normalized.status === "CANCELLED") {
    await transaction.ditoOrderCancellationRequest.updateMany({
      where: {
        organizationId: context.organizationId,
        ditoOrderId: order.id,
        status: "PENDING",
      },
      data: {
        status: "APPROVED",
        reviewedByUserId: context.userId,
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
      organizationId: context.organizationId,
      ditoOrderId: order.id,
      actorUserId: context.userId,
      deliveredAt: changedAt,
    });
  } else {
    await openInternalRecoveryCase(transaction, {
      organizationId: context.organizationId,
      order: recoveryOrder,
      trigger: recoveryTrigger,
      actorUserId: context.userId,
      noveltyAt: changedAt,
      observation,
    });
  }

  return {
    changed: true,

    orderCode: order.orderCodeRaw,
  };
}
