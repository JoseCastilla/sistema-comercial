import "server-only";

import { database } from "@/server/database";

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

export type OrderSlaState =
  | "OVERDUE"
  | "DUE_SOON"
  | "ON_TIME"
  | "PENDING_SHIFT"
  | "NO_DEADLINE"
  | "CLOSED";

export interface OrderInboxItem {
  id: string;

  orderCode: string;
  operation: string;

  holderName: string;
  documentNumber: string;
  serviceNumber: string;

  deliveryMethod: string;
  deliveryMethodLabel: string;

  department: string;
  province: string;
  district: string;
  locationLabel: string;

  agentName: string;

  parseStatus: string;
  matchStatus: string;
  deliveryStatus: string;

  registeredAtLabel: string;
  approvedAtLabel: string;

  deliveryWindowLabel: string;
  deliveryDueAtLabel: string | null;

  slaState: OrderSlaState;

  slaLabel: string;
}

export interface OrderInboxData {
  generatedAt: string;

  items: OrderInboxItem[];

  totals: {
    visible: number;
    needsReview: number;
    overdue: number;
    express: number;
    pendingShift: number;
  };
}

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

function getSlaState(
  deliveryMethod: string,
  deliveryStatus: string,
  deliveryDueAt: Date | null,
  now: Date,
): {
  state: OrderSlaState;
  label: string;
} {
  if (deliveryStatus === "DELIVERED" || deliveryStatus === "CANCELLED") {
    return {
      state: "CLOSED",
      label: "Cerrado",
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

  const thirtyMinutes = 30 * 60 * 1000;

  if (remainingMilliseconds <= thirtyMinutes) {
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

export async function getOrderInbox(
  organizationId: string,
): Promise<OrderInboxData> {
  const now = new Date();

  const orders = await database.ditoOrder.findMany({
    where: {
      organizationId,

      matchStatus: {
        in: ["UNMATCHED", "NEEDS_REVIEW"],
      },
    },

    orderBy: {
      registeredAt: "desc",
    },

    take: 50,

    select: {
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

      parseStatus: true,

      matchStatus: true,

      deliveryStatus: true,

      registeredAt: true,

      approvedAt: true,

      deliveryWindowStart: true,

      deliveryWindowEnd: true,

      deliveryDueAt: true,
    },
  });

  const items = orders.map((order): OrderInboxItem => {
    const sla = getSlaState(
      String(order.deliveryMethod),

      String(order.deliveryStatus),

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

      deliveryMethod: String(order.deliveryMethod),

      deliveryMethodLabel: formatDeliveryMethod(String(order.deliveryMethod)),

      department: order.department,

      province: order.province,

      district: order.district,

      locationLabel: createLocationLabel(
        order.department,
        order.province,
        order.district,
      ),

      agentName: order.agentNameNormalized ?? order.agentNameRaw,

      parseStatus: String(order.parseStatus),

      matchStatus: String(order.matchStatus),

      deliveryStatus: String(order.deliveryStatus),

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
    };
  });

  items.sort((left, right) => {
    const priority: Record<OrderSlaState, number> = {
      OVERDUE: 0,
      DUE_SOON: 1,
      NO_DEADLINE: 2,
      PENDING_SHIFT: 3,
      ON_TIME: 4,
      CLOSED: 5,
    };

    const leftReviewPriority = left.matchStatus === "NEEDS_REVIEW" ? -1 : 0;

    const rightReviewPriority = right.matchStatus === "NEEDS_REVIEW" ? -1 : 0;

    if (leftReviewPriority !== rightReviewPriority) {
      return leftReviewPriority - rightReviewPriority;
    }

    return priority[left.slaState] - priority[right.slaState];
  });

  return {
    generatedAt: dateTimeFormatter.format(now),

    items,

    totals: {
      visible: items.length,

      needsReview: items.filter((item) => item.matchStatus === "NEEDS_REVIEW")
        .length,

      overdue: items.filter((item) => item.slaState === "OVERDUE").length,

      express: items.filter((item) => item.deliveryMethod === "EXPRESS").length,

      pendingShift: items.filter((item) => item.slaState === "PENDING_SHIFT")
        .length,
    },
  };
}
