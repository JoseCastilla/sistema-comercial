import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAcceleratorOne,
  calculatePerformanceMetrics,
  evaluatePerformanceOrderPayment,
  filterOrdersRegisteredThroughLimaDay,
  getLimaDayOfMonth,
  getPerformanceCommissionPolicy,
  getPotentialBaseCommissionCents,
} from "../dist/performance-metrics.js";

function order(overrides = {}) {
  return {
    commercialOperation: "PORT_POSTPAID",
    status: "CLOSED",
    deliveryStatus: "DELIVERED",
    registeredAt: new Date("2026-08-05T15:00:00.000Z"),
    deliveredAt: new Date("2026-08-16T15:00:00.000Z"),
    closedAt: new Date("2026-08-17T15:00:00.000Z"),
    agentUserId: "agent-1",
    assignedTeamId: "team-1",
    ...overrides,
  };
}

test("41 portabilidades confirmadas de la primera quincena generan S/ 310", () => {
  const result = calculateAcceleratorOne(
    Array.from({ length: 41 }, () => order()),
  );

  assert.deepEqual(result, {
    eligible: 41,
    confirmed: 41,
    amountCents: 31_000,
    nextTarget: 42,
    missingForNextTarget: 1,
  });
});

test("la fecha de cierre no cambia la cohorte del acelerador", () => {
  const result = calculateAcceleratorOne([
    order({ registeredAt: new Date("2026-08-15T23:30:00.000Z") }),
    order({ registeredAt: new Date("2026-08-16T05:00:00.000Z") }),
  ]);

  assert.equal(result.eligible, 1);
  assert.equal(result.confirmed, 1);
});

test("una orden ingresada en la ventana permanece provisional hasta entrega y cierre", () => {
  const result = calculateAcceleratorOne([
    order({
      status: "SENT",
      deliveryStatus: "IN_TRANSIT",
      deliveredAt: null,
      closedAt: null,
    }),
  ]);

  assert.equal(result.eligible, 1);
  assert.equal(result.confirmed, 0);
  assert.equal(result.amountCents, 0);
});

test("calcula funnel, tasas y comisión base sin pagar altas nuevas", () => {
  const result = calculatePerformanceMetrics([
    order(),
    order({ commercialOperation: "PORT_PREPAID" }),
    order({ commercialOperation: "NEW_LINE" }),
    order({
      commercialOperation: "PORT_POSTPAID",
      status: "SENT",
      deliveryStatus: "DELIVERED",
      closedAt: null,
    }),
  ]);

  assert.equal(result.entered, 4);
  assert.equal(result.delivered, 4);
  assert.equal(result.activated, 3);
  assert.equal(result.payable, 2);
  assert.equal(result.deliveredPendingActivation, 1);
  assert.equal(result.baseCommissionCents, 3_750);
  assert.equal(result.deliveryRate, 1);
  assert.equal(result.payableRate, 2 / 3);
});

test("explica de forma determinista por qué una orden no genera comisión", () => {
  assert.equal(
    evaluatePerformanceOrderPayment(order({ commercialOperation: "NEW_LINE" }))
      .reason,
    "NEW_LINE_NO_COMMISSION",
  );
  assert.equal(
    evaluatePerformanceOrderPayment(
      order({ deliveryStatus: "IN_TRANSIT", deliveredAt: null }),
    ).reason,
    "NOT_DELIVERED",
  );
  assert.equal(
    evaluatePerformanceOrderPayment(order({ status: "SENT", closedAt: null }))
      .reason,
    "NOT_ACTIVATED",
  );
  assert.equal(
    evaluatePerformanceOrderPayment(order({ agentUserId: null })).reason,
    "UNASSIGNED",
  );
});

test("asigna la tarifa base solo a portabilidades entregadas y cerradas", () => {
  assert.deepEqual(evaluatePerformanceOrderPayment(order()), {
    reason: "PAYABLE",
    payable: true,
    baseCommissionCents: 2_500,
  });
  assert.deepEqual(
    evaluatePerformanceOrderPayment(
      order({ commercialOperation: "PORT_PREPAID" }),
    ),
    { reason: "PAYABLE", payable: true, baseCommissionCents: 1_250 },
  );
});

