import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAcceleratorOne,
  calculatePerformanceMetrics,
  evaluatePerformanceOrderPayment,
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
