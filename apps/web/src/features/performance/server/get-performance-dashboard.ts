import "server-only";

import {
  calculatePerformanceMetrics,
  evaluatePerformanceOrderPayment,
  getOrderPeriodRange,
  getPotentialBaseCommissionCents,
  getPerformanceMonthRange,
  parsePerformanceMonth,
  resolveDitoOrderScope,
  shiftPerformanceMonth,
} from "@repo/validation";

import { database } from "@/server/database";

import type { Prisma } from "@repo/database";
import type {
  PerformanceMetrics,
  PerformanceOrderInput,
} from "@repo/validation";

import type {
  AgentDailyPerformance,
  PerformanceDashboardData,
  PerformanceRole,
} from "../performance.types";

interface PerformanceAccess {
  userId: string;
  role: PerformanceRole;
}

interface PerformanceQuery {
  month: string;
  team?: string;
}

const monthLabelFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const limaDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dailyLabelFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "short",
  day: "numeric",
});

const orderSelect = {
  commercialOperation: true,
  status: true,
  deliveryStatus: true,
  sentSubstatus: true,
  registeredAt: true,
  deliveredAt: true,
  closedAt: true,
  agentUserId: true,
  assignedTeamId: true,
  agent: { select: { name: true } },
  assignedTeam: { select: { name: true } },
} satisfies Prisma.DitoOrderSelect;

type PerformanceOrderRecord = Prisma.DitoOrderGetPayload<{
  select: typeof orderSelect;
}>;

function toMetricInput(order: PerformanceOrderRecord): PerformanceOrderInput {
  return {
    commercialOperation: order.commercialOperation,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    sentSubstatus: order.sentSubstatus,
    registeredAt: order.registeredAt,
    deliveredAt: order.deliveredAt,
    closedAt: order.closedAt,
    agentUserId: order.agentUserId,
    assignedTeamId: order.assignedTeamId,
  };
}