test("calcula el potencial comercial sin presentarlo como comisión confirmada", () => {
  assert.equal(getPotentialBaseCommissionCents("PORT_POSTPAID"), 2_500);
  assert.equal(getPotentialBaseCommissionCents("PORT_PREPAID"), 1_250);
  assert.equal(getPotentialBaseCommissionCents("NEW_LINE"), 0);
  assert.equal(getPotentialBaseCommissionCents("UNKNOWN"), 0);
});

test("la política de comisiones es la única fuente de tarifas y tramos", () => {
  const policy = getPerformanceCommissionPolicy();

  assert.equal(policy.currency, "PEN");
  for (const operation of [
    "PORT_POSTPAID",
    "PORT_PREPAID",
    "NEW_LINE",
    "UNKNOWN",
  ]) {
    assert.equal(
      policy.baseRateCents[operation],
      getPotentialBaseCommissionCents(operation),
    );
  }
  assert.deepEqual(policy.acceleratorOne, {
    windowStartDay: 1,
    windowEndDay: 15,
    firstTierTarget: 30,
    firstTierAmountCents: 20_000,
    secondTierTarget: 40,
    secondTierAmountCents: 30_000,
    perExtraConfirmedCents: 1_000,
  });
});

test("una portabilidad entregada y cerrada sin asesor no suma pagable ni comisión", () => {
  const result = calculatePerformanceMetrics([
    order({ agentUserId: null, assignedTeamId: null }),
    order(),
  ]);

  assert.equal(result.entered, 2);
  assert.equal(result.delivered, 2);
  assert.equal(result.activated, 2);
  assert.equal(result.payable, 1);
  assert.equal(result.baseCommissionCents, 2_500);
  assert.equal(result.payableRate, 1 / 2);
  assert.equal(result.unassigned, 1);
});

test("el dashboard y la conciliación comparten la misma razón para huérfanas", () => {
  const evaluation = evaluatePerformanceOrderPayment(
    order({ agentUserId: null }),
  );
  const metrics = calculatePerformanceMetrics([order({ agentUserId: null })]);

  assert.equal(evaluation.reason, "UNASSIGNED");
  assert.equal(evaluation.payable, false);
  assert.equal(metrics.payable, 0);
  assert.equal(metrics.baseCommissionCents, 0);
});

test("resuelve el día del mes en Lima, no en UTC", () => {
  assert.equal(getLimaDayOfMonth(new Date("2026-09-01T04:59:00.000Z")), 31);
  assert.equal(getLimaDayOfMonth(new Date("2026-09-01T05:00:00.000Z")), 1);
});

test("recorta la cohorte del mes anterior hasta el día transcurrido", () => {
  const cohort = [
    order({ registeredAt: new Date("2026-07-01T15:00:00.000Z") }),
    order({ registeredAt: new Date("2026-07-15T15:00:00.000Z") }),
    order({ registeredAt: new Date("2026-07-16T04:59:00.000Z") }),
    order({ registeredAt: new Date("2026-07-20T15:00:00.000Z") }),
  ];

  const filtered = filterOrdersRegisteredThroughLimaDay(cohort, 15);

  assert.equal(filtered.length, 3);
  assert.ok(
    filtered.every((item) => getLimaDayOfMonth(item.registeredAt) <= 15),
  );
});

test("considera recuperables las no entregadas y canceladas, no las rechazadas", () => {
  const result = calculatePerformanceMetrics([
    order({
      status: "SENT",
      sentSubstatus: "NOT_DELIVERED",
      deliveryStatus: "NOT_DELIVERED",
      deliveredAt: null,
      closedAt: null,
    }),
    order({
      status: "CANCELLED",
      sentSubstatus: null,
      deliveryStatus: "CANCELLED",
      deliveredAt: null,
      closedAt: null,
    }),
    order({
      status: "SENT",
      sentSubstatus: "REJECTED",
      deliveryStatus: "CANCELLED",
      deliveredAt: null,
      closedAt: null,
    }),
  ]);

  assert.equal(result.recovery, 2);
  assert.equal(result.cancelled, 1);
});
