export type PerformanceCommercialOperation =
  "NEW_LINE" | "PORT_PREPAID" | "PORT_POSTPAID" | "UNKNOWN";

export interface PerformanceOrderInput {
  commercialOperation: PerformanceCommercialOperation;
  status: "OPEN" | "SENT" | "CLOSED" | "CANCELLED" | "UNKNOWN";
  deliveryStatus:
    | "PENDING"
    | "IN_TRANSIT"
    | "DELIVERED"
    | "NOT_DELIVERED"
    | "RESCHEDULED"
    | "CANCELLED";
  sentSubstatus?:
    | "NO_STATUS"
    | "ASSIGNED"
    | "SCHEDULED"
    | "NOT_DELIVERED"
    | "REJECTED"
    | "DELIVERED"
    | "UNKNOWN"
    | null;
  registeredAt: Date;
  deliveredAt: Date | null;
  closedAt: Date | null;
  agentUserId: string | null;
  assignedTeamId: string | null;
}

export interface PerformanceAccelerator {
  eligible: number;
  confirmed: number;
  amountCents: number;
  nextTarget: number | null;
  missingForNextTarget: number;
}

export interface PerformanceMetrics {
  entered: number;
  portability: number;
  postpaid: number;
  prepaid: number;
  newLines: number;
  unknownProduct: number;
  delivered: number;
  activated: number;
  payable: number;
  deliveredPendingActivation: number;
  cancelled: number;
  recovery: number;
  unassigned: number;
  deliveryRate: number | null;
  payableRate: number | null;
  baseCommissionCents: number;
  acceleratorOne: PerformanceAccelerator;
  estimatedCommissionCents: number;
}

export type PerformancePaymentReason =
  | "PAYABLE"
  | "NEW_LINE_NO_COMMISSION"
  | "UNKNOWN_OPERATION"
  | "UNASSIGNED"
  | "CANCELLED"
  | "NOT_DELIVERED"
  | "NOT_ACTIVATED";

export interface PerformancePaymentEvaluation {
  reason: PerformancePaymentReason;
  payable: boolean;
  baseCommissionCents: number;
}

const limaDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  day: "2-digit",
});

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function isPortability(operation: PerformanceCommercialOperation): boolean {
  return operation === "PORT_PREPAID" || operation === "PORT_POSTPAID";
}

export function getPotentialBaseCommissionCents(
  operation: PerformanceCommercialOperation,
): number {
  if (operation === "PORT_POSTPAID") return 2_500;
  if (operation === "PORT_PREPAID") return 1_250;
  return 0;
}

function limaDay(value: Date): number {
  return Number(limaDayFormatter.format(value));
}

export function evaluatePerformanceOrderPayment(
  order: PerformanceOrderInput,
): PerformancePaymentEvaluation {
  if (order.commercialOperation === "NEW_LINE") {
    return {
      reason: "NEW_LINE_NO_COMMISSION",
      payable: false,
      baseCommissionCents: 0,
    };
  }
  if (order.commercialOperation === "UNKNOWN") {
    return {
      reason: "UNKNOWN_OPERATION",
      payable: false,
      baseCommissionCents: 0,
    };
  }
  if (order.status === "CANCELLED") {
    return { reason: "CANCELLED", payable: false, baseCommissionCents: 0 };
  }
  if (order.deliveryStatus !== "DELIVERED" || order.deliveredAt === null) {
    return { reason: "NOT_DELIVERED", payable: false, baseCommissionCents: 0 };
  }
  if (order.status !== "CLOSED" || order.closedAt === null) {
    return { reason: "NOT_ACTIVATED", payable: false, baseCommissionCents: 0 };
  }
  if (order.agentUserId === null) {
    return { reason: "UNASSIGNED", payable: false, baseCommissionCents: 0 };
  }

  return {
    reason: "PAYABLE",
    payable: true,
    baseCommissionCents: getPotentialBaseCommissionCents(
      order.commercialOperation,
    ),
  };
}

export function calculateAcceleratorOne(
  orders: readonly PerformanceOrderInput[],
): PerformanceAccelerator {
  const eligibleOrders = orders.filter((order) => {
    const day = limaDay(order.registeredAt);
    return isPortability(order.commercialOperation) && day >= 1 && day <= 15;
  });
  const confirmed = eligibleOrders.filter(
    (order) =>
      order.deliveryStatus === "DELIVERED" &&
      order.deliveredAt !== null &&
      order.status === "CLOSED" &&
      order.closedAt !== null,
  ).length;

  let amountCents = 0;
  let nextTarget: number | null = 30;

  if (confirmed >= 40) {
    amountCents = 30_000 + (confirmed - 40) * 1_000;
    nextTarget = confirmed + 1;
  } else if (confirmed >= 30) {
    amountCents = 20_000;
    nextTarget = 40;
  }

  return {
    eligible: eligibleOrders.length,
    confirmed,
    amountCents,
    nextTarget,
    missingForNextTarget: nextTarget === null ? 0 : nextTarget - confirmed,
  };
}

export function calculatePerformanceMetrics(
  orders: readonly PerformanceOrderInput[],
): PerformanceMetrics {
  let portability = 0;
  let postpaid = 0;
  let prepaid = 0;
  let newLines = 0;
  let unknownProduct = 0;
  let delivered = 0;
  let activated = 0;
  let payable = 0;
  let deliveredPendingActivation = 0;
  let cancelled = 0;
  let recovery = 0;
  let unassigned = 0;
  let baseCommissionCents = 0;

  for (const order of orders) {
    if (order.commercialOperation === "PORT_POSTPAID") {
      portability += 1;
      postpaid += 1;
    } else if (order.commercialOperation === "PORT_PREPAID") {
      portability += 1;
      prepaid += 1;
    } else if (order.commercialOperation === "NEW_LINE") {
      newLines += 1;
    } else {
      unknownProduct += 1;
    }

    const isDelivered =
      order.deliveryStatus === "DELIVERED" && order.deliveredAt !== null;
    const isActivated = order.status === "CLOSED" && order.closedAt !== null;
    const isPayable =
      isPortability(order.commercialOperation) && isDelivered && isActivated;

    if (isDelivered) delivered += 1;
    if (isActivated) activated += 1;
    if (isPayable) {
      payable += 1;
      baseCommissionCents += getPotentialBaseCommissionCents(
        order.commercialOperation,
      );
    }
    if (isDelivered && !isActivated) deliveredPendingActivation += 1;
    if (order.status === "CANCELLED") cancelled += 1;
    if (
      order.sentSubstatus === "NOT_DELIVERED" ||
      order.sentSubstatus === "REJECTED"
    ) {
      recovery += 1;
    }
    if (order.agentUserId === null && order.assignedTeamId === null) {
      unassigned += 1;
    }
  }

  const acceleratorOne = calculateAcceleratorOne(orders);

  return {
    entered: orders.length,
    portability,
    postpaid,
    prepaid,
    newLines,
    unknownProduct,
    delivered,
    activated,
    payable,
    deliveredPendingActivation,
    cancelled,
    recovery,
    unassigned,
    deliveryRate: ratio(delivered, orders.length),
    payableRate: ratio(payable, portability),
    baseCommissionCents,
    acceleratorOne,
    estimatedCommissionCents: baseCommissionCents + acceleratorOne.amountCents,
  };
}
