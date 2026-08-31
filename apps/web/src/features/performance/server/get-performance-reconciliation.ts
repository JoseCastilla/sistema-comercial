import "server-only";

import {
  evaluatePerformanceOrderPayment,
  getPerformanceMonthRange,
  getPotentialBaseCommissionCents,
  parsePerformanceMonth,
} from "@repo/validation";

import { database } from "@/server/database";

import {
  resolvePerformanceScope,
  resolveRequestedAdvisor,
} from "./performance-access";

import type { PerformanceAccess } from "./performance-access";
import type { Prisma } from "@repo/database";
import type {
  PerformanceOrderInput,
  PerformancePaymentReason,
} from "@repo/validation";

import type {
  PerformanceReconciliationData,
  ReconciliationFilter,
} from "../reconciliation.types";

interface ReconciliationQuery {
  month: string;
  team?: string;
  agent?: string;
  reason: ReconciliationFilter;
  page?: number;
}

const pageSize = 50;

const reasonLabels: Record<PerformancePaymentReason, string> = {
  PAYABLE: "Pagable",
  NEW_LINE_NO_COMMISSION: "Alta sin comisión",
  UNKNOWN_OPERATION: "Operación por corregir",
  UNASSIGNED: "Sin asesor responsable",
  CANCELLED: "Cancelada",
  NOT_DELIVERED: "Pendiente de entrega",
  NOT_ACTIVATED: "Entregada por activar",
};

const orderSelect = {
  id: true,
  orderCodeRaw: true,
  holderFullNameRaw: true,
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

type ReconciliationOrder = Prisma.DitoOrderGetPayload<{
  select: typeof orderSelect;
}>;

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const monthFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  month: "long",
  year: "numeric",
});

