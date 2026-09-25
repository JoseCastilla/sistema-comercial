import "server-only";

import {
  describeInternalRecoveryStage,
  describeMyDayDue,
  describeSalesRecoveryWork,
  effectiveAttemptResult,
  evaluateInternalLossReasonGates,
  formatCampaignMoment,
  formatMyDaySaleDay,
  getLimaIsoDate,
} from "@repo/validation";

import { database } from "@/server/database";
import { formatLimaDateTime } from "@repo/ui/format";

import { lossReasonLabels } from "../loss-reason-labels";
import {
  describeSalesRecoveryFall,
  salesRecoveryFallOrderSelect,
} from "./sales-recovery-fall";

import type { SalesRecoveryAccess } from "./get-sales-recovery-inbox";
import type {
  InternalRecoveryStage,
  LossReasonGate,
  RecoveryLossReasonOption,
} from "@repo/validation";

export interface SalesRecoveryCaseDetail {
  id: string;
  holderName: string;
  documentNumber: string;
  status: string;
  priority: string | null;
  entryReason: string | null;
  entryObservation: string | null;
  orderCode: string | null;
  /** Día de Lima en que se registró la venta, para abrirla en su período. */
  orderRegisteredDay: string | null;
  contactPhone: string | null;
  assignedToName: string | null;
  isAssignedToViewer: boolean;
  originalAgentName: string | null;
  originalTeamName: string | null;
  noveltyAtLabel: string;
  claimedAtLabel: string | null;
  firstContactAtLabel: string | null;
  nextActionAtLabel: string | null;
  nextActionOverdue: boolean;
  /** Etapa de la cadencia (REC-05); `null` cuando el caso está resuelto. */
  stage: InternalRecoveryStage | null;
  isResolved: boolean;
  resolutionLabel: string | null;
  canManage: boolean;
  canResolveOther: boolean;
  attempts: Array<{
    id: string;
    channel: string;
    result: string;
    phoneUsed: string | null;
    observation: string | null;
    actorName: string;
    createdAtLabel: string;
  }>;
  recoveredOrderSuggestions: Array<{
    id: string;
    orderCode: string;
    registeredAtLabel: string;
    status: string;
  }>;
  lossReasonGates: Record<RecoveryLossReasonOption, LossReasonGate>;
  /**
   * Qué hacer, con la misma regla que «Mi día» (SPEC-067 BR-001): el plazo con
   * su tono y la frase. Nulo si está resuelto.
   */
  work: {
    action: string;
    due: { label: string; tone: "danger" | "warning" | "neutral" } | null;
  } | null;
  /** Por qué se cayó, como en «Mi día»: la acción de logística o el motivo. */
  fallReason: string | null;
  /** «24/09»: el día de la venta. */
  saleDayLabel: string | null;
  /** Teléfonos para el editor: contacto, el del pedido y la línea. */
  phoneOptions: string[];
  lastResult: string | null;
  lastObservation: string | null;
}

