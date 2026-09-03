import "server-only";

import {
  buildMapsUrl,
  buildOsmEmbedUrl,
  composeAddress,
  readContactSummary,
  readCoordinates,
} from "../contact-summary";

import {
  baseRecoveryMinimumDailyAttempts,
  countOnSameLimaDay,
  describeRecoveryLineOrigin,
  evaluateInternalLossReasonGates,
  isBaseRecoveryResolutionDue,
} from "@repo/validation";

import { database } from "@/server/database";

import { lossReasonLabels } from "../loss-reason-labels";

import type { SalesRecoveryAccess } from "./get-sales-recovery-inbox";
import type {
  LossReasonGate,
  RecoveryLossReasonOption,
} from "@repo/validation";

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
  province: string | null;
  district: string | null;
  /** Dirección compuesta desde la base: vía, número, complejo, manzana y lote. */
  address: string | null;
  reference: string | null;
  deliveryInstructions: string | null;
  /** Enlace a mapas cuando la base trae coordenadas. */
  mapsUrl: string | null;
  /** Mapa embebible (OpenStreetMap) cuando hay coordenadas. */
  osmEmbedUrl: string | null;
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
    /** Operador actual más confiable y su antigüedad (reporte completo). */
    originOperator: string;
    originDetail: string | null;
  }>;
  contactPhones: string[];
  sensitive: {
    requiresValidation: boolean;

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
      province: true,
      district: true,
      contactSummary: true,
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
          portabilityReceiver: true,
          portabilityWindowAt: true,
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

  /**
   * BR-003: las columnas N–AP son el material de trabajo comercial. La
   * dirección, la referencia y las coordenadas viven en el resumen de
   * contacto del caso y el asesor las necesita a la vista para la llamada.
   */
  const summary = readContactSummary(recoveryCase.contactSummary);
  const coordinates = readCoordinates(summary);

  const lastAttemptResult = recoveryCase.attempts[0]
    ? String(recoveryCase.attempts[0].result)
    : null;
  const reportedActive =
    String(recoveryCase.status) === "WAITING" &&
    lastAttemptResult === "YA_ACTIVO";
  const interestedWithOrder =
    !isResolved && lastAttemptResult === "INTERESADO_CON_PEDIDO";

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
    department: recoveryCase.department,
    province: recoveryCase.province,
    district: recoveryCase.district,
    address: composeAddress(summary),
    reference: summary.reference ?? null,
    deliveryInstructions: summary.shippingInstructions ?? null,
    mapsUrl: buildMapsUrl(coordinates),
    osmEmbedUrl: buildOsmEmbedUrl(coordinates),
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
          ? `Perdido · ${
              recoveryCase.lossReason
                ? (lossReasonLabels[String(recoveryCase.lossReason)] ??
                  String(recoveryCase.lossReason))
                : ""
            }`
          : "Cerrado: ya era Movistar"
      : null,
    reportedActive,
    interestedWithOrder,
    canManage: !isResolved && (access.role !== "AGENT" || isAssignedToViewer),
    canResolveOther: access.role !== "AGENT",
    services: recoveryCase.services.map((service) => {
      const origin = describeRecoveryLineOrigin({
        carrierRaw: service.carrierRaw,
        portabilityState: service.portabilityState
          ? (String(service.portabilityState) as never)
          : null,
        portabilityReceiver: service.portabilityReceiver,
        portabilityWindowAt: service.portabilityWindowAt,
        isPlantLine: service.isPlantLine,
        now,
      });
      return {
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
        originOperator: origin.operator,
        originDetail: origin.detail,
      };
    }),
    contactPhones: recoveryCase.phones.map((phone) => phone.phoneNumber),
    /*
     * Los datos de identidad del titular se muestran sin compuerta.
     *
     * SPEC-030 BR-045/BR-046 los ocultaba hasta registrar un intento
     * INTERESADO, como control antifraude. Se retira por decision de producto:
     * el asesor los necesita durante la llamada, no despues. La marca de
     * revelacion se conserva en la base y se sigue mostrando cuando existe,
     * de modo que el historial auditado de los casos anteriores no se pierde.
     */
    sensitive: {
      requiresValidation: recoveryCase.requiresIdentityValidation,
      fatherName: recoveryCase.fatherName,
      motherName: recoveryCase.motherName,
      birthPlace: recoveryCase.birthPlace,
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