function toMetricInput(order: ReconciliationOrder): PerformanceOrderInput {
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

function getReasonWhere(
  reason: PerformancePaymentReason,
): Prisma.DitoOrderWhereInput {
  const portability: Prisma.DitoOrderWhereInput = {
    commercialOperation: { in: ["PORT_PREPAID", "PORT_POSTPAID"] },
  };

  switch (reason) {
    case "NEW_LINE_NO_COMMISSION":
      return { commercialOperation: "NEW_LINE" };
    case "UNKNOWN_OPERATION":
      return { commercialOperation: "UNKNOWN" };
    case "CANCELLED":
      return { ...portability, status: "CANCELLED" };
    case "NOT_DELIVERED":
      return {
        ...portability,
        status: { not: "CANCELLED" },
        OR: [{ deliveryStatus: { not: "DELIVERED" } }, { deliveredAt: null }],
      };
    case "NOT_ACTIVATED":
      return {
        ...portability,
        status: { not: "CANCELLED" },
        deliveryStatus: "DELIVERED",
        deliveredAt: { not: null },
        OR: [{ status: { not: "CLOSED" } }, { closedAt: null }],
      };
    case "UNASSIGNED":
      return {
        ...portability,
        status: "CLOSED",
        closedAt: { not: null },
        deliveryStatus: "DELIVERED",
        deliveredAt: { not: null },
        agentUserId: null,
      };
    case "PAYABLE":
      return {
        ...portability,
        status: "CLOSED",
        closedAt: { not: null },
        deliveryStatus: "DELIVERED",
        deliveredAt: { not: null },
        agentUserId: { not: null },
      };
  }
}

export async function getPerformanceReconciliation(
  organizationId: string,
  access: PerformanceAccess,
  query: ReconciliationQuery,
): Promise<PerformanceReconciliationData> {
  const now = new Date();
  const currentMonth = parsePerformanceMonth(undefined, now);
  const range = getPerformanceMonthRange(query.month);
  const requestedPage = Math.max(1, Math.floor(query.page ?? 1));
  const { teamOptions, accessWhere } = await resolvePerformanceScope(
    organizationId,
    access,
  );
  const selectedAdvisor = await resolveRequestedAdvisor(
    organizationId,
    access,
    query.agent,
  );
  const teamFilter = teamOptions.some((team) => team.id === query.team)
    ? (query.team ?? "ALL")
    : "ALL";
  const reasons = Object.keys(reasonLabels) as PerformancePaymentReason[];
  const baseWhere: Prisma.DitoOrderWhereInput = {
    organizationId,
    registeredAt: { gte: range.start, lt: range.end },
    AND: [
      accessWhere,
      ...(selectedAdvisor ? [{ agentUserId: selectedAdvisor.id }] : []),
    ],
    ...(teamFilter === "ALL" ? {} : { assignedTeamId: teamFilter }),
  };
  const [totalOrders, countValues, payablePostpaid, payablePrepaid] =
    await Promise.all([
      database.ditoOrder.count({ where: baseWhere }),
      Promise.all(
        reasons.map((reason) =>
          database.ditoOrder.count({
            where: { AND: [baseWhere, getReasonWhere(reason)] },
          }),
        ),
      ),
      database.ditoOrder.count({
        where: {
          AND: [
            baseWhere,
            getReasonWhere("PAYABLE"),
            { commercialOperation: "PORT_POSTPAID" },
          ],
        },
      }),
      database.ditoOrder.count({
        where: {
          AND: [
            baseWhere,
            getReasonWhere("PAYABLE"),
            { commercialOperation: "PORT_PREPAID" },
          ],
        },
      }),
    ]);
  const counts = Object.fromEntries(
    reasons.map((reason, index) => [reason, countValues[index] ?? 0]),
  ) as Record<PerformancePaymentReason, number>;
  const filteredTotal =
    query.reason === "ALL" ? totalOrders : counts[query.reason];
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const orders = await database.ditoOrder.findMany({
    where: {
      AND: [
        baseWhere,
        ...(query.reason === "ALL" ? [] : [getReasonWhere(query.reason)]),
      ],
    },
    orderBy: { registeredAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: orderSelect,
  });
  const visible = orders.map((order) => ({
    order,
    evaluation: evaluatePerformanceOrderPayment(toMetricInput(order)),
  }));

  // SPEC-014 BR-010/BR-011: BACKOFFICE no ve montos; el supervisor conoce el
  // total de sus equipos pero no el pago individual de cada asesor.
  const showTotals = access.role !== "BACKOFFICE";
  const showLineAmounts = access.role === "ADMIN" || access.role === "AGENT";

  return {
    generatedAt: dateTimeFormatter.format(now),
    month: range.key,
    currentMonth,
    monthLabel: monthFormatter.format(range.start),
    from: range.from,
    to: range.to,
    role: access.role,
    scopeLabel:
      selectedAdvisor?.name ??
      teamOptions.find((team) => team.id === teamFilter)?.name ??
      (access.role === "AGENT"
        ? "Mis ventas"
        : access.role === "SUPERVISOR"
          ? "Mis equipos"
          : "Organización"),
    teamFilter,
    teamOptions,
    agentFilter: selectedAdvisor?.id ?? "ALL",
    showTotals,
    showLineAmounts,
    filter: query.reason,
    counts,
    totals: {
      orders: totalOrders,
      payable: counts.PAYABLE,
      baseCommissionCents: showTotals
        ? payablePostpaid * getPotentialBaseCommissionCents("PORT_POSTPAID") +
          payablePrepaid * getPotentialBaseCommissionCents("PORT_PREPAID")
        : 0,
    },
    lines: visible.map(({ order, evaluation }) => ({
      id: order.id,
      orderCode: order.orderCodeRaw,
      customerName: order.holderFullNameRaw,
      agentName: order.agent?.name ?? "Sin asesor",
      teamName: order.assignedTeam?.name ?? null,
      operation: order.commercialOperation,
      registeredAtLabel: dateTimeFormatter.format(order.registeredAt),
      reason: evaluation.reason,
      reasonLabel: reasonLabels[evaluation.reason],
      baseCommissionCents: showLineAmounts ? evaluation.baseCommissionCents : 0,
    })),
    pagination: {
      page,
      pageSize,
      totalPages,
      filteredTotal,
    },
  };
}
