import "server-only";

import {
  getOrderPeriodRange,
  getOrderRange,
  parseOrderRange,
  resolveDitoOrderScope,
  resolveDitoOrderVisibility,
} from "@repo/validation";

import { database } from "@/server/database";

import type { Prisma } from "@repo/database";
import type { OrderPeriod } from "@repo/validation";

import type {
  OrderInboxAccess,
  OrderInboxData,
  OrderFilter,
  OrderInboxItem,
  OrderSentSubstatusValue,
  OrderSlaState,
  OrderStatusValue,
} from "../order-inbox.types";

const businessTimeZone = "America/Lima";
const pageSize = 50;

export interface OrderInboxQuery {
  period: OrderPeriod;
  from?: string;
  to?: string;
  page?: number;
  filter: OrderFilter;
  search?: string;
  team?: string;
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: businessTimeZone,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: businessTimeZone,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: businessTimeZone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const orderSelect = {
  id: true,
  orderCodeRaw: true,
  operationRaw: true,
  commercialOperation: true,
  carrier: true,
  fixedCharge: true,
  holderFullNameRaw: true,
  holderDocumentNumber: true,
  serviceNumber: true,
  salesCode: true,
  billingCycleDay: true,
  paymentDueDay: true,
  deliveryMethod: true,
  deliveryContactPhone: true,
  deliveryTimeRangeRaw: true,
  deliveryAddress: true,
  deliveryReference: true,
  deliveryLatitude: true,
  deliveryLongitude: true,
  department: true,
  province: true,
  district: true,
  agentNameRaw: true,
  agentNameNormalized: true,
  submitterEmailNormalized: true,
  agentUserId: true,
  assignedTeamId: true,
  matchStatus: true,
  parseStatus: true,
  deliveryStatus: true,
  deliveryObservation: true,
  status: true,
  sentSubstatus: true,
  statusUpdatedAt: true,
  sentSubstatusUpdatedAt: true,
  noStatusDetectedAt: true,
  registeredAt: true,
  updatedAt: true,
  approvedAt: true,
  deliveryWindowStart: true,
  deliveryWindowEnd: true,
  deliveryDueAt: true,
} as const;

function formatDateTime(value: Date | null): string {
  if (!value) {
    return "No registrado";
  }

  return dateTimeFormatter.format(value);
}

function formatDeliveryMethod(value: string): string {
  switch (value) {
    case "EXPRESS":
      return "Express";

    case "REGULAR_24H":
      return "Regular 24 h";

    case "REGULAR_48H":
      return "Regular 48 h";

    case "REGULAR_72H":
      return "Regular 72 h";

    default:
      return "Sin clasificar";
  }
}

function createLocationLabel(
  department: string,
  province: string,
  district: string,
): string {
  return [department, province, district].filter(Boolean).join(" · ");
}

function createWindowLabel(start: Date | null, end: Date | null): string {
  if (!start || !end) {
    return "Turno pendiente";
  }

  const sameBusinessDate =
    dateFormatter.format(start) === dateFormatter.format(end);

  if (sameBusinessDate) {
    return [
      dateFormatter.format(start),
      "·",
      `${timeFormatter.format(start)}–${timeFormatter.format(end)}`,
    ].join(" ");
  }

  return [
    dateTimeFormatter.format(start),
    "–",
    dateTimeFormatter.format(end),
  ].join(" ");
}

function formatElapsed(value: Date, now: Date): string {
  const milliseconds = Math.max(0, now.getTime() - value.getTime());
  const minutes = Math.floor(milliseconds / 60_000);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} h`;
  }

  return `${Math.floor(hours / 24)} d`;
}

function getStatusLabel(status: OrderStatusValue): string {
  switch (status) {
    case "OPEN":
      return "Abierto";

    case "SENT":
      return "Enviado";

    case "CLOSED":
      return "Cerrado";

    case "CANCELLED":
      return "Cancelado";

    case "UNKNOWN":
      return "Sin clasificar";
  }
}

function getSentSubstatusLabel(
  substatus: OrderSentSubstatusValue,
): string | null {
  switch (substatus) {
    case "NO_STATUS":
      return "Sin estado";

    case "ASSIGNED":
      return "Asignado";

    case "SCHEDULED":
      return "Agendado";

    case "NOT_DELIVERED":
      return "No entregado";

    case "REJECTED":
      return "Rechazado";

    case "DELIVERED":
      return "Entregado";

    case "UNKNOWN":
      return "Sin clasificar";

    case null:
      return null;
  }
}

function getSlaState(
  status: OrderStatusValue,
  deliveryMethod: string,
  deliveryStatus: string,
  deliveryDueAt: Date | null,
  now: Date,
): {
  state: OrderSlaState;
  label: string;
} {
  if (
    status === "CLOSED" ||
    status === "CANCELLED" ||
    deliveryStatus === "DELIVERED" ||
    deliveryStatus === "CANCELLED"
  ) {
    return {
      state: "CLOSED",
      label: "Finalizado",
    };
  }

  if (!deliveryDueAt) {
    if (
      deliveryMethod === "REGULAR_24H" ||
      deliveryMethod === "REGULAR_48H" ||
      deliveryMethod === "REGULAR_72H"
    ) {
      return {
        state: "PENDING_SHIFT",
        label: "Turno pendiente",
      };
    }

    return {
      state: "NO_DEADLINE",
      label: "Sin plazo calculado",
    };
  }

  const remainingMilliseconds = deliveryDueAt.getTime() - now.getTime();

  if (remainingMilliseconds < 0) {
    return {
      state: "OVERDUE",
      label: "Fuera de plazo",
    };
  }

  if (remainingMilliseconds <= 30 * 60 * 1000) {
    return {
      state: "DUE_SOON",
      label: "Vence pronto",
    };
  }

  return {
    state: "ON_TIME",
    label: "Dentro del plazo",
  };
}

function getPriority(item: OrderInboxItem): number {
  if (item.noStatusIncident) {
    return 0;
  }

  if (item.sentSubstatus === "REJECTED") {
    return 1;
  }

  if (item.sentSubstatus === "NOT_DELIVERED") {
    return 2;
  }

  if (item.slaState === "OVERDUE") {
    return 3;
  }

  if (item.slaState === "DUE_SOON") {
    return 4;
  }

  if (item.status === "OPEN") {
    return 5;
  }

  if (item.status === "SENT" && item.sentSubstatus === "DELIVERED") {
    return 6;
  }

  if (item.status === "SENT") {
    return 7;
  }

  if (item.status === "UNKNOWN") {
    return 8;
  }

  if (item.status === "CLOSED") {
    return 9;
  }

  return 10;
}

function getStatusFilter(
  filter: OrderFilter,
  now: Date,
  incidentThreshold: Date,
): Prisma.DitoOrderWhereInput {
  switch (filter) {
    case "ACTIVE":
      return { status: { in: ["OPEN", "SENT", "UNKNOWN"] } };
    case "INCIDENTS":
      return {
        OR: [
          { sentSubstatus: "REJECTED" },
          {
            status: "SENT",
            sentSubstatus: "NO_STATUS",
            noStatusDetectedAt: { lte: incidentThreshold },
          },
          {
            deliveryDueAt: { lt: now },
            status: { notIn: ["CLOSED", "CANCELLED"] },
            deliveryStatus: { notIn: ["DELIVERED", "CANCELLED"] },
          },
        ],
      };
    case "RECOVERY":
      return { sentSubstatus: { in: ["NOT_DELIVERED", "REJECTED"] } };
    case "DELIVERED":
      return {
        OR: [{ status: "CLOSED" }, { sentSubstatus: "DELIVERED" }],
      };
    case "FINAL":
      return { status: { in: ["CLOSED", "CANCELLED"] } };
    case "ALL":
      return {};
  }
}

function getSearchFilter(search: string): Prisma.DitoOrderWhereInput {
  if (!search) return {};

  const contains = { contains: search, mode: "insensitive" as const };
  return {
    OR: [
      { orderCodeRaw: contains },
      { holderFullNameRaw: contains },
      { holderDocumentNumber: contains },
      { serviceNumber: contains },
      { salesCode: contains },
      { deliveryContactPhone: contains },
      { deliveryAddress: contains },
      { deliveryReference: contains },
      { agentNameRaw: contains },
      { agentNameNormalized: contains },
      { department: contains },
      { province: contains },
      { district: contains },
    ],
  };
}

function getSupervisorSearchFilter(
  search: string,
  supervisedTeamIds: readonly string[],
): Prisma.DitoOrderWhereInput {
  if (!search) return {};

  const contains = { contains: search, mode: "insensitive" as const };
  return {
    OR: [
      {
        AND: [
          { assignedTeamId: { in: [...supervisedTeamIds] } },
          getSearchFilter(search),
        ],
      },
      {
        agentUserId: null,
        assignedTeamId: null,
        OR: [
          { orderCodeRaw: contains },
          { salesCode: contains },
          { operationRaw: contains },
          { agentNameRaw: contains },
          { agentNameNormalized: contains },
          { department: contains },
          { province: contains },
          { district: contains },
        ],
      },
    ],
  };
}

function maskIdentifier(value: string): string {
  const visible = value.slice(-4);
  return visible ? `••••${visible}` : "Protegido";
}

export async function getOrderInbox(
  organizationId: string,
  access: OrderInboxAccess,
  query: OrderInboxQuery,
): Promise<OrderInboxData> {
  const now = new Date();
  const parsedRange =
    query.period === "RANGE" ? parseOrderRange(query.from, query.to) : null;
  const period =
    query.period === "RANGE" && !parsedRange ? "MONTH" : query.period;
  const range = parsedRange
    ? getOrderRange(parsedRange.from, parsedRange.to, now)
    : getOrderPeriodRange(period, now);
  const requestedPage = Math.max(1, Math.floor(query.page ?? 1));
  const search = query.search?.trim().slice(0, 100) ?? "";
  const incidentThreshold = new Date(now.getTime() - 10 * 60 * 1000);

  const teamOptions =
    access.role === "AGENT"
      ? []
      : await database.commercialTeam.findMany({
          where: {
            organizationId,
            status: "ACTIVE",
            ...(access.role === "SUPERVISOR"
              ? {
                  members: {
                    some: {
                      userId: access.userId,
                      memberRole: "SUPERVISOR",
                      isActive: true,
                    },
                  },
                }
              : {}),
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        });
  const supervisedTeamIds =
    access.role === "SUPERVISOR" ? teamOptions.map((team) => team.id) : [];
  const requestedTeam = query.team?.trim() ?? "";
  const canUseTeamFilter =
    access.role !== "AGENT" &&
    (access.role !== "SUPERVISOR" || supervisedTeamIds.length > 0);
  const teamFilter =
    canUseTeamFilter &&
    (requestedTeam === "UNASSIGNED" ||
      teamOptions.some((team) => team.id === requestedTeam))
      ? requestedTeam
      : "ALL";

  const orderScope = resolveDitoOrderScope({
    role: access.role,
    userId: access.userId,
    supervisedTeamIds,
  });

  const accessFilter: Prisma.DitoOrderWhereInput =
    orderScope.kind === "AGENT"
      ? { agentUserId: orderScope.userId }
      : orderScope.kind === "SUPERVISED_TEAMS_WITH_ORPHANS"
        ? {
            OR: [
              { assignedTeamId: { in: [...orderScope.teamIds] } },
              { agentUserId: null, assignedTeamId: null },
            ],
          }
        : orderScope.kind === "NONE"
          ? { assignedTeamId: { in: [] } }
          : {};

  const teamFilterWhere: Prisma.DitoOrderWhereInput =
    teamFilter === "UNASSIGNED"
      ? { agentUserId: null, assignedTeamId: null }
      : teamFilter === "ALL"
        ? {}
        : { assignedTeamId: teamFilter };

  const periodFilter: Prisma.DitoOrderWhereInput =
    range.start && range.end
      ? {
          registeredAt: {
            gte: range.start,
            lt: range.end,
          },
        }
      : {};
  const baseWhere: Prisma.DitoOrderWhereInput = {
    organizationId,
    AND: [accessFilter, teamFilterWhere, periodFilter],
  };
  const filteredWhere: Prisma.DitoOrderWhereInput = {
    organizationId,
    AND: [
      accessFilter,
      teamFilterWhere,
      periodFilter,
      getStatusFilter(query.filter, now, incidentThreshold),
      access.role === "SUPERVISOR"
        ? getSupervisorSearchFilter(search, supervisedTeamIds)
        : getSearchFilter(search),
    ],
  };

  const [
    totalOrders,
    filteredTotal,
    incidentCount,
    notDeliveredCount,
    deliveredCount,
    overdueCount,
    pendingBeforeMonth,
  ] = await database.$transaction([
    database.ditoOrder.count({ where: baseWhere }),
    database.ditoOrder.count({ where: filteredWhere }),
    database.ditoOrder.count({
      where: {
        ...baseWhere,
        OR: [
          { sentSubstatus: "REJECTED" },
          {
            status: "SENT",
            sentSubstatus: "NO_STATUS",
            noStatusDetectedAt: { lte: incidentThreshold },
          },
        ],
      },
    }),
    database.ditoOrder.count({
      where: { ...baseWhere, sentSubstatus: "NOT_DELIVERED" },
    }),
    database.ditoOrder.count({
      where: {
        ...baseWhere,
        OR: [{ status: "CLOSED" }, { sentSubstatus: "DELIVERED" }],
      },
    }),
    database.ditoOrder.count({
      where: {
        ...baseWhere,
        deliveryDueAt: { lt: now },
        status: { notIn: ["CLOSED", "CANCELLED"] },
        deliveryStatus: { notIn: ["DELIVERED", "CANCELLED"] },
      },
    }),
    database.ditoOrder.count({
      where: {
        organizationId,
        AND: [accessFilter, teamFilterWhere],
        registeredAt: { lt: range.monthStart },
        status: { in: ["OPEN", "SENT", "UNKNOWN"] },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const orders = await database.ditoOrder.findMany({
    where: filteredWhere,
    orderBy: [{ registeredAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: orderSelect,
  });

  const items = orders.map((order): OrderInboxItem => {
    const visibility = resolveDitoOrderVisibility({
      role: access.role,
      userId: access.userId,
      supervisedTeamIds,
      orderAgentUserId: order.agentUserId,
      orderAssignedTeamId: order.assignedTeamId,
    });
    const limitedOrphan = visibility === "LIMITED_ORPHAN";
    const status = String(order.status) as OrderStatusValue;

    const sentSubstatus = order.sentSubstatus
      ? (String(order.sentSubstatus) as Exclude<OrderSentSubstatusValue, null>)
      : null;

    const statusReferenceAt = sentSubstatus
      ? (order.sentSubstatusUpdatedAt ??
        order.statusUpdatedAt ??
        order.registeredAt)
      : (order.statusUpdatedAt ?? order.registeredAt);

    const noStatusIncident =
      status === "SENT" &&
      sentSubstatus === "NO_STATUS" &&
      order.noStatusDetectedAt !== null &&
      now.getTime() - order.noStatusDetectedAt.getTime() >= 10 * 60 * 1000;

    const deliveryMethod = String(order.deliveryMethod);
    const deliveryStatus = String(order.deliveryStatus);

    const sla = getSlaState(
      status,
      deliveryMethod,
      deliveryStatus,
      order.deliveryDueAt,
      now,
    );

    return {
      id: order.id,
      orderCode: order.orderCodeRaw,
      operation: order.operationRaw,
      commercialOperation: String(order.commercialOperation),
      carrier: String(order.carrier),
      fixedCharge: order.fixedCharge?.toString() ?? null,

      holderName: limitedOrphan
        ? "Cliente sin asignar"
        : order.holderFullNameRaw,
      documentNumber: limitedOrphan
        ? maskIdentifier(order.holderDocumentNumber)
        : order.holderDocumentNumber,
      serviceNumber: limitedOrphan
        ? maskIdentifier(order.serviceNumber)
        : order.serviceNumber,
      salesCode: order.salesCode,
      billingCycleDay: order.billingCycleDay,
      paymentDueDay: order.paymentDueDay,

      deliveryMethod,
      deliveryMethodLabel: formatDeliveryMethod(deliveryMethod),
      deliveryContactPhone: limitedOrphan
        ? maskIdentifier(order.deliveryContactPhone)
        : order.deliveryContactPhone,
      deliveryTimeRange: order.deliveryTimeRangeRaw,
      deliveryAddress: limitedOrphan ? null : order.deliveryAddress,
      deliveryReference: limitedOrphan ? null : order.deliveryReference,
      deliveryLatitude: limitedOrphan
        ? null
        : (order.deliveryLatitude?.toString() ?? null),
      deliveryLongitude: limitedOrphan
        ? null
        : (order.deliveryLongitude?.toString() ?? null),

      department: order.department,
      province: order.province,
      district: order.district,

      locationLabel: createLocationLabel(
        order.department,
        order.province,
        order.district,
      ),

      agentName: order.agentNameNormalized ?? order.agentNameRaw,
      submitterEmail: order.submitterEmailNormalized,

      matchStatus: String(order.matchStatus),
      parseStatus: String(order.parseStatus),
      deliveryStatus,

      status,
      statusLabel: getStatusLabel(status),

      sentSubstatus,
      sentSubstatusLabel: getSentSubstatusLabel(sentSubstatus),

      statusAgeLabel: formatElapsed(statusReferenceAt, now),

      noStatusIncident,
      deliveryObservation: order.deliveryObservation,

      registeredAtLabel: formatDateTime(order.registeredAt),

      approvedAtLabel: formatDateTime(order.approvedAt),

      deliveryWindowLabel: createWindowLabel(
        order.deliveryWindowStart,
        order.deliveryWindowEnd,
      ),

      deliveryDueAtLabel: order.deliveryDueAt
        ? formatDateTime(order.deliveryDueAt)
        : null,

      slaState: sla.state,
      slaLabel: sla.label,

      canUpdate: visibility === "FULL",
      canCorrect: visibility === "FULL" && access.role === "ADMIN",
      canResolveAssignment:
        access.role === "ADMIN" &&
        Boolean(order.submitterEmailNormalized) &&
        order.agentUserId === null &&
        order.assignedTeamId === null,
      updatedAt: order.updatedAt.toISOString(),
    };
  });

  items.sort((left, right) => {
    return getPriority(left) - getPriority(right);
  });

  return {
    generatedAt: dateTimeFormatter.format(now),

    period,
    periodLabel:
      period === "TODAY"
        ? "Hoy"
        : period === "YESTERDAY"
          ? "Ayer"
          : period === "WEEK"
            ? "Semana actual"
            : period === "MONTH"
              ? "Mes actual"
              : period === "RANGE" && range.start && range.end
                ? `Del ${dateFormatter.format(range.start)} al ${dateFormatter.format(new Date(range.end.getTime() - 1))}`
                : "Histórico",
    from: parsedRange?.from ?? null,
    to: parsedRange?.to ?? null,
    filter: query.filter,
    search,
    teamFilter,
    teamAllLabel:
      access.role === "SUPERVISOR"
        ? "Mis equipos + sin asignar"
        : "Todos los equipos",
    teamOptions,
    showTeamFilter:
      access.role !== "AGENT" &&
      (access.role !== "SUPERVISOR" || supervisedTeamIds.length > 0),
    filteredTotal,

    items,

    pagination: {
      page,
      pageSize,
      totalPages,
    },

    pendingBeforeMonth,

    totals: {
      visible: totalOrders,
      incidents: incidentCount,
      notDelivered: notDeliveredCount,
      delivered: deliveredCount,
      overdue: overdueCount,
    },
  };
}
