import "server-only";

import {
  canCloseDitoOrder,
  canCancelDitoOrder,
  canCreateDitoOrderEscalation,
  canReviewDitoOrderEscalation,
  canRequestDitoOrderCancellation,
  canTransitionDitoOrderStatus,
  formatAdvisorCompactName,
  getLimaIsoDate,
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
  agent: {
    select: {
      name: true,
      email: true,
    },
  },
  assignedTeamId: true,
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
  closedAt: true,
  closedBy: {
    select: {
      name: true,
    },
  },
  cancellationRequests: {
    where: { status: "PENDING" },
    orderBy: { requestedAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      reason: true,
      requestedAt: true,
      requestedBy: {
        select: { name: true },
      },
    },
  },
  escalations: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      status: true,
      category: true,
      priority: true,
      tdpTemplateType: true,
      tdpTemplate: true,
      tdpEscalatedAt: true,
      observation: true,
      requestedAction: true,
      acknowledgement: true,
      resolution: true,
      createdAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      createdByUserId: true,
      createdBy: { select: { name: true } },
      acknowledgedBy: { select: { name: true } },
      resolvedBy: { select: { name: true } },
      tdpEscalatedBy: { select: { name: true } },
    },
  },
  agrDeliverySnapshot: {
    select: {
      estadoPedido: true,
      motivoRechazo: true,
      submotivoRechazo: true,
      resultado: true,
      proximaAccion: true,
      fechaCompromisoRaw: true,
      isRecoveryOpportunity: true,
    },
  },
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
  if (item.pendingCancellationRequest) {
    return 0;
  }

  if (item.noStatusIncident) {
    return 0;
  }

  if (item.sentSubstatus === "REJECTED") {
    return 1;
  }

  if (item.sentSubstatus === "NOT_DELIVERED") {
    return 2;
  }

  /*
   * Una visita que todavia puede ocurrir vence antes que una gestion sin
   * fecha, y una espera de portabilidad no compite por atencion hasta que
   * llega su plazo.
   */
  if (
    item.agrDelivery?.actionKind === "RESCHEDULE" ||
    item.agrDelivery?.actionKind === "MEETING_POINT"
  ) {
    return 1;
  }

  if (item.agrDelivery?.actionKind === "WAIT_PORTABILITY") {
    return 5;
  }

  if (item.agrDelivery) {
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
    return 7;
  }

  if (item.status === "SENT") {
    return 6;
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
    case "ESCALATIONS":
      return {
        escalations: { some: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } },
      };
    case "LOGISTICS":
      return {
        status: { not: "CLOSED" },
        deliveryStatus: { not: "DELIVERED" },
        agrDeliverySnapshot: { is: { isRecoveryOpportunity: true } },
      };
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
      return {
        OR: [
          { status: "SENT", sentSubstatus: "NOT_DELIVERED" },
          { status: "CANCELLED" },
        ],
      };
    case "AWAITING_ACTIVATION":
      return {
        deliveryStatus: "DELIVERED",
        status: { notIn: ["CLOSED", "CANCELLED"] },
      };
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
  sellerUserId: string | null,
): Prisma.DitoOrderWhereInput {
  if (!search) return {};

  const contains = { contains: search, mode: "insensitive" as const };
  return {
    OR: [
      {
        AND: [
          {
            OR: [
              { assignedTeamId: { in: [...supervisedTeamIds] } },
              ...(sellerUserId ? [{ agentUserId: sellerUserId }] : []),
            ],
          },
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

type AgrActionKind = NonNullable<OrderInboxItem["agrDelivery"]>["actionKind"];

/*
 * Maximo describe lo que le paso al courier, no lo que la venta todavia
 * permite. La accion comercial depende del estado y del motivo a la vez:
 *
 *   AGENDADO -> NO ENTREGADO -> RECHAZADO / CANCELADO
 *               (reintentable)  (terminal, la orden se cancela sola)
 *
 * El mismo "CLIENTE AUSENTE" se reagenda mientras la orden vive y se reingresa
 * cuando ya excedio las visitas. Por eso el estado se evalua siempre primero.
 */
const TERMINAL_EXTERNAL_STATES = ["RECHAZADO", "CANCELADO"];

function getAgrAction(input: {
  estadoPedido: string;
  motivoRechazo: string | null;
  submotivoRechazo: string | null;
}): {
  kind: AgrActionKind;
  label: string;
  shortLabel: string;
} {
  const estado = input.estadoPedido.trim().toUpperCase();

  const motivo = [input.motivoRechazo, input.submotivoRechazo]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const terminal = TERMINAL_EXTERNAL_STATES.includes(estado);

  // El problema es el lugar de entrega, no el cliente ni la portabilidad.
  if (/FUERA DE COBERTURA|ZONA PELIGROSA|DIRECCION NO RECUPERABLE/.test(motivo)) {
    return {
      kind: "MEETING_POINT",
      label: "Acordar otro punto de entrega con el cliente, trabajo o casa",
      shortLabel: "Otro punto",
    };
  }

  /*
   * La linea ya porto antes, asi que la fecha se valida en
   * consulta.portabilidad.pe y el reingreso tiene fecha calculable.
   */
  if (/TIEMPO MINIMO DE PORTA/.test(motivo)) {
    return {
      kind: "WAIT_PORTABILITY",
      label: "Reingresar cuando la linea cumpla los 30 dias para portar",
      shortLabel: "Esperar",
    };
  }

  /*
   * Cliente de planta: la linea nacio en el cedente y su antiguedad no es
   * consultable, hay que averiguarla con otra agencia.
   */
  if (/NO ESTUVO EN SERVICIO/.test(motivo)) {
    return {
      kind: "VERIFY_TENURE",
      label: "Verificar la antiguedad de la linea con otra agencia",
      shortLabel: "Verificar",
    };
  }

  // Solo la deuda vencida impide portar; la emitida no.
  if (/DEUDA EXIGIBLE/.test(motivo)) {
    return terminal
      ? {
          kind: "REENTER",
          label: "Reingresar cuando el cliente regularice la deuda vencida",
          shortLabel: "Reingresar",
        }
      : {
          kind: "CONTACT",
          label: "Contactar al cliente para que regularice la deuda vencida",
          shortLabel: "Contactar",
        };
  }

  if (/SERVICIO SUSPENDIDO/.test(motivo)) {
    return {
      kind: "CONTACT",
      label: "Contactar al cliente y validar por que su servicio esta suspendido",
      shortLabel: "Contactar",
    };
  }

  // A veces es un error del sistema de portabilidad, no del cliente.
  if (/OTRA PORTA EN CURSO/.test(motivo)) {
    return {
      kind: "CONTACT",
      label: "Contactar al cliente y validar si hay otra portabilidad real en curso",
      shortLabel: "Contactar",
    };
  }

  /*
   * Huella desgastada o datos que no cuadran. El OL lo reporta tanto como
   * cliente no identificado como telefono que no corresponde al DNI.
   */
  if (/HUELLA NO CORRESPONDE|NO CORRESPONDE AL DNI|CLIENTE NO IDENTIFICADO/.test(motivo)) {
    return terminal
      ? {
          kind: "REENTER",
          label: "Reingresar la venta despues de resolver la validacion biometrica",
          shortLabel: "Reingresar",
        }
      : {
          kind: "CONTACT",
          label: "Contactar al cliente por un problema de validacion biometrica",
          shortLabel: "Contactar",
        };
  }

  if (/NO CUENTA CON PIN/.test(motivo)) {
    return {
      kind: "CONTACT",
      label: "Contactar al cliente para obtener el PIN y reingresar la venta",
      shortLabel: "Contactar",
    };
  }

  if (/CLIENTE AUSENTE/.test(motivo)) {
    return terminal
      ? {
          kind: "REENTER",
          label: "Reingresar la venta: el cliente excedio las visitas permitidas",
          shortLabel: "Reingresar",
        }
      : {
          kind: "RESCHEDULE",
          label: "Contactar al cliente y reagendar la visita en un horario que pueda atender",
          shortLabel: "Reagendar",
        };
  }

  if (/VISITA EN FECHA NO ACORDADA/.test(motivo)) {
    return {
      kind: "RESCHEDULE",
      label: "Reagendar la visita en la fecha que el cliente acordo",
      shortLabel: "Reagendar",
    };
  }

  /*
   * Una negativa del cliente siempre se conversa antes de darla por perdida,
   * incluso cuando el operador la reporto como no recuperable.
   */
  if (/CLIENTE NO DESEA/.test(motivo)) {
    return {
      kind: "CONTACT",
      label: "Contactar al cliente y confirmar si la venta se puede recuperar",
      shortLabel: "Contactar",
    };
  }

  if (terminal) {
    return {
      kind: "REENTER",
      label: "Contactar al cliente y reingresar la venta si sigue interesado",
      shortLabel: "Reingresar",
    };
  }

  return {
    kind: "CONTACT",
    label: "Contactar al cliente y validar el caso",
    shortLabel: "Contactar",
  };
}

export async function getOrderInbox(
  organizationId: string,
  access: OrderInboxAccess,
  query: OrderInboxQuery,
): Promise<OrderInboxData> {
  const now = new Date();
  const parsedRange =
    query.period === "RANGE"
      ? parseOrderRange(query.from, query.to, now)
      : null;
  const period =
    query.period === "RANGE" && !parsedRange ? "MONTH" : query.period;
  const range =
    period === "RANGE" && parsedRange
      ? getOrderRange(parsedRange.from, parsedRange.to, now)
      : getOrderPeriodRange(period, now);
  const requestedPage = Math.max(1, Math.floor(query.page ?? 1));
  const search = query.search?.trim().slice(0, 100) ?? "";
  const incidentThreshold = new Date(now.getTime() - 10 * 60 * 1000);

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
  const [teamOptions, assignmentTeamRecords, primarySalesMembership] =
    await Promise.all([
      access.role === "AGENT"
        ? Promise.resolve([])
        : database.commercialTeam.findMany({
            where: {
              ...teamAccessWhere,
            },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          }),
      access.role === "ADMIN" || access.role === "SUPERVISOR"
        ? database.commercialTeam.findMany({
            where: teamAccessWhere,
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              members: {
                where: {
                  salesEnabled: true,
                  isActive: true,
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
                },
              },
            },
          })
        : Promise.resolve([]),
      access.role === "SUPERVISOR"
        ? database.commercialTeamMember.findFirst({
            where: {
              userId: access.userId,
              salesEnabled: true,
              isPrimary: true,
              isActive: true,
              team: { organizationId, status: "ACTIVE" },
            },
            select: { teamId: true },
          })
        : Promise.resolve(null),
    ]);
  const salesEnabled = primarySalesMembership !== null;
  const assignmentTeams = assignmentTeamRecords
    .map((team) => ({
      id: team.id,
      name: team.name,
      agents: team.members
        .map((member) => ({ id: member.userId, name: member.user.name }))
        .sort((left, right) => left.name.localeCompare(right.name, "es")),
    }))
    .filter((team) => team.agents.length > 0);
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
    salesEnabled,
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
        : orderScope.kind === "SUPERVISED_TEAMS_WITH_OWN_AND_ORPHANS"
          ? {
              OR: [
                { assignedTeamId: { in: [...orderScope.teamIds] } },
                { agentUserId: orderScope.userId },
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
    !["ESCALATIONS", "LOGISTICS"].includes(query.filter) &&
    range.start &&
    range.end
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
        ? getSupervisorSearchFilter(
            search,
            supervisedTeamIds,
            salesEnabled ? access.userId : null,
          )
        : getSearchFilter(search),
    ],
  };

  const [
    totalOrders,
    filteredTotal,
    escalationCount,
    logisticsCount,
    incidentCount,
    notDeliveredCount,
    recoveryCount,
    deliveredCount,
    overdueCount,
    pendingBeforeMonth,
    logisticsRecords,
  ] = await database.$transaction([
    database.ditoOrder.count({ where: baseWhere }),
    database.ditoOrder.count({ where: filteredWhere }),
    database.ditoOrder.count({
      where: {
        organizationId,
        AND: [accessFilter, teamFilterWhere],
        escalations: {
          some: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        },
      },
    }),
    database.ditoOrder.count({
      where: {
        organizationId,
        AND: [accessFilter, teamFilterWhere],
        status: { not: "CLOSED" },
        deliveryStatus: { not: "DELIVERED" },
        agrDeliverySnapshot: { is: { isRecoveryOpportunity: true } },
      },
    }),
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
        organizationId,
        AND: [
          accessFilter,
          teamFilterWhere,
          {
            registeredAt: {
              gte: range.monthStart,
              lt: range.monthEnd,
            },
          },
          {
            OR: [
              { status: "SENT", sentSubstatus: "NOT_DELIVERED" },
              { status: "CANCELLED" },
            ],
          },
        ],
      },
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
    database.ditoOrder.findMany({
      where: {
        organizationId,
        AND: [accessFilter, teamFilterWhere],
        status: { not: "CLOSED" },
        deliveryStatus: { not: "DELIVERED" },
        agrDeliverySnapshot: { is: { isRecoveryOpportunity: true } },
      },
      select: {
        agrDeliverySnapshot: {
          select: {
            estadoPedido: true,
            motivoRechazo: true,
            submotivoRechazo: true,
            fetchedAt: true,
          },
        },
      },
    }),
  ]);

  const logisticsActions = logisticsRecords.flatMap((record) =>
    record.agrDeliverySnapshot
      ? [getAgrAction(record.agrDeliverySnapshot)]
      : [],
  );
  const logisticsLastFetchedAt = logisticsRecords.reduce<Date | null>(
    (latest, record) => {
      const fetchedAt = record.agrDeliverySnapshot?.fetchedAt;
      return fetchedAt && (!latest || fetchedAt > latest) ? fetchedAt : latest;
    },
    null,
  );

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
      salesEnabled,
    });
    const isOwnOrder = order.agentUserId === access.userId;
    const limitedOrphan = visibility === "LIMITED_ORPHAN";
    const status = String(order.status) as OrderStatusValue;
    const pendingCancellationRequest = order.cancellationRequests[0] ?? null;
    const incidentEscalation = order.escalations[0] ?? null;
    const hasActiveEscalation =
      incidentEscalation?.status === "OPEN" ||
      incidentEscalation?.status === "ACKNOWLEDGED";

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

      agentName: order.agent
        ? formatAdvisorCompactName(order.agent.name, order.agent.email)
        : (order.agentNameNormalized ?? order.agentNameRaw),
      submitterEmail: order.submitterEmailNormalized,

      assignmentStatusLabel:
        order.agentUserId && order.assignedTeamId
          ? "Asignado"
          : order.agentUserId || order.assignedTeamId
            ? "Asignación incompleta"
            : order.submitterEmailNormalized
              ? "Requiere revisión"
              : "Sin asignar",
      parseStatus: String(order.parseStatus),
      deliveryStatus,

      status,
      statusLabel: getStatusLabel(status),

      sentSubstatus,
      sentSubstatusLabel: getSentSubstatusLabel(sentSubstatus),

      statusAgeLabel: formatElapsed(statusReferenceAt, now),

      noStatusIncident,
      deliveryObservation: order.deliveryObservation,
      maximoStatus: order.agrDeliverySnapshot
        ? {
            status: order.agrDeliverySnapshot.estadoPedido,
            isOpportunity:
              order.agrDeliverySnapshot.isRecoveryOpportunity === true,
          }
        : null,
      agrDelivery:
        order.agrDeliverySnapshot?.isRecoveryOpportunity === true
          ? (() => {
              const action = getAgrAction(order.agrDeliverySnapshot);
              return {
                status: order.agrDeliverySnapshot.estadoPedido,
                actionKind: action.kind,
                actionLabel: action.label,
                actionShortLabel: action.shortLabel,
                reason:
                  [
                    order.agrDeliverySnapshot.motivoRechazo,
                    order.agrDeliverySnapshot.submotivoRechazo,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null,
                result: order.agrDeliverySnapshot.resultado,
                nextAction: order.agrDeliverySnapshot.proximaAccion,
                commitmentDate: order.agrDeliverySnapshot.fechaCompromisoRaw,
              };
            })()
          : null,

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

      canUpdate: canTransitionDitoOrderStatus({
        role: access.role,
        visibility,
        currentStatus: status,
        targetStatus: "OPEN",
        isOwnOrder,
      }),
      canClose: canCloseDitoOrder({
        role: access.role,
        visibility,
        isOwnOrder,
      }),
      canCancelDirectly: canCancelDitoOrder({
        role: access.role,
        visibility,
        isOwnOrder,
      }),
      canRequestCancellation: canRequestDitoOrderCancellation({
        role: access.role,
        visibility,
        currentStatus: status,
        hasPendingRequest: pendingCancellationRequest !== null,
        isSalesOwner: salesEnabled && isOwnOrder,
      }),
      canReviewCancellation:
        pendingCancellationRequest !== null &&
        canCancelDitoOrder({ role: access.role, visibility, isOwnOrder }),
      canEscalate: canCreateDitoOrderEscalation({
        role: access.role,
        visibility,
        isSalesOwner: isOwnOrder,
        assignedTeamId: order.assignedTeamId,
        hasActiveEscalation,
      }),
      canReviewEscalation:
        Boolean(incidentEscalation && hasActiveEscalation) &&
        canReviewDitoOrderEscalation({
          role: access.role,
          visibility,
          isRequester: incidentEscalation?.createdByUserId === access.userId,
        }),
      incidentEscalation: incidentEscalation
        ? {
            id: incidentEscalation.id,
            status: String(incidentEscalation.status) as
              "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED",
            category: String(incidentEscalation.category),
            priority: String(incidentEscalation.priority),
            templateType: incidentEscalation.tdpTemplateType,
            description: incidentEscalation.observation,
            requestedAction: incidentEscalation.requestedAction,
            createdByName: incidentEscalation.createdBy.name,
            createdAtLabel: formatDateTime(incidentEscalation.createdAt),
            acknowledgement: incidentEscalation.acknowledgement,
            acknowledgedByName: incidentEscalation.acknowledgedBy?.name ?? null,
            acknowledgedAtLabel: incidentEscalation.acknowledgedAt
              ? formatDateTime(incidentEscalation.acknowledgedAt)
              : null,
            resolution: incidentEscalation.resolution,
            tdpTemplate: incidentEscalation.tdpTemplate,
            tdpEscalatedByName: incidentEscalation.tdpEscalatedBy?.name ?? null,
            tdpEscalatedAtLabel: incidentEscalation.tdpEscalatedAt
              ? formatDateTime(incidentEscalation.tdpEscalatedAt)
              : null,
            resolvedByName: incidentEscalation.resolvedBy?.name ?? null,
            resolvedAtLabel: incidentEscalation.resolvedAt
              ? formatDateTime(incidentEscalation.resolvedAt)
              : null,
          }
        : null,
      pendingCancellationRequest: pendingCancellationRequest
        ? {
            id: pendingCancellationRequest.id,
            reason: pendingCancellationRequest.reason,
            requestedByName: pendingCancellationRequest.requestedBy.name,
            requestedAtLabel: formatDateTime(
              pendingCancellationRequest.requestedAt,
            ),
          }
        : null,
      closedByName: order.closedBy?.name ?? null,
      closedAtLabel: order.closedAt ? formatDateTime(order.closedAt) : null,
      canCorrect: visibility === "FULL" && access.role === "ADMIN",
      canResolveAssignment:
        access.role === "ADMIN" &&
        Boolean(order.submitterEmailNormalized) &&
        order.agentUserId === null &&
        order.assignedTeamId === null,
      canClaimAssignment:
        (access.role === "ADMIN" || access.role === "SUPERVISOR") &&
        assignmentTeams.length > 0 &&
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
    role: access.role,

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
    from: period === "RANGE" ? (parsedRange?.from ?? null) : null,
    to: period === "RANGE" ? (parsedRange?.to ?? null) : null,
    rangeMaxDate: getLimaIsoDate(now),
    filter: query.filter,
    search,
    teamFilter,
    teamAllLabel:
      access.role === "SUPERVISOR"
        ? "Mis equipos + sin asignar"
        : "Todos los equipos",
    teamOptions,
    assignmentTeams,
    showTeamFilter:
      access.role !== "AGENT" &&
      (access.role !== "SUPERVISOR" || supervisedTeamIds.length > 0),
    showAdvisorColumn: access.role !== "AGENT",
    filteredTotal,

    items,

    pagination: {
      page,
      pageSize,
      totalPages,
    },

    pendingBeforeMonth,

    logisticsSummary: {
      total: logisticsActions.length,
      reschedule: logisticsActions.filter((action) =>
        ["RESCHEDULE", "MEETING_POINT"].includes(action.kind),
      ).length,
      contact: logisticsActions.filter((action) =>
        ["CONTACT", "VERIFY_TENURE"].includes(action.kind),
      ).length,
      review: logisticsActions.filter((action) =>
        ["REENTER", "WAIT_PORTABILITY"].includes(action.kind),
      ).length,
      lastFetchedAtLabel: logisticsLastFetchedAt
        ? formatDateTime(logisticsLastFetchedAt)
        : null,
    },

    totals: {
      visible: totalOrders,
      incidents: incidentCount,
      escalations: escalationCount,
      logistics: logisticsCount,
      notDelivered: notDeliveredCount,
      recovery: recoveryCount,
      delivered: deliveredCount,
      overdue: overdueCount,
    },
  };
}
