import "server-only";

import {
  formatAdvisorDisplayName,
  getDefaultQuotaTarget,
  getQuotaPlanningLimit,
  isQuotaPeriodEditable,
  parseQuotaPeriod,
  parsePerformanceMonth,
  resolveRelevantAcceleratorWindow,
  summarizeQuotaDistribution,
} from "@repo/validation";

import { database } from "@/server/database";

import { resolvePerformanceScope } from "./performance-access";

import type { PerformanceAccess } from "./performance-access";
import type { QuotaDistributionSummary } from "@repo/validation";

export type QuotaWindowKey = "ONE" | "TWO";

export interface QuotaAdvisorRow {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  target: number;
  isDefault: boolean;
}

export interface QuotaTeamRow {
  id: string;
  name: string;
  target: number;
  isDefault: boolean;
  /** Sin supervisor propio, el reparto entre sus asesores lo hace ADMIN. */
  hasSupervisor: boolean;
  advisors: QuotaAdvisorRow[];
  distribution: QuotaDistributionSummary;
}

export interface PerformanceQuotasData {
  periodKey: string;
  periodLabel: string;
  currentPeriodKey: string;
  planningLimit: string;
  editable: boolean;
  /** Cuota de toda la organización: la que el dueño fija y se reparte. */
  organization: {
    target: number;
    isDefault: boolean;
    canAssign: boolean;
    distribution: QuotaDistributionSummary;
  };
  window: QuotaWindowKey;
  windowLabel: string;
  windowOptions: Array<{ key: QuotaWindowKey; label: string }>;
  canAssignTeams: boolean;
  canAssignAdvisors: boolean;
  teams: QuotaTeamRow[];
}

const monthLabelFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  month: "long",
  year: "numeric",
});

export async function getPerformanceQuotas(
  organizationId: string,
  access: PerformanceAccess,
  query: { period?: string; window?: string },
): Promise<PerformanceQuotasData> {
  const now = new Date();
  const currentPeriodKey = parsePerformanceMonth(undefined, now);
  // Una cuota se fija antes del período, así que el selector admite el futuro.
  const periodKey = parseQuotaPeriod(query.period, now);
  const relevantWindow = resolveRelevantAcceleratorWindow(now);
  const window: QuotaWindowKey =
    query.window === "ONE" || query.window === "TWO"
      ? query.window
      : ((relevantWindow?.key as QuotaWindowKey | undefined) ?? "ONE");

  const { teamOptions, supervisedTeamIds } = await resolvePerformanceScope(
    organizationId,
    access,
  );
  const scopedTeamIds =
    access.role === "SUPERVISOR"
      ? supervisedTeamIds
      : teamOptions.map((team) => team.id);

  const [memberships, supervisorRows, quotas] = await Promise.all([
    database.commercialTeamMember.findMany({
      where: {
        salesEnabled: true,
        isActive: true,
        isPrimary: true,
        teamId: { in: scopedTeamIds },
        user: { status: "ACTIVE" },
        team: { organizationId, status: "ACTIVE" },
      },
      select: {
        userId: true,
        teamId: true,
        user: { select: { name: true, email: true } },
        team: { select: { name: true } },
      },
    }),
    database.commercialTeamMember.findMany({
      where: {
        memberRole: "SUPERVISOR",
        isActive: true,
        teamId: { in: scopedTeamIds },
        user: { status: "ACTIVE" },
        team: { organizationId, status: "ACTIVE" },
      },
      select: { teamId: true },
    }),
    database.performanceQuota.findMany({
      where: { organizationId, periodKey, window },
      select: { teamId: true, userId: true, target: true },
    }),
  ]);

  const teamsWithSupervisor = new Set(supervisorRows.map((row) => row.teamId));
  const organizationQuota = quotas.find(
    (quota) => quota.teamId === null && quota.userId === null,
  );
  const teamTargets = new Map(
    quotas
      .filter((quota) => quota.teamId !== null)
      .map((quota) => [quota.teamId as string, quota.target]),
  );
  const userTargets = new Map(
    quotas
      .filter((quota) => quota.userId !== null)
      .map((quota) => [quota.userId as string, quota.target]),
  );
  const defaultTarget = getDefaultQuotaTarget(window);

  const teams: QuotaTeamRow[] = teamOptions
    .filter((team) => scopedTeamIds.includes(team.id))
    .map((team) => {
      const advisors = memberships
        .filter((membership) => membership.teamId === team.id)
        .map((membership): QuotaAdvisorRow => {
          const stored = userTargets.get(membership.userId);
          return {
            id: membership.userId,
            name: formatAdvisorDisplayName(
              membership.user.name,
              membership.user.email,
            ),
            teamId: team.id,
            teamName: membership.team.name,
            target: stored ?? defaultTarget,
            isDefault: stored === undefined,
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name, "es"));

      const storedTeamTarget = teamTargets.get(team.id);
      // Sin cuota de equipo, el objetivo por defecto es el tramo por cada
      // vendedor: es la lectura natural de "que todos lleguen" (BR-008).
      const teamTarget = storedTeamTarget ?? defaultTarget * advisors.length;

      return {
        id: team.id,
        name: team.name,
        target: teamTarget,
        isDefault: storedTeamTarget === undefined,
        hasSupervisor: teamsWithSupervisor.has(team.id),
        advisors,
        distribution: summarizeQuotaDistribution({
          teamTarget,
          advisorTargets: advisors.map((advisor) => advisor.target),
        }),
      };
    });

  const organizationTarget =
    organizationQuota?.target ??
    teams.reduce((total, team) => total + team.target, 0);

  return {
    periodKey,
    periodLabel: monthLabelFormatter.format(
      new Date(`${periodKey}-01T12:00:00.000Z`),
    ),
    currentPeriodKey,
    planningLimit: getQuotaPlanningLimit(now),
    editable: isQuotaPeriodEditable(periodKey, currentPeriodKey),
    organization: {
      target: organizationTarget,
      isDefault: organizationQuota === undefined,
      // Sin rol de dueño en el sistema, la cuota de la organización la fija
      // administración; es el ancla de toda la cadena de reparto.
      canAssign: access.role === "ADMIN",
      distribution: summarizeQuotaDistribution({
        teamTarget: organizationTarget,
        advisorTargets: teams.map((team) => team.target),
      }),
    },
    window,
    windowLabel: window === "ONE" ? "Días 1 al 15" : "Día 25 al fin de mes",
    windowOptions: [
      { key: "ONE", label: "Días 1 al 15" },
      { key: "TWO", label: "Día 25 al fin de mes" },
    ],
    canAssignTeams: access.role === "ADMIN" || access.role === "BACKOFFICE",
    canAssignAdvisors: access.role !== "AGENT",
    teams,
  };
}
