import "server-only";

import {
  getHighestRecoveryPriority,
  getInternalRecoveryFirstActionAt,
  getInternalRecoveryPriority,
  resolveInitialRecoveryAssignee,
  resolveInternalRecoveryEntryReason,
  shouldOpenInternalRecoveryCase,
} from "@repo/validation";

import type { Prisma } from "@repo/database";
import type {
  InternalRecoveryTrigger,
  RecoveryEntryReason,
} from "@repo/validation";

type RecoveryTransaction = Prisma.TransactionClient;

const resolvedStatuses = ["RECOVERED", "LOST", "DISCARDED"] as const;

export interface InternalRecoveryOrder {
  id: string;
  agentUserId: string | null;
  assignedTeamId: string | null;
  holderFullNameRaw: string;
  holderDocumentNumber: string | null;
  registeredAt: Date;
  department: string | null;
  province: string | null;
  district: string | null;
}

export interface OpenInternalRecoveryCaseInput {
  organizationId: string;
  order: InternalRecoveryOrder;
  trigger: InternalRecoveryTrigger;
  actorUserId: string;
  noveltyAt: Date;
  /** Motivo elegido por una persona; si falta, se propone desde el OL. */
  entryReason?: RecoveryEntryReason;
  observation?: string | null;
}

export type OpenInternalRecoveryCaseResult =
  | { outcome: "CREATED"; caseId: string }
  | { outcome: "MERGED"; caseId: string }
  | { outcome: "SKIPPED"; reason: "NOT_ELIGIBLE" | "NO_DOCUMENT" };

/**
 * Abre —o enriquece— el caso de recuperación de una venta propia.
 * SPEC-030 BR-061 a BR-064, BR-072 y BR-073.
 *
 * Debe invocarse dentro de la misma transacción que persiste el cambio de
 * estado de la orden, para que un caso nunca quede huérfano de su novedad.
 */
