import "server-only";

import { evaluateInternalLossReasonGates } from "@repo/validation";

import { database } from "@/server/database";

import { lossReasonLabels } from "../loss-reason-labels";

import type { SalesRecoveryAccess } from "./get-sales-recovery-inbox";
import type { LossReasonGate, RecoveryLossReasonOption } from "@repo/validation";

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export interface SalesRecoveryCaseDetail {
  id: string;
  holderName: string;
  documentNumber: string;
  status: string;
  priority: string | null;
  entryReason: string | null;
  entryObservation: string | null;
  orderCode: string | null;
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
        select: { orderCodeRaw: true, deliveryContactPhone: true },
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
    contactPhone: recoveryCase.sourceDitoOrder?.deliveryContactPhone ?? null,
    assignedToName: recoveryCase.assignedUser?.name ?? null,
    isAssignedToViewer: recoveryCase.assignedUserId === access.userId,
    originalAgentName: recoveryCase.originalAgent?.name ?? null,
    originalTeamName: recoveryCase.originalTeam?.name ?? null,
    noveltyAtLabel: dateTimeFormatter.format(recoveryCase.lastSightingAt),
    claimedAtLabel: recoveryCase.claimedAt
      ? dateTimeFormatter.format(recoveryCase.claimedAt)
      : null,
    firstContactAtLabel: recoveryCase.firstContactAt
      ? dateTimeFormatter.format(recoveryCase.firstContactAt)
      : null,
    nextActionAtLabel: recoveryCase.nextActionAt
      ? dateTimeFormatter.format(recoveryCase.nextActionAt)
      : null,
    nextActionOverdue:
      recoveryCase.nextActionAt !== null &&
      recoveryCase.nextActionAt.getTime() < now.getTime(),
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
      createdAtLabel: dateTimeFormatter.format(attempt.createdAt),
    })),
    recoveredOrderSuggestions: suggestions.map((order) => ({
      id: order.id,
      orderCode: order.orderCodeRaw,
      registeredAtLabel: dateTimeFormatter.format(order.registeredAt),
      status: String(order.status),
    })),
    lossReasonGates: evaluateInternalLossReasonGates(recoveryCase.attempts),
  };
}