function percentDelta(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

function pointsDelta(
  current: number | null,
  previous: number | null,
): number | null {
  return current === null || previous === null ? null : current - previous;
}

function getAccessWhere(
  role: PerformanceRole,
  userId: string,
  supervisedTeamIds: readonly string[],
): Prisma.DitoOrderWhereInput {
  const scope = resolveDitoOrderScope({ role, userId, supervisedTeamIds });

  if (scope.kind === "AGENT") return { agentUserId: scope.userId };
  if (scope.kind === "SUPERVISED_TEAMS_WITH_ORPHANS") {
    return {
      OR: [
        { assignedTeamId: { in: [...scope.teamIds] } },
        { agentUserId: null, assignedTeamId: null },
      ],
    };
  }
  if (scope.kind === "NONE") return { assignedTeamId: { in: [] } };
  return {};
}

function groupByAgent(
  orders: readonly PerformanceOrderRecord[],
  role: PerformanceRole,
  primaryTeamNames: ReadonlyMap<string, string>,
) {
  const groups = new Map<string, PerformanceOrderRecord[]>();

  for (const order of orders) {
    if (!order.agentUserId) continue;
    const group = groups.get(order.agentUserId) ?? [];
    group.push(order);
    groups.set(order.agentUserId, group);
  }

  return [...groups.entries()]
    .map(([id, agentOrders]) => {
      const assignedTeamNames = [
        ...new Set(
          agentOrders
            .map((order) => order.assignedTeam?.name)
            .filter((name): name is string => Boolean(name)),
        ),
      ];
      const primaryTeamName = primaryTeamNames.get(id);
      const teamName =
        assignedTeamNames.length > 1
          ? "Varios equipos"
          : (assignedTeamNames[0] ??
            (primaryTeamName ? `Equipo actual · ${primaryTeamName}` : null));

      return {
        id,
        name: agentOrders[0]?.agent?.name ?? "Asesor sin nombre",
        teamName,
        metrics:
          role === "ADMIN"
            ? calculatePerformanceMetrics(agentOrders.map(toMetricInput))
            : redactCommission(
                calculatePerformanceMetrics(agentOrders.map(toMetricInput)),
              ),
        showCommission: role === "ADMIN",
      };
    })
    .sort(
      (left, right) =>
        right.metrics.payable - left.metrics.payable ||
        right.metrics.entered - left.metrics.entered ||
        left.name.localeCompare(right.name, "es"),
    );
}

function redactCommission(metrics: PerformanceMetrics): PerformanceMetrics {
  return {
    ...metrics,
    baseCommissionCents: 0,
    acceleratorOne: {
      ...metrics.acceleratorOne,
      amountCents: 0,
      nextTarget: null,
      missingForNextTarget: 0,
    },
    estimatedCommissionCents: 0,
  };
}

function calculateScopedMetrics(
  orders: readonly PerformanceOrderRecord[],
  isIndividualScope: boolean,
): PerformanceMetrics {
  const metrics = calculatePerformanceMetrics(orders.map(toMetricInput));
  if (isIndividualScope) return metrics;

  const groupedOrders = new Map<string, PerformanceOrderRecord[]>();
  for (const order of orders) {
    if (!order.agentUserId) continue;
    const group = groupedOrders.get(order.agentUserId) ?? [];
    group.push(order);
    groupedOrders.set(order.agentUserId, group);
  }

  const individualMetrics = [...groupedOrders.values()].map((group) =>
    calculatePerformanceMetrics(group.map(toMetricInput)),
  );
  const baseCommissionCents = individualMetrics.reduce(
    (total, item) => total + item.baseCommissionCents,
    0,
  );
  const acceleratorAmountCents = individualMetrics.reduce(
    (total, item) => total + item.acceleratorOne.amountCents,
    0,
  );

  return {
    ...metrics,
    baseCommissionCents,
    acceleratorOne: {
      eligible: individualMetrics.reduce(
        (total, item) => total + item.acceleratorOne.eligible,
        0,
      ),
      confirmed: individualMetrics.reduce(
        (total, item) => total + item.acceleratorOne.confirmed,
        0,
      ),
      amountCents: acceleratorAmountCents,
      nextTarget: null,
      missingForNextTarget: 0,
    },
    estimatedCommissionCents: baseCommissionCents + acceleratorAmountCents,
  };
}

function buildAgentDailyPulse(
  activityOrders: readonly PerformanceOrderRecord[],
  confirmationOrders: readonly PerformanceOrderRecord[],
  todayStart: Date,
  todayEnd: Date,
): AgentDailyPerformance {
  const dayLength = 24 * 60 * 60 * 1000;
  const days = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(todayStart.getTime() - (6 - index) * dayLength);
    return {
      key: limaDateKeyFormatter.format(start),
      label: dailyLabelFormatter.format(start).replace(".", ""),
      entered: 0,
      potentialCommissionCents: 0,
      confirmed: 0,
      confirmedBaseCommissionCents: 0,
      isToday: index === 6,
    };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  for (const order of activityOrders) {
    const day = byKey.get(limaDateKeyFormatter.format(order.registeredAt));
    if (!day) continue;
    day.entered += 1;
    day.potentialCommissionCents += getPotentialBaseCommissionCents(
      order.commercialOperation,
    );
  }

  for (const order of confirmationOrders) {
    if (!order.closedAt) continue;
    const evaluation = evaluatePerformanceOrderPayment(toMetricInput(order));
    if (!evaluation.payable) continue;
    const day = byKey.get(limaDateKeyFormatter.format(order.closedAt));
    if (!day) continue;
    day.confirmed += 1;
    day.confirmedBaseCommissionCents += evaluation.baseCommissionCents;
  }

  const today = days.at(-1);
  if (!today) throw new Error("No se pudo construir el pulso diario.");

  return {
    todayLabel: dailyLabelFormatter.format(todayEnd.getTime() - 1),
    entered: today.entered,
    potentialCommissionCents: today.potentialCommissionCents,
    confirmed: today.confirmed,
    confirmedBaseCommissionCents: today.confirmedBaseCommissionCents,
    days,
  };
}

export async function getPerformanceDashboard(
  organizationId: string,
  access: PerformanceAccess,
  query: PerformanceQuery,
): Promise<PerformanceDashboardData> {
  const now = new Date();
  const currentMonth = parsePerformanceMonth(undefined, now);
  const currentRange = getPerformanceMonthRange(query.month);
  const previousMonth = shiftPerformanceMonth(currentRange.key, -1);
  const previousRange = getPerformanceMonthRange(previousMonth);

  const teamAccessWhere = {
    organizationId,
    status: "ACTIVE" as const,
    ...(access.role === "SUPERVISOR"
      ? {
          members: {
            some: {
              userId: access.userId,
              memberRole: "SUPERVISOR" as const,
              isActive: true,
            },
          },
        }
      : {}),
  };
  const teamOptions =
    access.role === "AGENT"
      ? []
      : await database.commercialTeam.findMany({
          where: teamAccessWhere,
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        });
  const supervisedTeamIds =
    access.role === "SUPERVISOR" ? teamOptions.map((team) => team.id) : [];
  const requestedTeam = query.team?.trim() ?? "";
  const teamFilter = teamOptions.some((team) => team.id === requestedTeam)
    ? requestedTeam
    : "ALL";
  const accessWhere = getAccessWhere(
    access.role,
    access.userId,
    supervisedTeamIds,
  );
  const teamWhere: Prisma.DitoOrderWhereInput =
    teamFilter === "ALL" ? {} : { assignedTeamId: teamFilter };
  const isAgentCurrentMonth =
    access.role === "AGENT" && currentRange.key === currentMonth;
  const todayRange = getOrderPeriodRange("TODAY", now);
  if (!todayRange.start || !todayRange.end) {
    throw new Error("No se pudo resolver el dia actual.");
  }
  const lastSevenDaysStart = new Date(
    todayRange.start.getTime() - 6 * 24 * 60 * 60 * 1000,
  );

  const [orders, previousOrders, activityOrders, confirmationOrders] =
    await Promise.all([
      database.ditoOrder.findMany({
        where: {
          organizationId,
          AND: [
            accessWhere,
            teamWhere,
            {
              registeredAt: { gte: currentRange.start, lt: currentRange.end },
            },
          ],
        },
        select: orderSelect,
      }),
      database.ditoOrder.findMany({
        where: {
          organizationId,
          AND: [
            accessWhere,
            teamWhere,
            {
              registeredAt: { gte: previousRange.start, lt: previousRange.end },
            },
          ],
        },
        select: orderSelect,
      }),
      isAgentCurrentMonth
        ? database.ditoOrder.findMany({
            where: {
              organizationId,
              AND: [
                accessWhere,
                {
                  registeredAt: {
                    gte: lastSevenDaysStart,
                    lt: todayRange.end,
                  },
                },
              ],
            },
            select: orderSelect,
          })
        : Promise.resolve([]),
      isAgentCurrentMonth
        ? database.ditoOrder.findMany({
            where: {
              organizationId,
              AND: [
                accessWhere,
                {
                  closedAt: {
                    gte: lastSevenDaysStart,
                    lt: todayRange.end,
                  },
                },
              ],
            },
            select: orderSelect,
          })
        : Promise.resolve([]),
    ]);

  const visibleAgentIds = [
    ...new Set(
      orders
        .map((order) => order.agentUserId)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const primaryTeamMemberships =
    access.role === "AGENT" || visibleAgentIds.length === 0
      ? []
      : await database.commercialTeamMember.findMany({
          where: {
            userId: { in: visibleAgentIds },
            memberRole: "AGENT",
            isActive: true,
            isPrimary: true,
            team: { organizationId, status: "ACTIVE" },
          },
          select: { userId: true, team: { select: { name: true } } },
        });
  const primaryTeamsByAgent = new Map<string, string[]>();
  for (const membership of primaryTeamMemberships) {
    const teams = primaryTeamsByAgent.get(membership.userId) ?? [];
    teams.push(membership.team.name);
    primaryTeamsByAgent.set(membership.userId, teams);
  }
  const primaryTeamNames = new Map(
    [...primaryTeamsByAgent.entries()]
      .filter(([, teams]) => teams.length === 1)
      .map(([userId, teams]) => [userId, teams[0] ?? ""]),
  );

  const scopedMetrics = calculateScopedMetrics(orders, access.role === "AGENT");
  const scopedPreviousMetrics = calculateScopedMetrics(
    previousOrders,
    access.role === "AGENT",
  );
  const metrics =
    access.role === "BACKOFFICE"
      ? redactCommission(scopedMetrics)
      : scopedMetrics;
  const previousMetrics =
    access.role === "BACKOFFICE"
      ? redactCommission(scopedPreviousMetrics)
      : scopedPreviousMetrics;
  const hasBase = previousMetrics.entered > 0;
  const selectedTeam = teamOptions.find((team) => team.id === teamFilter);

  return {
    generatedAt: dateTimeFormatter.format(now),
    role: access.role,
    month: currentRange.key,
    currentMonth,
    monthLabel: monthLabelFormatter.format(currentRange.start),
    previousMonth,
    nextMonth: shiftPerformanceMonth(currentRange.key, 1),
    isCurrentMonth: currentRange.key === currentMonth,
    from: currentRange.from,
    to: currentRange.to,
    scopeLabel:
      access.role === "AGENT"
        ? "Mi desempeño"
        : (selectedTeam?.name ??
          (access.role === "SUPERVISOR" ? "Mis equipos" : "Organización")),
    teamFilter,
    teamOptions,
    showTeamFilter: access.role !== "AGENT" && teamOptions.length > 0,
    showCommission: access.role !== "BACKOFFICE",
    dailyPulse: isAgentCurrentMonth
      ? buildAgentDailyPulse(
          activityOrders,
          confirmationOrders,
          todayRange.start,
          todayRange.end,
        )
      : null,
    metrics,
    previousMetrics,
    comparison: {
      hasBase,
      enteredDelta: hasBase
        ? percentDelta(metrics.entered, previousMetrics.entered)
        : null,
      payableDelta: hasBase
        ? percentDelta(metrics.payable, previousMetrics.payable)
        : null,
      payableRateDelta: hasBase
        ? pointsDelta(metrics.payableRate, previousMetrics.payableRate)
        : null,
    },
    breakdown:
      access.role === "AGENT"
        ? []
        : groupByAgent(orders, access.role, primaryTeamNames),
  };
}
