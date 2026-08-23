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
  DailyPerformance,
  MonthlyPerformanceProgress,
  PerformanceDashboardData,
  PerformanceRole,
  SalesOperationMixItem,
} from "../performance.types";

interface PerformanceAccess {
  userId: string;
  role: PerformanceRole;
}

interface PerformanceQuery {
  month: string;
  team?: string;
  view?: "SELF" | "TEAM";
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
  previousOrders: readonly PerformanceOrderRecord[],
  role: PerformanceRole,
  primaryTeamNames: ReadonlyMap<string, string>,
  activeSellers: ReadonlyMap<string, { name: string; teamName: string }>,
  monthDayKeys: readonly string[],
) {
  const groups = new Map<string, PerformanceOrderRecord[]>();
  const previousGroups = new Map<string, PerformanceOrderRecord[]>();

  for (const order of orders) {
    if (!order.agentUserId) continue;
    const group = groups.get(order.agentUserId) ?? [];
    group.push(order);
    groups.set(order.agentUserId, group);
  }

  for (const order of previousOrders) {
    if (!order.agentUserId) continue;
    const group = previousGroups.get(order.agentUserId) ?? [];
    group.push(order);
    previousGroups.set(order.agentUserId, group);
  }

  const agentIds = new Set([
    ...groups.keys(),
    ...previousGroups.keys(),
    ...activeSellers.keys(),
  ]);

  return [...agentIds]
    .map((id) => {
      const agentOrders = groups.get(id) ?? [];
      const previousAgentOrders = previousGroups.get(id) ?? [];
      const activeSeller = activeSellers.get(id);
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
            activeSeller?.teamName ??
            (primaryTeamName ? `Equipo actual · ${primaryTeamName}` : null));
      const currentMetrics = calculatePerformanceMetrics(
        agentOrders.map(toMetricInput),
      );
      const previousAgentMetrics = calculatePerformanceMetrics(
        previousAgentOrders.map(toMetricInput),
      );
      const dailyCounts = new Map<string, number>();
      for (const order of agentOrders) {
        const key = limaDateKeyFormatter.format(order.registeredAt);
        dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
      }

      return {
        id,
        name:
          agentOrders[0]?.agent?.name ??
          previousAgentOrders[0]?.agent?.name ??
          activeSeller?.name ??
          "Asesor sin nombre",
        teamName,
        metrics:
          role === "ADMIN" ? currentMetrics : redactCommission(currentMetrics),
        previousMetrics:
          role === "ADMIN"
            ? previousAgentMetrics
            : redactCommission(previousAgentMetrics),
        enteredDelta: percentDelta(
          currentMetrics.entered,
          previousAgentMetrics.entered,
        ),
        isActiveSeller: activeSeller !== undefined,
        showCommission: role === "ADMIN",
        dailyEntered: monthDayKeys.map((key) => dailyCounts.get(key) ?? 0),
      };
    })
    .sort(
      (left, right) =>
        right.metrics.payable - left.metrics.payable ||
        right.metrics.entered - left.metrics.entered ||
        left.name.localeCompare(right.name, "es"),
    );
}