export async function getSalesRecoveryCase(
  organizationId: string,
  access: SalesRecoveryAccess,
  caseId: string,
): Promise<SalesRecoveryCaseDetail | null> {
  const supervisedTeamIds =
    access.role === "SUPERVISOR"
      ? (
          await database.commercialTeamMember.findMany({
            where: {
              userId: access.userId,
              memberRole: "SUPERVISOR",
              isActive: true,
              team: { organizationId, status: "ACTIVE" },
            },
            select: { teamId: true },
          })
        ).map((item) => item.teamId)
      : null;

  const recoveryCase = await database.recoveryCase.findFirst({
    where: {
      id: caseId,
      organizationId,
      source: { in: ["INTERNAL_ORDER_STATE", "MANUAL"] },
      ...(access.role === "AGENT" ? { assignedUserId: access.userId } : {}),
      ...(supervisedTeamIds
        ? {
            OR: [
              { assignedTeamId: { in: supervisedTeamIds } },
              { originalTeamId: { in: supervisedTeamIds } },
              { assignedUserId: access.userId },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      priority: true,
      entryReason: true,
      entryObservation: true,
      holderName: true,
      documentNumber: true,
      lastSightingAt: true,
      claimedAt: true,
      firstContactAt: true,
      nextActionAt: true,
      createdAt: true,
      lossReason: true,
      resolvedAt: true,
      assignedUserId: true,
      sourceDitoOrderId: true,
      assignedUser: { select: { name: true } },
      originalAgent: { select: { name: true } },
      originalTeam: { select: { name: true } },
      sourceDitoOrder: {
        select: {
          orderCodeRaw: true,
          deliveryContactPhone: true,
          registeredAt: true,
          serviceNumber: true,
          ...salesRecoveryFallOrderSelect,
        },
      },
      phones: {
        where: { kind: "CONTACT", invalidMarkedAt: null },
        select: { phoneNumber: true },
      },
      recoveredDitoOrder: { select: { orderCodeRaw: true } },
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          channel: true,
          result: true,
          phoneUsed: true,
          observation: true,
          createdAt: true,
          actor: { select: { name: true } },
          correction: { select: { effectiveResult: true } },
        },
      },
    },
  });

  if (!recoveryCase) return null;

  const now = new Date();
  const isResolved = ["RECOVERED", "LOST", "DISCARDED"].includes(
    String(recoveryCase.status),
  );

  const suggestions = isResolved
    ? []
    : await database.ditoOrder.findMany({
        where: {
          organizationId,
          holderDocumentNumber: recoveryCase.documentNumber,
          status: { not: "CANCELLED" },
          registeredAt: { gte: recoveryCase.createdAt },
          ...(recoveryCase.sourceDitoOrderId
            ? { NOT: { id: recoveryCase.sourceDitoOrderId } }
            : {}),
        },
        orderBy: { registeredAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderCodeRaw: true,
          registeredAt: true,
          status: true,
        },
      });

  const saleAt =
    recoveryCase.sourceDitoOrder?.registeredAt ?? recoveryCase.lastSightingAt;
  const stage = isResolved
    ? null
    : describeInternalRecoveryStage(
        {
          status: String(recoveryCase.status),
          firstContactAt: recoveryCase.firstContactAt,
          nextActionAt: recoveryCase.nextActionAt,
          noveltyAt: recoveryCase.lastSightingAt,
          claimedAt: recoveryCase.claimedAt,
          lastResult: recoveryCase.attempts[0]
            ? String(recoveryCase.attempts[0].result)
            : null,
        },
        now,
      );
  const todayWork = isResolved
    ? null
    : describeSalesRecoveryWork(
        {
          status: String(recoveryCase.status),
          saleAt,
          firstContactAt: recoveryCase.firstContactAt,
          nextActionAt: recoveryCase.nextActionAt,
          noveltyAt: recoveryCase.lastSightingAt,
        },
        now,
      );
  const lastAttempt = recoveryCase.attempts[0] ?? null;
  const phoneOptions = [
    ...new Set(
      [
        ...recoveryCase.phones.map((phone) => phone.phoneNumber),
        recoveryCase.sourceDitoOrder?.deliveryContactPhone ?? null,
        recoveryCase.sourceDitoOrder?.serviceNumber ?? null,
      ].filter((phone): phone is string => Boolean(phone)),
    ),
  ];

  return {
    id: recoveryCase.id,
    holderName: recoveryCase.holderName,
    documentNumber: recoveryCase.documentNumber,
    status: String(recoveryCase.status),
    priority: recoveryCase.priority ? String(recoveryCase.priority) : null,
    entryReason: recoveryCase.entryReason
      ? String(recoveryCase.entryReason)
      : null,
    entryObservation: recoveryCase.entryObservation,
    orderCode: recoveryCase.sourceDitoOrder?.orderCodeRaw ?? null,
    orderRegisteredDay: recoveryCase.sourceDitoOrder
      ? getLimaIsoDate(recoveryCase.sourceDitoOrder.registeredAt)
      : null,
    contactPhone: recoveryCase.sourceDitoOrder?.deliveryContactPhone ?? null,
    assignedToName: recoveryCase.assignedUser?.name ?? null,
    isAssignedToViewer: recoveryCase.assignedUserId === access.userId,
    originalAgentName: recoveryCase.originalAgent?.name ?? null,
    originalTeamName: recoveryCase.originalTeam?.name ?? null,
    noveltyAtLabel: formatLimaDateTime(recoveryCase.lastSightingAt),
    claimedAtLabel: recoveryCase.claimedAt
      ? formatLimaDateTime(recoveryCase.claimedAt)
      : null,
    firstContactAtLabel: recoveryCase.firstContactAt
      ? formatLimaDateTime(recoveryCase.firstContactAt)
      : null,
    nextActionAtLabel: recoveryCase.nextActionAt
      ? formatLimaDateTime(recoveryCase.nextActionAt)
      : null,
    nextActionOverdue:
      recoveryCase.nextActionAt !== null &&
      recoveryCase.nextActionAt.getTime() < now.getTime(),
    stage,
    isResolved,
    resolutionLabel: isResolved
      ? recoveryCase.status === "RECOVERED"
        ? `Recuperado con ${recoveryCase.recoveredDitoOrder?.orderCodeRaw ?? "orden vinculada"}`
        : recoveryCase.status === "LOST"
          ? `Perdido · ${
              recoveryCase.lossReason
                ? (lossReasonLabels[String(recoveryCase.lossReason)] ??
                  String(recoveryCase.lossReason))
                : ""
            }`
          : "Cerrado: ya era Movistar"
      : null,
    canManage:
      !isResolved &&
      (access.role !== "AGENT" ||
        recoveryCase.assignedUserId === access.userId),
    canResolveOther: access.role !== "AGENT",
    attempts: recoveryCase.attempts.map((attempt) => ({
      id: attempt.id,
      channel: String(attempt.channel),
      result: String(attempt.result),
      phoneUsed: attempt.phoneUsed,
      observation: attempt.observation,
      actorName: attempt.actor.name,
      createdAtLabel: formatCampaignMoment(attempt.createdAt),
    })),
    recoveredOrderSuggestions: suggestions.map((order) => ({
      id: order.id,
      orderCode: order.orderCodeRaw,
      registeredAtLabel: formatLimaDateTime(order.registeredAt),
      status: String(order.status),
    })),
    lossReasonGates: evaluateInternalLossReasonGates(recoveryCase.attempts),
    // Lo que toca hoy dice lo mismo que «Mi día»; si hoy no toca, la etapa
    // dice en qué está y cuándo vuelve.
    work: isResolved
      ? null
      : todayWork
        ? { action: todayWork.action, due: todayWork.due }
        : {
            action: stage?.label ?? "Sin acción pendiente",
            due: recoveryCase.nextActionAt
              ? {
                  label: describeMyDayDue(recoveryCase.nextActionAt, now),
                  tone: "neutral",
                }
              : null,
          },
    fallReason: describeSalesRecoveryFall(recoveryCase, 200),
    saleDayLabel: formatMyDaySaleDay(saleAt),
    phoneOptions,
    lastResult: lastAttempt ? effectiveAttemptResult(lastAttempt) : null,
    lastObservation: lastAttempt?.observation ?? null,
  };
}
