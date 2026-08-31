import "server-only";

import {
  formatAdvisorDisplayName,
  getDefaultQuotaTarget,
  isQuotaPeriodEditable,
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
  advisors: QuotaAdvisorRow[];
  distribution: QuotaDistributionSummary;
}

export interface PerformanceQuotasData {
  periodKey: string;
  periodLabel: string;
  currentPeriodKey: string;
  editable: boolean;
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
  const periodKey = parsePerformanceMonth(query.period, now);
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

  const [memberships, quotas] = await Promise.all([
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
    database.performanceQuota.findMany({
      where: { organizationId, periodKey, window },
      select: { teamId: true, userId: true, target: true },
    }),
  ]);

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
        advisors,
        distribution: summarizeQuotaDistribution({
          teamTarget,
          advisorTargets: advisors.map((advisor) => advisor.target),
        }),
      };
    });

  return {
    periodKey,
    periodLabel: monthLabelFormatter.format(
      new Date(`${periodKey}-01T12:00:00.000Z`),
    ),
    currentPeriodKey,
    editable: isQuotaPeriodEditable(periodKey, currentPeriodKey),
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
