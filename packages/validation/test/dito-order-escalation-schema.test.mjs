import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDitoTdpEscalationTemplate,
  ditoOrderEscalationCreateSchema,
  ditoOrderEscalationReviewSchema,
} from "../dist/index.js";

test("accepts a complete advisor escalation", () => {
  const result = ditoOrderEscalationCreateSchema.safeParse({
    orderId: "11111111-1111-4111-8111-111111111111",
    category: "COMMERCIAL_OFFER",
    priority: "HIGH",
    templateType: "LOGISTICS_NOT_MANAGED",
    description: "El cliente indica que la oferta no coincide.",
    requestedAction: "Validar la oferta y definir cómo continuar.",
  });

  assert.equal(result.success, true);
});

test("requires a meaningful resolution", () => {
  const result = ditoOrderEscalationReviewSchema.safeParse({
    escalationId: "11111111-1111-4111-8111-111111111111",
    decision: "RESOLVE",
    response: "Listo",
  });

  assert.equal(result.success, false);
});

test("builds the logistics template with sale data", () => {
  const template = buildDitoTdpEscalationTemplate({
    type: "LOGISTICS_NOT_MANAGED",
    orderCode: "1945719139A",
    deliveryMethod: "Express",
    contactPhone: "984461911",
    department: "Lima",
    province: "Cañete",
    district: "Imperial",
    deliveryTimeRange: "12:25 - 15:25",
    documentNumber: "12345678",
    serviceNumber: "999999999",
    carrier: "Claro",
    holderName: "Cliente Prueba",
    observation: "El motorizado no toma el pedido",
  });

  assert.match(template, /ID orden: 1945719139A/);
  assert.match(template, /Distrito: Imperial/);
  assert.match(template, /El motorizado no toma el pedido/);
});

test("requires a completed TDP template before escalation", () => {
  const result = ditoOrderEscalationReviewSchema.safeParse({
    escalationId: "11111111-1111-4111-8111-111111111111",
    decision: "ESCALATE_TDP",
    response: "",
    tdpTemplate: "incompleta",
  });

  assert.equal(result.success, false);
});
