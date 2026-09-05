import "server-only";

import {
  calculatePerformanceMetrics,
  evaluatePerformanceOrderPayment,
  filterOrdersRegisteredThroughLimaDay,
  formatAdvisorDisplayName,
  getDefaultQuotaTarget,
  getLimaDayOfMonth,
  getOrderPeriodRange,
  getPotentialBaseCommissionCents,
  getPerformanceMonthRange,
  parsePerformanceMonth,
  resolveCurrentAcceleratorWindow,
  resolveRelevantAcceleratorWindow,
  shiftPerformanceMonth,
} from "@repo/validation";

import { database } from "@/server/database";

import {
  getPerformanceAccessWhere,
  resolveRequestedAdvisor,
} from "./performance-access";

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
  agent?: string;
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
  agent: { select: { name: true, email: true } },
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

function groupByAgent(
  orders: readonly PerformanceOrderRecord[],
  previousOrders: readonly PerformanceOrderRecord[],
  role: PerformanceRole,
  primaryTeamNames: ReadonlyMap<string, string>,
  activeSellers: ReadonlyMap<
    string,
    { name: string; email: string; teamName: string }
  >,
  monthDayKeys: readonly string[],
  quotaWindowKey: "ONE" | "TWO" | null,
  quotaTargets: ReadonlyMap<string, number>,
  openRecoveryCases: ReadonlyMap<string, number>,
) {
  const showsIndividualCommission = role === "ADMIN" || role === "SUPERVISOR";
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

      const agentRecord =
        agentOrders[0]?.agent ?? previousAgentOrders[0]?.agent;
      const rawName = agentRecord?.name ?? activeSeller?.name ?? "";
      const email = agentRecord?.email ?? activeSeller?.email ?? "";

      return {
        id,
        // BR-017: la presentación normaliza; el nombre registrado no cambia.
        name: formatAdvisorDisplayName(rawName, email) || "Asesor sin nombre",
        teamName,
        // SPEC-014: el supervisor ve el importe individual de sus asesores
        // —decisión del 31/08/2026—; BACKOFFICE nunca ve montos.
        metrics: showsIndividualCommission
          ? currentMetrics
          : redactCommission(currentMetrics),
        previousMetrics: showsIndividualCommission
          ? previousAgentMetrics
          : redactCommission(previousAgentMetrics),
        enteredDelta: percentDelta(
          currentMetrics.entered,
          previousAgentMetrics.entered,
        ),
        isActiveSeller: activeSeller !== undefined,
        openRecoveryCases: openRecoveryCases.get(id) ?? 0,
        showCommission: showsIndividualCommission,
        dailyEntered: monthDayKeys.map((key) => dailyCounts.get(key) ?? 0),
        // Avance de cuota de la ventana relevante: entregadas frente al
        // objetivo, para detectar de un vistazo a quien está cerca sin
        // llegar (SPEC-038 BR-014).
        quota: quotaWindowKey
          ? (() => {
              const window = currentMetrics.accelerators.find(
                (item) => item.key === quotaWindowKey,
              );
              const target =
                quotaTargets.get(id) ?? getDefaultQuotaTarget(quotaWindowKey);
              const delivered = window?.delivered ?? 0;
              return {
                target,
                delivered,
                confirmed: window?.confirmed ?? 0,
                missing: Math.max(0, target - delivered),
                reached: delivered >= target,
              };
            })()
          : null,
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

function redactAccelerator(
  accelerator: PerformanceMetrics["accelerators"][number],
): PerformanceMetrics["accelerators"][number] {
  return {
    ...accelerator,
    amountCents: 0,
    nextTarget: null,
    missingForNextTarget: 0,
    nextTargetAmountCents: 0,
  };
}

function redactCommission(metrics: PerformanceMetrics): PerformanceMetrics {
  const accelerators = metrics.accelerators.map(redactAccelerator);
  const acceleratorOne = accelerators[0] ?? metrics.acceleratorOne;

  return {
    ...metrics,
    baseCommissionCents: 0,
    acceleratorOne,
    accelerators,
    acceleratorTotalCents: 0,
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
  // El acelerador es individual y no lineal: se calcula por asesor y se suma
  // ventana por ventana. El objetivo siguiente no aplica a un agregado.
  const accelerators = metrics.accelerators.map((window, index) => ({
    ...window,
    eligible: individualMetrics.reduce(
      (total, item) => total + (item.accelerators[index]?.eligible ?? 0),
      0,
    ),
    delivered: individualMetrics.reduce(
      (total, item) => total + (item.accelerators[index]?.delivered ?? 0),
      0,
    ),
    confirmed: individualMetrics.reduce(
      (total, item) => total + (item.accelerators[index]?.confirmed ?? 0),
      0,
    ),
    amountCents: individualMetrics.reduce(
      (total, item) => total + (item.accelerators[index]?.amountCents ?? 0),
      0,
    ),
    nextTarget: null,
    missingForNextTarget: 0,
    nextTargetAmountCents: 0,
  }));
  const acceleratorTotalCents = accelerators.reduce(
    (total, item) => total + item.amountCents,
    0,
  );

  return {
    ...metrics,
    baseCommissionCents,
    acceleratorOne: accelerators[0] ?? metrics.acceleratorOne,
    accelerators,
    acceleratorTotalCents,
    estimatedCommissionCents: baseCommissionCents + acceleratorTotalCents,
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
  const selectedAdvisor = isIndividualScope
    ? null
    : await resolveRequestedAdvisor(organizationId, access, query.agent);
  const scopeWhere = isIndividualScope
    ? { agentUserId: access.userId }
    : getPerformanceAccessWhere(
        access.role,
        access.userId,
        supervisedTeamIds,
        canSwitchView,
      );
  // El filtro por asesor se interseca con el alcance del actor: aunque el
  // identificador fuera indebido, nunca amplía lo que el actor puede ver.
  const accessWhere: Prisma.DitoOrderWhereInput = selectedAdvisor
    ? { AND: [scopeWhere, { agentUserId: selectedAdvisor.id }] }
    : scopeWhere;
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

  /*
   * SPEC-044 REN-03: los casos de Recupero de ventas no son pedidos. Se
   * cuentan aparte, con el mismo alcance del tablero (asesor, equipo o
   * cartera propia), y se abren en su bandeja, no en Pedidos.
   */
  const openRecoveryCasesRows = await database.recoveryCase.groupBy({
    by: ["assignedUserId"],
    where: {
      organizationId,
      source: { in: ["INTERNAL_ORDER_STATE", "MANUAL"] },
      status: {
        in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"],
      },
      // Sin responsable también cuenta: es justo lo que hay que atender.
      AND: [
        isIndividualScope
          ? { assignedUserId: access.userId }
          : selectedAdvisor
            ? { assignedUserId: selectedAdvisor.id }
            : teamFilter !== "ALL"
              ? { assignedTeamId: teamFilter }
              : access.role === "SUPERVISOR"
                ? {
                    OR: [
                      { assignedTeamId: { in: supervisedTeamIds } },
                      { assignedUserId: access.userId },
                    ],
                  }
                : {},
      ],
    },
    _count: { _all: true },
  });
  const openRecoveryCasesByAgent = new Map<string, number>(
    openRecoveryCasesRows.flatMap((row) =>
      row.assignedUserId ? [[row.assignedUserId, row._count._all]] : [],
    ),
  );
  const openRecoveryCases = openRecoveryCasesRows.reduce(
    (total, row) => total + row._count._all,
    0,
  );

  const primaryTeamMemberships = isIndividualScope
    ? []
    : await database.commercialTeamMember.findMany({
        where: {
          salesEnabled: true,
          isActive: true,
          isPrimary: true,
          ...(access.role === "SUPERVISOR"
            ? {
                OR: [
                  { teamId: { in: supervisedTeamIds } },
                  { userId: access.userId },
                ],
              }
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
          user: { select: { name: true, email: true } },
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
  const allActiveSellers = new Map(
    primaryTeamMemberships.map((membership) => [
      membership.userId,
      {
        name: membership.user.name,
        email: membership.user.email,
        teamName: membership.team.name,
      },
    ]),
  );
  // Al aislar a un asesor, la cobertura y el detalle hablan solo de él: el
  // resto del equipo no debe aparecer como filas sin producción.
  const activeSellers = selectedAdvisor
    ? new Map(
        [...allActiveSellers.entries()].filter(
          ([userId]) => userId === selectedAdvisor.id,
        ),
      )
    : allActiveSellers;

  const comparedThroughDay =
    currentRange.key === currentMonth ? getLimaDayOfMonth(now) : null;
  const comparablePreviousOrders =
    comparedThroughDay === null
      ? previousOrders
      : filterOrdersRegisteredThroughLimaDay(
          previousOrders,
          comparedThroughDay,
        );
  const unattributedOrders = orders.filter(
    (order) => order.agentUserId === null,
  );
  const unattributedPreviousEntered = comparablePreviousOrders.filter(
    (order) => order.agentUserId === null,
  ).length;

  // Ventana sobre la que hablar hoy y las cuotas vigentes de sus asesores.
  const currentWindow = resolveCurrentAcceleratorWindow(now);
  const relevantWindow = resolveRelevantAcceleratorWindow(now);
  const quotaRows = relevantWindow
    ? await database.performanceQuota.findMany({
        where: {
          organizationId,
          periodKey: currentRange.key,
          window: relevantWindow.key,
          userId: { not: null },
        },
        select: { userId: true, target: true },
      })
    : [];
  const quotaTargets = new Map(
    quotaRows.map((row) => [row.userId as string, row.target]),
  );

  const advisorOptions = [
    ...new Map<string, { id: string; name: string }>([
      ...[...allActiveSellers.entries()].map(
        ([id, seller]) =>
          [id, { id, name: seller.name }] as [
            string,
            { id: string; name: string },
          ],
      ),
      ...(selectedAdvisor
        ? ([[selectedAdvisor.id, selectedAdvisor]] as Array<
            [string, { id: string; name: string }]
          >)
        : []),
    ]).values(),
  ].sort((left, right) => left.name.localeCompare(right.name, "es"));

  const scopedMetrics = calculateScopedMetrics(orders, isIndividualScope);
  const scopedPreviousMetrics = calculateScopedMetrics(
    comparablePreviousOrders,
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
      : (selectedAdvisor?.name ??
        selectedTeam?.name ??
        (access.role === "SUPERVISOR" ? "Mis equipos" : "Organización")),
    view,
    canSwitchView,
    teamFilter,
    teamOptions,
    agentFilter: selectedAdvisor?.id ?? "ALL",
    advisorOptions,
    showTeamFilter: !isIndividualScope && teamOptions.length > 0,
    showAdvisorFilter: !isIndividualScope && advisorOptions.length > 0,
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
      comparedThroughDay,
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
    unattributed:
      !isIndividualScope &&
      (unattributedOrders.length > 0 || unattributedPreviousEntered > 0)
        ? {
            metrics: calculatePerformanceMetrics(
              unattributedOrders.map(toMetricInput),
            ),
            enteredDelta: percentDelta(
              unattributedOrders.length,
              unattributedPreviousEntered,
            ),
          }
        : null,
    workforce:
      isIndividualScope || selectedAdvisor
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
    quotaWindow: relevantWindow
      ? {
          key: relevantWindow.key,
          label: relevantWindow.label,
          isActive: currentWindow !== null,
        }
      : null,
    openRecoveryCases,
    breakdown: isIndividualScope
      ? []
      : groupByAgent(
          orders,
          comparablePreviousOrders,
          access.role,
          primaryTeamNames,
          activeSellers,
          monthProgress.days.map((day) => day.key),
          relevantWindow?.key ?? null,
          quotaTargets,
          openRecoveryCasesByAgent,
        ),
  };
}
