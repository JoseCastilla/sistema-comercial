import "server-only";

import { countOverdueInternalCases } from "@/features/recovery/server/count-overdue-internal-cases";
import { database } from "@/server/database";

import { describeAdminPending } from "../admin-pending";

import type { AdminPendingGroup } from "../admin-pending";

/**
 * SPEC-045 PL-01: los conteos del resumen administrativo, cada uno con la
 * misma definición que la pantalla que abre (Recupero, Campañas, Personas,
 * Equipos, Pedidos, Logística). Solo para ADMIN con alcance de organización;
 * con un equipo o asesor filtrado los destinos ya no coincidirían.
 */
export async function getAdminPendingSummary(
  organizationId: string,
  userId: string,
  now = new Date(),
): Promise<AdminPendingGroup[]> {
  const nationalBase = {
    organizationId,
    source: "NATIONAL_BASE" as const,
  };

  const [
    overdueInternalCases,
    criticalUnassignedCases,
    campaignUnverified,
    campaignVerified,
    campaignOpen,
    campaignAssignedUnworked,
    campaignOverdue,
    teamsWithoutSupervisor,
    activeAgentsWithoutTeam,
    openEscalations,
    agrIntegration,
    logisticsPending,
  ] = await Promise.all([
    countOverdueInternalCases(organizationId, { userId, role: "ADMIN" }, now),
    database.recoveryCase.count({
      where: {
        organizationId,
        source: { in: ["INTERNAL_ORDER_STATE", "MANUAL"] },
        status: "OPEN",
        priority: "CRITICA",
        assignedUserId: null,
      },
    }),
    database.recoveryCase.count({
      where: {
        ...nationalBase,
        status: { in: ["TRIAGE", "WAITING"] },
        services: { some: { discardedAt: null, portabilityCheckedAt: null } },
      },
    }),
    database.recoveryCase.count({
      where: {
        ...nationalBase,
        status: "TRIAGE",
        services: { none: { discardedAt: null, portabilityCheckedAt: null } },
      },
    }),
    database.recoveryCase.count({
      where: { ...nationalBase, status: "OPEN" },
    }),
    database.recoveryCase.count({
      where: { ...nationalBase, status: "ASSIGNED", attempts: { none: {} } },
    }),
    database.recoveryCase.count({
      where: {
        ...nationalBase,
        status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"] },
        nextActionAt: { lt: now },
      },
    }),
    // SPEC-043 UX-04: la misma lista que abre «Sin supervisor» en Equipos.
    database.commercialTeam.count({
      where: {
        organizationId,
        status: "ACTIVE",
        members: {
          none: {
            memberRole: "SUPERVISOR",
            isActive: true,
            user: { status: "ACTIVE" },
          },
        },
      },
    }),
    // SPEC-043 UX-03: asesor activo sin equipo principal con venta habilitada.
    database.organizationMember.count({
      where: {
        organizationId,
        role: "AGENT",
        user: {
          status: "ACTIVE",
          commercialTeamMemberships: {
            none: {
              isActive: true,
              isPrimary: true,
              salesEnabled: true,
              team: { organizationId, status: "ACTIVE" },
            },
          },
        },
      },
    }),
    database.deliveryEscalation.count({
      where: { organizationId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    }),
    database.agrDeliveryIntegration.findUnique({
      where: { organizationId },
      select: { id: true },
    }),
    database.agrDeliveryOrderSnapshot.count({
      where: {
        organizationId,
        isRecoveryOpportunity: true,
        ditoOrder: {
          status: { not: "CLOSED" },
          deliveryStatus: { not: "DELIVERED" },
        },
      },
    }),
  ]);

  return describeAdminPending({
    overdueInternalCases,
    criticalUnassignedCases,
    campaignUnverified,
    campaignVerified,
    campaignOpen,
    campaignAssignedUnworked,
    campaignOverdue,
    teamsWithoutSupervisor,
    activeAgentsWithoutTeam,
    openEscalations,
    logisticsPending: agrIntegration ? logisticsPending : null,
  });
}
