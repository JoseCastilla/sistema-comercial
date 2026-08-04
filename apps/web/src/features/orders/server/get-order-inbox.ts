import "server-only";

import { database } from "@/server/database";

import type {
  OrderInboxAccess,
  OrderInboxData,
  OrderInboxItem,
  OrderSentSubstatusValue,
  OrderSlaState,
  OrderStatusValue,
} from "../order-inbox.types";

const businessTimeZone = "America/Lima";

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
  holderFullNameRaw: true,
  holderDocumentNumber: true,
  serviceNumber: true,
  deliveryMethod: true,
  department: true,
  province: true,
  district: true,
  agentNameRaw: true,
  agentNameNormalized: true,
  agentUserId: true,
  matchStatus: true,
  deliveryStatus: true,
  deliveryObservation: true,
  status: true,
  sentSubstatus: true,
  statusUpdatedAt: true,
  sentSubstatusUpdatedAt: true,
  noStatusDetectedAt: true,
  registeredAt: true,
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

export async function getOrderInbox(
  organizationId: string,
  access: OrderInboxAccess,
): Promise<OrderInboxData> {
  const now = new Date();

  const accessFilter =
    access.role === "AGENT"
      ? {
          agentUserId: access.userId,
        }
      : {};

  const [activeOrders, recentFinalOrders] = await database.$transaction([
    database.ditoOrder.findMany({
      where: {
        organizationId,
        ...accessFilter,

        status: {
          in: ["OPEN", "SENT", "UNKNOWN"],
        },
      },

      orderBy: {
        registeredAt: "desc",
      },

      take: 200,
      select: orderSelect,
    }),

    database.ditoOrder.findMany({
      where: {
        organizationId,
        ...accessFilter,

        status: {
          in: ["CLOSED", "CANCELLED"],
        },
      },

      orderBy: {
        statusUpdatedAt: "desc",
      },

      take: 30,
      select: orderSelect,
    }),
  ]);

  const orders = [...activeOrders, ...recentFinalOrders];

  const items = orders.map((order): OrderInboxItem => {
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

      holderName: order.holderFullNameRaw,
      documentNumber: order.holderDocumentNumber,
      serviceNumber: order.serviceNumber,

      deliveryMethod,
      deliveryMethodLabel: formatDeliveryMethod(deliveryMethod),

      department: order.department,
      province: order.province,
      district: order.district,

      locationLabel: createLocationLabel(
        order.department,
        order.province,
        order.district,
      ),

      agentName: order.agentNameNormalized ?? order.agentNameRaw,

      matchStatus: String(order.matchStatus),
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

      canUpdate: access.role !== "AGENT" || order.agentUserId === access.userId,
    };
  });

  items.sort((left, right) => {
    return getPriority(left) - getPriority(right);
  });

  return {
    generatedAt: dateTimeFormatter.format(now),

    items,

    totals: {
      visible: items.length,

      incidents: items.filter((item) => {
        return item.noStatusIncident || item.sentSubstatus === "REJECTED";
      }).length,

      notDelivered: items.filter((item) => {
        return item.sentSubstatus === "NOT_DELIVERED";
      }).length,

      delivered: items.filter((item) => {
        return item.status === "CLOSED" || item.sentSubstatus === "DELIVERED";
      }).length,

      overdue: items.filter((item) => {
        return item.slaState === "OVERDUE";
      }).length,
    },
  };
}
