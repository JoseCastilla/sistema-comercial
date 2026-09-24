import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePerformanceMetrics,
  classifyMyDaySale,
  summarizeMyDaySales,
} from "../dist/index.js";

const lima = (texto) => new Date(`${texto}-05:00`);

function venta(overrides = {}) {
  return {
    commercialOperation: "PORT_POSTPAID",
    status: "SENT",
    deliveryStatus: "PENDING",
    sentSubstatus: "ASSIGNED",
    registeredAt: lima("2026-09-10T10:00:00"),
    deliveredAt: null,
    closedAt: null,
    agentUserId: "asesora",
    assignedTeamId: "equipo",
    ...overrides,
  };
}

const pagable = venta({
  status: "CLOSED",
  deliveryStatus: "DELIVERED",
  sentSubstatus: "DELIVERED",
  deliveredAt: lima("2026-09-12T10:00:00"),
  closedAt: lima("2026-09-13T10:00:00"),
});

test("una venta entregada, activada y a su nombre ya paga su tarifa", () => {
  assert.deepEqual(classifyMyDaySale(pagable), {
    bucket: "pagan",
    reason: "PAYABLE",
    amountCents: 2_500,
    potential: false,
  });
});

test("entregada sin activar espera activación con su monto potencial", () => {
  const venta1 = venta({
    commercialOperation: "PORT_PREPAID",
    deliveryStatus: "DELIVERED",
    deliveredAt: lima("2026-09-12T10:00:00"),
  });
  assert.deepEqual(classifyMyDaySale(venta1), {
    bucket: "por_activar",
    reason: "NOT_ACTIVATED",
    amountCents: 1_250,
    potential: true,
  });
});

test("sin entregar: en camino si nada falló, caída si la entrega falló", () => {
  assert.equal(classifyMyDaySale(venta()).bucket, "en_camino");
  assert.equal(
    classifyMyDaySale(venta({ deliveryStatus: "NOT_DELIVERED" })).bucket,
    "caidas",
  );
  assert.equal(
    classifyMyDaySale(venta({ sentSubstatus: "REJECTED" })).bucket,
    "caidas",
  );
  assert.equal(classifyMyDaySale(venta({ status: "CANCELLED" })).bucket, "caidas");
});

test("un alta nueva no paga comisión, aunque se haya entregado y activado", () => {
  assert.deepEqual(
    classifyMyDaySale({ ...pagable, commercialOperation: "NEW_LINE" }),
    {
      bucket: "sin_comision",
      reason: "NEW_LINE_NO_COMMISSION",
      amountCents: 0,
      potential: false,
    },
  );
});

test("lo que «ya paga» suma exactamente la comisión base de Rendimiento", () => {
  const ventas = [
    pagable,
    { ...pagable, commercialOperation: "PORT_PREPAID" },
    { ...pagable, commercialOperation: "NEW_LINE" },
    venta({ deliveryStatus: "DELIVERED", deliveredAt: lima("2026-09-12T10:00:00") }),
    venta(),
    venta({ status: "CANCELLED" }),
  ];
  const resumen = summarizeMyDaySales(ventas.map(classifyMyDaySale));
  const pagan = resumen.find((grupo) => grupo.bucket === "pagan");

  assert.equal(pagan.amountCents, calculatePerformanceMetrics(ventas).baseCommissionCents);
  assert.deepEqual(
    resumen.map((grupo) => [grupo.bucket, grupo.count, grupo.amountCents]),
    [
      ["pagan", 2, 3_750],
      ["por_activar", 1, 2_500],
      ["en_camino", 1, 2_500],
      ["caidas", 1, 2_500],
      ["sin_comision", 1, 0],
    ],
  );
});

test("los grupos vacíos no se muestran", () => {
  assert.deepEqual(
    summarizeMyDaySales([classifyMyDaySale(pagable)]).map((grupo) => grupo.bucket),
    ["pagan"],
  );
});
