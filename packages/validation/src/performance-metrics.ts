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
  key: "ONE" | "TWO";
  label: string;
  eligible: number;
  /** Medida de la cuota (SPEC-038 BR-007). */
  delivered: number;
  /** Medida del acelerador: entregada y cerrada (BR-003). */
  confirmed: number;
  amountCents: number;
  nextTarget: number | null;
  missingForNextTarget: number;
  /** Cuánto vale alcanzar el siguiente objetivo (BR-013). */
  nextTargetAmountCents: number;
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
  /** La primera ventana, conservada para consumidores existentes. */
  acceleratorOne: PerformanceAccelerator;
  /** Todas las ventanas vigentes (SPEC-038 BR-006). */
  accelerators: PerformanceAccelerator[];
  acceleratorTotalCents: number;
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

/**
 * Un tramo del acelerador: al alcanzar `target` se paga `amountCents`, y a
 * partir de ahí cada confirmada adicional suma `perExtraConfirmedCents`
 * cuando el tramo es el último.
 */
export interface PerformanceAcceleratorTier {
  target: number;
  amountCents: number;
}

export interface PerformanceAcceleratorWindow {
  key: "ONE" | "TWO";
  label: string;
  windowStartDay: number;
  /** `null` significa hasta el último día del mes (SPEC-038 BR-001). */
  windowEndDay: number | null;
  tiers: PerformanceAcceleratorTier[];
  perExtraConfirmedCents: number;
}

export interface PerformanceCommissionPolicy {
  currency: "PEN";
  baseRateCents: Record<PerformanceCommercialOperation, number>;
  acceleratorWindows: PerformanceAcceleratorWindow[];
}

const commissionPolicy: PerformanceCommissionPolicy = {
  currency: "PEN",
  baseRateCents: {
    PORT_POSTPAID: 2_500,
    PORT_PREPAID: 1_250,
    NEW_LINE: 0,
    UNKNOWN: 0,
  },
  acceleratorWindows: [
    {
      key: "ONE",
      label: "Bono días 1 al 15",
      windowStartDay: 1,
      windowEndDay: 15,
      tiers: [
        { target: 30, amountCents: 20_000 },
        { target: 40, amountCents: 30_000 },
      ],
      perExtraConfirmedCents: 1_000,
    },
    {
      // BR-001: cierra con el mes, así que el 31 cuenta cuando existe.
      key: "TWO",
      label: "Bono del 25 a fin de mes",
      windowStartDay: 25,
      windowEndDay: null,
      tiers: [{ target: 15, amountCents: 10_000 }],
      perExtraConfirmedCents: 1_000,
    },
  ],
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

function isWithinAcceleratorWindow(
  window: PerformanceAcceleratorWindow,
  day: number,
): boolean {
  if (day < window.windowStartDay) return false;
  return window.windowEndDay === null || day <= window.windowEndDay;
}

/**
 * Calcula una ventana de acelerador (SPEC-038 BR-003 a BR-005).
 *
 * La cohorte la fija la fecha de ingreso; la confirmación —entregada y
 * cerrada— solo decide si suma, aunque ocurra después de que la ventana
 * cierre. `delivered` acompaña al resultado porque es la medida de la cuota
 * (BR-007) y su diferencia con `confirmed` es el pendiente de activación.
 */
export function calculateAcceleratorWindow(
  orders: readonly PerformanceOrderInput[],
  window: PerformanceAcceleratorWindow,
): PerformanceAccelerator {
  const eligibleOrders = orders.filter(
    (order) =>
      isPortability(order.commercialOperation) &&
      isWithinAcceleratorWindow(window, getLimaDayOfMonth(order.registeredAt)),
  );
  const delivered = eligibleOrders.filter(
    (order) =>
      order.deliveryStatus === "DELIVERED" && order.deliveredAt !== null,
  ).length;
  const confirmed = eligibleOrders.filter(
    (order) =>
      order.deliveryStatus === "DELIVERED" &&
      order.deliveredAt !== null &&
      order.status === "CLOSED" &&
      order.closedAt !== null,
  ).length;

  const reached = [...window.tiers]
    .filter((tier) => confirmed >= tier.target)
    .sort((left, right) => right.target - left.target)[0];
  const pending = [...window.tiers]
    .filter((tier) => confirmed < tier.target)
    .sort((left, right) => left.target - right.target)[0];

  const lastTier = window.tiers[window.tiers.length - 1];
  let amountCents = 0;
  if (reached) {
    amountCents = reached.amountCents;
    // Superado el último tramo, cada confirmada adicional suma su extra.
    if (lastTier && reached.target === lastTier.target) {
      amountCents += (confirmed - lastTier.target) * window.perExtraConfirmedCents;
    }
  }

  // Sin tramo pendiente, el siguiente objetivo es una confirmada más, que ya
  // vale el extra marginal.
  const nextTarget = pending ? pending.target : reached ? confirmed + 1 : null;

  return {
    key: window.key,
    label: window.label,
    eligible: eligibleOrders.length,
    delivered,
    confirmed,
    amountCents,
    nextTarget,
    missingForNextTarget: nextTarget === null ? 0 : nextTarget - confirmed,
    nextTargetAmountCents: pending
      ? pending.amountCents
      : window.perExtraConfirmedCents,
  };
}

export function calculateAccelerators(
  orders: readonly PerformanceOrderInput[],
): PerformanceAccelerator[] {
  return commissionPolicy.acceleratorWindows.map((window) =>
    calculateAcceleratorWindow(orders, window),
  );
}

/** Compatibilidad: la primera ventana sigue siendo consultable por nombre. */
export function calculateAcceleratorOne(
  orders: readonly PerformanceOrderInput[],
): PerformanceAccelerator {
  const window = commissionPolicy.acceleratorWindows[0];
  if (!window) throw new Error("No hay ventanas de acelerador configuradas.");
  return calculateAcceleratorWindow(orders, window);
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

  const accelerators = calculateAccelerators(orders);
  const acceleratorTotalCents = accelerators.reduce(
    (total, item) => total + item.amountCents,
    0,
  );
  const acceleratorOne = accelerators[0];
  if (!acceleratorOne) {
    throw new Error("No hay ventanas de acelerador configuradas.");
  }

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
    accelerators,
    acceleratorTotalCents,
    estimatedCommissionCents: baseCommissionCents + acceleratorTotalCents,
  };
}
