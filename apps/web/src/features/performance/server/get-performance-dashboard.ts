import "server-only";

import {
  calculatePerformanceMetrics,
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
) {
  const groups = new Map<string, PerformanceOrderRecord[]>();

  for (const order of orders) {
    if (!order.agentUserId) continue;
    const group = groups.get(order.agentUserId) ?? [];
    group.push(order);
    groups.set(order.agentUserId, group);
  }

  return [...groups.entries()]
    .map(([id, agentOrders]) => ({
      id,
      name: agentOrders[0]?.agent?.name ?? "Asesor sin nombre",
      teamName: agentOrders[0]?.assignedTeam?.name ?? null,
      metrics:
        role === "ADMIN"
          ? calculatePerformanceMetrics(agentOrders.map(toMetricInput))
          : redactCommission(
              calculatePerformanceMetrics(agentOrders.map(toMetricInput)),
            ),
      showCommission: role === "ADMIN",
    }))
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

  const [orders, previousOrders] = await Promise.all([
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
  ]);

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
        : selectedTeam?.name ??
          (access.role === "SUPERVISOR" ? "Mis equipos" : "Organización"),
    teamFilter,
    teamOptions,
    showTeamFilter: access.role !== "AGENT" && teamOptions.length > 0,
    showCommission: access.role !== "BACKOFFICE",
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
      access.role === "AGENT" ? [] : groupByAgent(orders, access.role),
  };
}
