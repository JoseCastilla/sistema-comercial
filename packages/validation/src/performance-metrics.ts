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

export interface PerformanceCommissionPolicy {
  currency: "PEN";
  baseRateCents: Record<PerformanceCommercialOperation, number>;
  acceleratorOne: {
    windowStartDay: number;
    windowEndDay: number;
    firstTierTarget: number;
    firstTierAmountCents: number;
    secondTierTarget: number;
    secondTierAmountCents: number;
    perExtraConfirmedCents: number;
  };
}

const commissionPolicy: PerformanceCommissionPolicy = {
  currency: "PEN",
  baseRateCents: {
    PORT_POSTPAID: 2_500,
    PORT_PREPAID: 1_250,
    NEW_LINE: 0,
    UNKNOWN: 0,
  },
  acceleratorOne: {
    windowStartDay: 1,
    windowEndDay: 15,
    firstTierTarget: 30,
    firstTierAmountCents: 20_000,
    secondTierTarget: 40,
    secondTierAmountCents: 30_000,
    perExtraConfirmedCents: 1_000,
  },
};

// Única fuente de las tarifas (SPEC-033). El parámetro de mes permitirá
// versionar por vigencia sin cambiar a los consumidores.
export function getPerformanceCommissionPolicy(
  monthKey?: string,
): PerformanceCommissionPolicy {
  void monthKey;
  return commissionPolicy;
}

export function getPotentialBaseCommissionCents(
  operation: PerformanceCommercialOperation,
): number {
  return commissionPolicy.baseRateCents[operation];
}

export function getLimaDayOfMonth(value: Date): number {
  return Number(limaDayFormatter.format(value));
}

export function filterOrdersRegisteredThroughLimaDay<
  T extends { registeredAt: Date },
>(orders: readonly T[], day: number): T[] {
  return orders.filter((order) => getLimaDayOfMonth(order.registeredAt) <= day);
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
  const policy = commissionPolicy.acceleratorOne;
  const eligibleOrders = orders.filter((order) => {
    const day = getLimaDayOfMonth(order.registeredAt);
    return (
      isPortability(order.commercialOperation) &&
      day >= policy.windowStartDay &&
      day <= policy.windowEndDay
    );
  });
  const confirmed = eligibleOrders.filter(
    (order) =>
      order.deliveryStatus === "DELIVERED" &&
      order.deliveredAt !== null &&
      order.status === "CLOSED" &&
      order.closedAt !== null,
  ).length;

  let amountCents = 0;
  let nextTarget: number | null = policy.firstTierTarget;

  if (confirmed >= policy.secondTierTarget) {
    amountCents =
      policy.secondTierAmountCents +
      (confirmed - policy.secondTierTarget) * policy.perExtraConfirmedCents;
    nextTarget = confirmed + 1;
  } else if (confirmed >= policy.firstTierTarget) {
    amountCents = policy.firstTierAmountCents;
    nextTarget = policy.secondTierTarget;
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
    const payment = evaluatePerformanceOrderPayment(order);

    if (isDelivered) delivered += 1;
    if (isActivated) activated += 1;
    if (payment.payable) {
      payable += 1;
      baseCommissionCents += payment.baseCommissionCents;
    }
    if (isDelivered && !isActivated) deliveredPendingActivation += 1;
    if (order.status === "CANCELLED") cancelled += 1;
    if (
      order.status === "CANCELLED" ||
      (order.status === "SENT" && order.sentSubstatus === "NOT_DELIVERED")
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
