import "server-only";

import {
  compareTeamMembers,
  getOrderPeriodRange,
  sumTeamDay,
  summarizeTeamMemberDay,
  type TeamDayTotals,
  type TeamMemberDaySummary,
} from "@repo/validation";

import { getMyDay } from "@/features/my-day/server/get-my-day";
import { database } from "@/server/database";

export interface TeamTodayData {
  generatedAt: Date;
  teamNames: string[];
  totals: TeamDayTotals;
  members: TeamMemberDaySummary[];
}

/**
 * Los asesores que un supervisor acompaña (SPEC-069 BR-010): activos, con
 * venta habilitada, de los equipos que supervisa, sin él mismo. «Ver su
 * día» usa lo mismo para no abrir el día de alguien fuera de su equipo.
 */
export async function getSupervisedAdvisors(
  organizationId: string,
  supervisorUserId: string,
): Promise<{
  teamNames: string[];
  advisors: Array<{ userId: string; name: string }>;
}> {
  const supervised = await database.commercialTeamMember.findMany({
    where: {
      userId: supervisorUserId,
      memberRole: "SUPERVISOR",
      isActive: true,
      team: { organizationId, status: "ACTIVE" },
    },
    select: { teamId: true, team: { select: { name: true } } },
  });
  const teamIds = supervised.map((item) => item.teamId);

  const memberships = await database.commercialTeamMember.findMany({
    where: {
      teamId: { in: teamIds },
      salesEnabled: true,
      isActive: true,
      isPrimary: true,
      userId: { not: supervisorUserId },
      user: { status: "ACTIVE" },
    },
    select: { userId: true, user: { select: { name: true } } },
  });

  // Un asesor en dos equipos del mismo supervisor aparece una vez.
  return {
    teamNames: supervised.map((item) => item.team.name),
    advisors: [
      ...new Map(
        memberships.map((item) => [item.userId, item.user.name]),
      ).entries(),
    ].map(([userId, name]) => ({ userId, name })),
  };
}

/**
 * Hoy en mi equipo — SPEC-069 fase 1. Los asesores activos con venta
 * habilitada de los equipos que el supervisor supervisa, sin él mismo
 * (BR-010). Cada uno se resume desde su propio «Mi día» (BR-002): no hay
 * reglas nuevas, así que la cifra de un asesor aquí es la que él ve.
 */
export async function getTeamToday(
  organizationId: string,
  supervisorUserId: string,
  now = new Date(),
): Promise<TeamTodayData> {
  const { teamNames, advisors } = await getSupervisedAdvisors(
    organizationId,
    supervisorUserId,
  );

  const todayStart = getOrderPeriodRange("TODAY", now).start;
  const [days, lastAttempts] = await Promise.all([
    Promise.all(
      advisors.map((advisor) =>
        getMyDay(organizationId, advisor.userId, now),
      ),
    ),
    database.recoveryCaseAttempt.groupBy({
      by: ["actorUserId"],
      where: {
        organizationId,
        actorUserId: { in: advisors.map((advisor) => advisor.userId) },
        ...(todayStart ? { createdAt: { gte: todayStart } } : {}),
      },
      _max: { createdAt: true },
    }),
  ]);
  const lastByUser = new Map(
    lastAttempts.map((row) => [row.actorUserId, row._max.createdAt]),
  );

  const members = advisors
    .map((advisor, index) => {
      const day = days[index]!;
      return summarizeTeamMemberDay(
        {
          userId: advisor.userId,
          name: advisor.name,
          now: day.now.map((entry) => ({
            kind: entry.kind,
            tier: entry.tier,
            overdue: entry.overdue,
          })),
          campaignTotal: day.campaign.total,
          coldCount: day.cold.length,
          attemptsToday: day.progress.attemptsToday,
          enteredToday: day.progress.enteredToday,
          quotaDelivered: day.progress.quota.delivered,
          quotaTarget: day.progress.quota.target,
          lastAttemptAt: lastByUser.get(advisor.userId) ?? null,
        },
        now,
      );
    })
    .sort(compareTeamMembers);

  return {
    generatedAt: now,
    teamNames,
    totals: sumTeamDay(members),
    members,
  };
}
