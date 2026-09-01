import "server-only";

import {
  baseRecoveryMinimumDailyAttempts,
  countOnSameLimaDay,
  evaluateInternalLossReasonGates,
  isBaseRecoveryResolutionDue,
} from "@repo/validation";

import { database } from "@/server/database";

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

export interface CampaignCaseDetail {
  id: string;
  holderName: string;
  documentNumber: string;
  department: string | null;
  status: string;
  teamName: string | null;
  assignedToName: string | null;
  isAssignedToViewer: boolean;
  sightingCount: number;
  lastSightingLabel: string;
  claimedAtLabel: string | null;
  nextActionAtLabel: string | null;
  nextActionOverdue: boolean;
  attemptsToday: number;
  minimumDailyAttempts: number;
  resolutionDue: boolean;
  isResolved: boolean;
  resolutionLabel: string | null;
  /** BR-085: reportado como "ya es Movistar", pendiente de verificación. */
  reportedActive: boolean;
  /** BR-086: interesado con pedido ajeno en curso, en vigilancia diaria. */
  interestedWithOrder: boolean;
  canManage: boolean;
  canResolveOther: boolean;
  services: Array<{
    serviceNumber: string;
    planRaw: string | null;
    carrierRaw: string | null;
    discarded: boolean;
    portabilityState: string | null;
    portabilityEligibleLabel: string | null;
    isPlantLine: boolean;
  }>;
  contactPhones: string[];
  sensitive: {
    requiresValidation: boolean;
    revealed: boolean;
    canReveal: boolean;
    revealMissing: string | null;
    fatherName: string | null;
    motherName: string | null;
    birthPlace: string | null;
    revealedAtLabel: string | null;
  };
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

/**
 * Ficha de un caso de campaña (base nacional) — SPEC-030 BR-029b, BR-045,
 * BR-046. El asesor solo abre sus casos asignados; los datos de validación
 * de identidad permanecen ocultos hasta cumplir la puerta de BR-046.
 */
export async function getCampaignCase(
  organizationId: string,
  access: SalesRecoveryAccess,
  caseId: string,
): Promise<CampaignCaseDetail | null> {
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
      source: "NATIONAL_BASE",
      ...(access.role === "AGENT" ? { assignedUserId: access.userId } : {}),
      ...(supervisedTeamIds
        ? {
            OR: [
              { assignedTeamId: { in: supervisedTeamIds } },
              { assignedUserId: access.userId },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      holderName: true,
      documentNumber: true,
      department: true,
      requiresIdentityValidation: true,
      fatherName: true,
      motherName: true,
      birthPlace: true,
      sensitiveRevealedAt: true,
      lastSightingAt: true,
      claimedAt: true,
      createdAt: true,
      nextActionAt: true,
      lossReason: true,
      assignedUserId: true,
      assignedTeam: { select: { name: true } },
      assignedUser: { select: { name: true } },
      recoveredDitoOrder: { select: { orderCodeRaw: true } },
      _count: { select: { sightings: true } },
      services: {
        orderBy: { createdAt: "asc" },
        select: {
          serviceNumber: true,
          planRaw: true,
          carrierRaw: true,
          discardedAt: true,
          portabilityState: true,
          portabilityEligibleAt: true,
          isPlantLine: true,
        },
      },
      phones: {
        where: { kind: "CONTACT", invalidMarkedAt: null },
        select: { phoneNumber: true },
      },
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
  const isAssignedToViewer = recoveryCase.assignedUserId === access.userId;

  const attemptsToday = countOnSameLimaDay(
    recoveryCase.attempts.map((attempt) => attempt.createdAt),
    now,
  );

  const hasInterestedAttempt = recoveryCase.attempts.some(
    (attempt) =>
      String(attempt.result) === "INTERESADO" ||
      String(attempt.result) === "INTERESADO_CON_PEDIDO",
  );

  const lastAttemptResult = recoveryCase.attempts[0]
    ? String(recoveryCase.attempts[0].result)
    : null;
  const reportedActive =
    String(recoveryCase.status) === "WAITING" &&
    lastAttemptResult === "YA_ACTIVO";
  const interestedWithOrder =
    !isResolved && lastAttemptResult === "INTERESADO_CON_PEDIDO";

  // BR-046: solo el asesor asignado, solo con validación pendiente y solo
  // tras un intento INTERESADO. En un caso ya validado no se muestran nunca.
  const revealed =
    recoveryCase.requiresIdentityValidation &&
    recoveryCase.sensitiveRevealedAt !== null &&
    isAssignedToViewer;
  const canReveal =
    recoveryCase.requiresIdentityValidation &&
    recoveryCase.sensitiveRevealedAt === null &&
    isAssignedToViewer &&
    hasInterestedAttempt &&
    !isResolved;

  const suggestions = isResolved
    ? []
    : await database.ditoOrder.findMany({
        where: {
          organizationId,
          holderDocumentNumber: recoveryCase.documentNumber,
          status: { not: "CANCELLED" },
          registeredAt: { gte: recoveryCase.createdAt },
        },
        orderBy: { registeredAt: "desc" },
        take: 5,
        select: { id: true, orderCodeRaw: true, registeredAt: true, status: true },
      });

  return {
    id: recoveryCase.id,
    holderName: recoveryCase.holderName,
    documentNumber: recoveryCase.documentNumber,
    department: recoveryCase.department,
    status: String(recoveryCase.status),
    teamName: recoveryCase.assignedTeam?.name ?? null,
    assignedToName: recoveryCase.assignedUser?.name ?? null,
    isAssignedToViewer,
    sightingCount: recoveryCase._count.sightings,
    lastSightingLabel: dateTimeFormatter.format(recoveryCase.lastSightingAt),
    claimedAtLabel: recoveryCase.claimedAt
      ? dateTimeFormatter.format(recoveryCase.claimedAt)
      : null,
    nextActionAtLabel: recoveryCase.nextActionAt
      ? dateTimeFormatter.format(recoveryCase.nextActionAt)
      : null,
    nextActionOverdue:
      recoveryCase.nextActionAt !== null &&
      recoveryCase.nextActionAt.getTime() < now.getTime(),
    attemptsToday,
    minimumDailyAttempts: baseRecoveryMinimumDailyAttempts,
    resolutionDue:
      !isResolved &&
      recoveryCase.claimedAt !== null &&
      isBaseRecoveryResolutionDue(recoveryCase.claimedAt, now),
    isResolved,
    resolutionLabel: isResolved
      ? recoveryCase.status === "RECOVERED"
        ? `Recuperado con ${recoveryCase.recoveredDitoOrder?.orderCodeRaw ?? "orden vinculada"}`
        : recoveryCase.status === "LOST"
          ? `Perdido · ${recoveryCase.lossReason ?? ""}`
          : "Descartado"
      : null,
    reportedActive,
    interestedWithOrder,
    canManage: !isResolved && (access.role !== "AGENT" || isAssignedToViewer),
    canResolveOther: access.role !== "AGENT",
    services: recoveryCase.services.map((service) => ({
      serviceNumber: service.serviceNumber,
      planRaw: service.planRaw,
      carrierRaw: service.carrierRaw,
      discarded: service.discardedAt !== null,
      portabilityState: service.portabilityState
        ? String(service.portabilityState)
        : null,
      portabilityEligibleLabel: service.portabilityEligibleAt
        ? dateTimeFormatter.format(service.portabilityEligibleAt)
        : null,
      isPlantLine: service.isPlantLine,
    })),
    contactPhones: recoveryCase.phones.map((phone) => phone.phoneNumber),
    sensitive: {
      requiresValidation: recoveryCase.requiresIdentityValidation,
      revealed,
      canReveal,
      revealMissing:
        recoveryCase.requiresIdentityValidation &&
        !revealed &&
        !canReveal &&
        isAssignedToViewer &&
        !isResolved
          ? "Se revelan tras registrar un intento con resultado INTERESADO."
          : null,
      fatherName: revealed ? recoveryCase.fatherName : null,
      motherName: revealed ? recoveryCase.motherName : null,
      birthPlace: revealed ? recoveryCase.birthPlace : null,
      revealedAtLabel: recoveryCase.sensitiveRevealedAt
        ? dateTimeFormatter.format(recoveryCase.sensitiveRevealedAt)
        : null,
    },
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