export async function openInternalRecoveryCase(
  transaction: RecoveryTransaction,
  input: OpenInternalRecoveryCaseInput,
): Promise<OpenInternalRecoveryCaseResult> {
  const isManual = input.entryReason !== undefined;
  if (!isManual && !shouldOpenInternalRecoveryCase(input.trigger)) {
    return { outcome: "SKIPPED", reason: "NOT_ELIGIBLE" };
  }

  // La identidad del caso es el cliente (BR-006); sin documento no hay forma
  // de unificarlo con la base nacional ni de evitar duplicados.
  const documentNumber = input.order.holderDocumentNumber?.trim();
  if (!documentNumber) {
    return { outcome: "SKIPPED", reason: "NO_DOCUMENT" };
  }

  const entryReason =
    input.entryReason ?? resolveInternalRecoveryEntryReason(input.trigger);
  const priority = getInternalRecoveryPriority(entryReason);
  const observation =
    input.observation?.trim() ||
    [input.trigger.motivoRechazo, input.trigger.submotivoRechazo]
      .filter((value): value is string => Boolean(value))
      .join(" · ") ||
    null;

  // BR-061: idempotencia por orden origen. BR-072: un solo caso abierto por
  // cliente, aunque la otra puerta lo haya creado primero.
  const existing = await transaction.recoveryCase.findFirst({
    where: {
      organizationId: input.organizationId,
      status: { notIn: [...resolvedStatuses] },
      OR: [
        { sourceDitoOrderId: input.order.id },
        { documentNumber },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      priority: true,
      sourceDitoOrderId: true,
      assignedUserId: true,
    },
  });

  if (existing) {
    const mergedPriority =
      getHighestRecoveryPriority(existing.priority, priority) ?? priority;
    // BR-072: el carril interno domina la fusión. El caso — esté en triage,
    // en el pool o asignado como lead frío — pasa al asesor original con el
    // reloj de dos horas, o queda sin responsable si terminó en Crítica.
    const mergedAssigneeId = resolveInitialRecoveryAssignee({
      priority: mergedPriority,
      originalAgentUserId: input.order.agentUserId,
    });
    const mergedStatus = mergedAssigneeId ? "ASSIGNED" : "OPEN";

    await transaction.recoveryCase.update({
      where: { id: existing.id },
      data: {
        priority: mergedPriority,
        status: mergedStatus,
        lastSightingAt: input.noveltyAt,
        sourceDitoOrderId: existing.sourceDitoOrderId ?? input.order.id,
        originalAgentUserId: input.order.agentUserId,
        originalTeamId: input.order.assignedTeamId,
        entryReason,
        entryObservation: observation,
        assignedUserId: mergedAssigneeId,
        assignedTeamId: input.order.assignedTeamId,
        claimedAt: mergedAssigneeId ? input.noveltyAt : null,
        nextActionAt: getInternalRecoveryFirstActionAt(input.noveltyAt),
      },
    });

    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId: input.organizationId,
        caseId: existing.id,
        type: "SIGHTING_RECORDED",
        actorUserId: input.actorUserId,
        previousStatus: existing.status,
        newStatus: mergedStatus,
        observation,
        metadata: {
          gate: "INTERNAL_ORDER_STATE",
          entryReason,
          sourceDitoOrderId: input.order.id,
          previousPriority: existing.priority,
          priority: mergedPriority,
          previousAssignedUserId: existing.assignedUserId,
          assignedUserId: mergedAssigneeId,
          internalLaneTakeover: true,
        },
      },
    });

    return { outcome: "MERGED", caseId: existing.id };
  }

  // BR-062: el caso interno nace OPEN, no TRIAGE: el cliente ya es conocido y
  // la elegibilidad ocurrió al vender.
  const assignedUserId = resolveInitialRecoveryAssignee({
    priority,
    originalAgentUserId: input.order.agentUserId,
  });

  const created = await transaction.recoveryCase.create({
    data: {
      organizationId: input.organizationId,
      source: isManual ? "MANUAL" : "INTERNAL_ORDER_STATE",
      status: assignedUserId ? "ASSIGNED" : "OPEN",
      documentNumber,
      holderName: input.order.holderFullNameRaw,
      department: input.order.department,
      province: input.order.province,
      district: input.order.district,
      // BR-068: para un caso interno la fecha comercial es el ingreso de la
      // venta y el avistamiento es la novedad que lo originó.
      firstRegisteredAt: input.order.registeredAt,
      lastSightingAt: input.noveltyAt,
      sourceDitoOrderId: input.order.id,
      originalAgentUserId: input.order.agentUserId,
      originalTeamId: input.order.assignedTeamId,
      entryReason,
      entryObservation: observation,
      priority,
      assignedUserId,
      assignedTeamId: input.order.assignedTeamId,
      claimedAt: assignedUserId ? input.noveltyAt : null,
      // BR-066: el reloj de las dos horas empieza con la novedad.
      nextActionAt: getInternalRecoveryFirstActionAt(input.noveltyAt),
    },
    select: { id: true, status: true },
  });

  await transaction.recoveryCaseEvent.create({
    data: {
      organizationId: input.organizationId,
      caseId: created.id,
      type: "CASE_CREATED",
      actorUserId: input.actorUserId,
      newStatus: created.status,
      observation,
      metadata: {
        gate: isManual ? "MANUAL" : "INTERNAL_ORDER_STATE",
        entryReason,
        priority,
        sourceDitoOrderId: input.order.id,
        originalAgentUserId: input.order.agentUserId,
        originalTeamId: input.order.assignedTeamId,
      },
    },
  });

  return { outcome: "CREATED", caseId: created.id };
}

/**
 * BR-073: si el courier finalmente entrega, el caso abierto por esa orden se
 * cierra solo y no cuenta como pérdida.
 */
export async function closeInternalRecoveryCaseOnDelivery(
  transaction: RecoveryTransaction,
  input: {
    organizationId: string;
    ditoOrderId: string;
    actorUserId: string;
    deliveredAt: Date;
  },
): Promise<number> {
  const open = await transaction.recoveryCase.findMany({
    where: {
      organizationId: input.organizationId,
      sourceDitoOrderId: input.ditoOrderId,
      status: { notIn: [...resolvedStatuses] },
    },
    select: { id: true, status: true },
  });
  if (open.length === 0) return 0;

  await transaction.recoveryCase.updateMany({
    where: { id: { in: open.map((item) => item.id) } },
    data: {
      status: "DISCARDED",
      discardReason: "ENTREGA_CONCRETADA",
      resolvedAt: input.deliveredAt,
      resolvedByUserId: input.actorUserId,
      nextActionAt: null,
    },
  });

  await transaction.recoveryCaseEvent.createMany({
    data: open.map((item) => ({
      organizationId: input.organizationId,
      caseId: item.id,
      type: "CASE_DISCARDED" as const,
      actorUserId: input.actorUserId,
      previousStatus: item.status,
      newStatus: "DISCARDED" as const,
      observation:
        "La entrega se concretó en un intento posterior; el caso se cierra sin contar como pérdida.",
      metadata: { gate: "INTERNAL_ORDER_STATE", closedByDelivery: true },
    })),
  });

  return open.length;
}