function buildMonthlyPerformanceProgress(
  orders: readonly PerformanceOrderRecord[],
  closureOrders: readonly PerformanceOrderRecord[],
  start: Date,
  end: Date,
  now: Date,
): MonthlyPerformanceProgress {
  const dayLength = 24 * 60 * 60 * 1000;
  const todayKey = limaDateKeyFormatter.format(now);
  const counts = new Map<string, number>();
  const closureCounts = new Map<string, number>();

  for (const order of orders) {
    const key = limaDateKeyFormatter.format(order.registeredAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const order of closureOrders) {
    if (!order.closedAt || order.status !== "CLOSED") continue;
    const key = limaDateKeyFormatter.format(order.closedAt);
    closureCounts.set(key, (closureCounts.get(key) ?? 0) + 1);
  }

  let cumulative = 0;
  const days = [];
  for (
    let instant = start.getTime();
    instant < end.getTime();
    instant += dayLength
  ) {
    const date = new Date(instant);
    const key = limaDateKeyFormatter.format(date);
    const entered = counts.get(key) ?? 0;
    cumulative += entered;
    days.push({
      key,
      day: Number(key.slice(-2)),
      label: dailyLabelFormatter.format(date).replace(".", ""),
      entered,
      closed: closureCounts.get(key) ?? 0,
      cumulative,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    });
  }

  const elapsedDays = days.filter((day) => !day.isFuture).length;
  const productiveDays = days.filter(
    (day) => !day.isFuture && day.entered > 0,
  ).length;
  const bestDay =
    days
      .filter((day) => !day.isFuture && day.entered > 0)
      .sort(
        (left, right) => right.entered - left.entered || left.day - right.day,
      )[0] ?? null;

  return {
    days,
    elapsedDays,
    productiveDays,
    averagePerElapsedDay: elapsedDays > 0 ? orders.length / elapsedDays : 0,
    bestDay,
  };
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

function buildDailyPerformancePulse(
  activityOrders: readonly PerformanceOrderRecord[],
  confirmationOrders: readonly PerformanceOrderRecord[],
  todayStart: Date,
  todayEnd: Date,
): DailyPerformance {
  const dayLength = 24 * 60 * 60 * 1000;
  const days = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(todayStart.getTime() - (6 - index) * dayLength);
    return {
      key: limaDateKeyFormatter.format(start),
      label: dailyLabelFormatter.format(start).replace(".", ""),
      entered: 0,
      potentialCommissionCents: 0,
      closed: 0,
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
    if (!order.closedAt || order.status !== "CLOSED") continue;
    const day = byKey.get(limaDateKeyFormatter.format(order.closedAt));
    if (!day) continue;
    day.closed += 1;

    const evaluation = evaluatePerformanceOrderPayment(toMetricInput(order));
    if (!evaluation.payable) continue;
    day.confirmed += 1;
    day.confirmedBaseCommissionCents += evaluation.baseCommissionCents;
  }

  const today = days.at(-1);
  if (!today) throw new Error("No se pudo construir el pulso diario.");

  return {
    todayLabel: dailyLabelFormatter.format(todayEnd.getTime() - 1),
    entered: today.entered,
    potentialCommissionCents: today.potentialCommissionCents,
    closed: today.closed,
    confirmed: today.confirmed,
    confirmedBaseCommissionCents: today.confirmedBaseCommissionCents,
    days,
  };
}

function emptySalesOperationMix(): SalesOperationMixItem {
  return {
    total: 0,
    newLine: 0,
    portPostpaid: 0,
    portPrepaid: 0,
    unclassified: 0,
    payablePortPostpaid: 0,
    payablePortPrepaid: 0,
  };
}

function addToSalesOperationMix(
  mix: SalesOperationMixItem,
  order: PerformanceOrderRecord,
): void {
  const isDelivered =
    order.deliveryStatus === "DELIVERED" && order.deliveredAt !== null;
  if (!isDelivered) return;

  mix.total += 1;

  if (order.commercialOperation === "NEW_LINE") mix.newLine += 1;
  else if (order.commercialOperation === "PORT_POSTPAID") {
    mix.portPostpaid += 1;
    if (order.status === "CLOSED" && order.closedAt !== null) {
      mix.payablePortPostpaid += 1;
    }
  } else if (order.commercialOperation === "PORT_PREPAID") {
    mix.portPrepaid += 1;
    if (order.status === "CLOSED" && order.closedAt !== null) {
      mix.payablePortPrepaid += 1;
    }
  } else mix.unclassified += 1;
}

function buildSalesOperationMix(
  orders: readonly PerformanceOrderRecord[],
): SalesOperationMixItem {
  const aggregate = emptySalesOperationMix();

  for (const order of orders) {
    addToSalesOperationMix(aggregate, order);
  }

  return aggregate;
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
  const primarySalesMembership =
    access.role === "SUPERVISOR"
      ? await database.commercialTeamMember.findFirst({
          where: {
            userId: access.userId,
            salesEnabled: true,
            isPrimary: true,
            isActive: true,
            team: { organizationId, status: "ACTIVE" },
          },
          select: { teamId: true },
        })
      : null;
  const canSwitchView = primarySalesMembership !== null;
  const view =
    access.role === "AGENT" || (canSwitchView && query.view === "SELF")
      ? "SELF"
      : "TEAM";
  const isIndividualScope = view === "SELF";
  const requestedTeam = query.team?.trim() ?? "";
  const teamFilter =
    !isIndividualScope && teamOptions.some((team) => team.id === requestedTeam)
      ? requestedTeam
      : "ALL";
  const accessWhere = isIndividualScope
    ? { agentUserId: access.userId }
    : getAccessWhere(access.role, access.userId, supervisedTeamIds);
  const teamWhere: Prisma.DitoOrderWhereInput =
    teamFilter === "ALL" ? {} : { assignedTeamId: teamFilter };
  const showDailyPulse = currentRange.key === currentMonth;
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
      showDailyPulse
        ? database.ditoOrder.findMany({
            where: {
              organizationId,
              AND: [
                accessWhere,
                teamWhere,
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
      database.ditoOrder.findMany({
        where: {
          organizationId,
          AND: [
            accessWhere,
            teamWhere,
            {
              closedAt: {
                gte: currentRange.start,
                lt: currentRange.end,
              },
            },
          ],
        },
        select: orderSelect,
      }),
    ]);

  const primaryTeamMemberships = isIndividualScope
    ? []
    : await database.commercialTeamMember.findMany({
        where: {
          salesEnabled: true,
          isActive: true,
          isPrimary: true,
          ...(access.role === "SUPERVISOR"
            ? { teamId: { in: supervisedTeamIds } }
            : {}),
          team: {
            organizationId,
            status: "ACTIVE",
            ...(teamFilter === "ALL" ? {} : { id: teamFilter }),
          },
          user: {
            status: "ACTIVE",
            memberships: {
              some: {
                organizationId,
                role: { in: ["AGENT", "SUPERVISOR"] },
              },
            },
          },
        },
        select: {
          userId: true,
          user: { select: { name: true } },
          team: { select: { name: true } },
        },
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
  const activeSellers = new Map(
    primaryTeamMemberships.map((membership) => [
      membership.userId,
      {
        name: membership.user.name,
        teamName: membership.team.name,
      },
    ]),
  );

  const scopedMetrics = calculateScopedMetrics(orders, isIndividualScope);
  const scopedPreviousMetrics = calculateScopedMetrics(
    previousOrders,
    isIndividualScope,
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
  const monthProgress = buildMonthlyPerformanceProgress(
    orders,
    confirmationOrders,
    currentRange.start,
    currentRange.end,
    now,
  );
  const salesMix = buildSalesOperationMix(orders);

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
    scopeLabel: isIndividualScope
      ? "Mi desempeño"
      : (selectedTeam?.name ??
        (access.role === "SUPERVISOR" ? "Mis equipos" : "Organización")),
    view,
    canSwitchView,
    teamFilter,
    teamOptions,
    showTeamFilter: !isIndividualScope && teamOptions.length > 0,
    showCommission: access.role !== "BACKOFFICE",
    salesMix,
    monthProgress,
    dailyPulse: showDailyPulse
      ? buildDailyPerformancePulse(
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
    workforce: isIndividualScope
      ? null
      : {
          activeSellers: activeSellers.size,
          sellersWithSales: [...activeSellers.keys()].filter((userId) =>
            orders.some((order) => order.agentUserId === userId),
          ).length,
          sellersWithoutSales: [...activeSellers.keys()].filter(
            (userId) => !orders.some((order) => order.agentUserId === userId),
          ).length,
          averageEnteredPerSeller:
            activeSellers.size > 0
              ? orders.filter(
                  (order) =>
                    order.agentUserId !== null &&
                    activeSellers.has(order.agentUserId),
                ).length / activeSellers.size
              : null,
        },
    breakdown: isIndividualScope
      ? []
      : groupByAgent(
          orders,
          previousOrders,
          access.role,
          primaryTeamNames,
          activeSellers,
          monthProgress.days.map((day) => day.key),
        ),
  };
}
