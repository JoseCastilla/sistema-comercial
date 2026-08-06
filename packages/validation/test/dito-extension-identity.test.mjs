import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ditoExtensionOrderEnvelopeV2Schema,
  safeParseDitoIncomingOrderEnvelope,
} from "../dist/dito-order-schemas.js";

function createEnvelope(overrides = {}) {
  return {
    schema_version: "2.0",
    source: "DITO_EXTENSION",
    event_id: "dito:1941912820",
    captured_at: "2026-08-05T15:03:00.000Z",
    product_type: "MOBILE",
    order: {
      code_raw: "1941912820A",
      code_normalized: "1941912820",
      code_suffix: "A",
      operation_raw: "PORTA ENTEL PRE 39.9",
      commercial_operation: "PORT_PREPAID",
      carrier: "ENTEL",
      fixed_charge: 39.9,
      sales_code: null,
      billing_cycle_day: null,
      payment_due_day: null,
    },
    holder: {
      full_name: "CLIENTE PRUEBA",
      document_type: "DNI",
      document_number: "12345678",
      service_number: "999888777",
    },
    delivery: {
      method: "EXPRESS",
      department: "LIMA",
      province: "LIMA",
      district: "LIMA",
    },
    agent: {
      name_raw: "CARMEN R.",
    },
    submitted_by: {
      installation_id: "f24b8f20-6ce3-4c3f-a2bb-c10110c26c2d",
      email: "carmen.ramirez@distribuidoronline.com",
    },
    raw_summary: "ASESOR: CARMEN R.\nCÓDIGO DE ORDEN: 1941912820A",
    additional_details: {},
    ...overrides,
  };
}

describe("DITO extension identity envelope 2.0", () => {
  it("accepts a corporate email and installation UUID", () => {
    const result = ditoExtensionOrderEnvelopeV2Schema.safeParse(
      createEnvelope(),
    );

    assert.equal(result.success, true);
  });

  it("keeps Carmen Ramirez and Carmen Rivas distinguishable by email", () => {
    const ramirez = ditoExtensionOrderEnvelopeV2Schema.parse(createEnvelope());
    const rivas = ditoExtensionOrderEnvelopeV2Schema.parse(
      createEnvelope({
        submitted_by: {
          installation_id: "f1b2bb6e-bce7-46c5-a9b3-3bb7d801aa7c",
          email: "carmen.rivas@distribuidoronline.com",
        },
      }),
    );

    assert.equal(ramirez.agent.name_raw, rivas.agent.name_raw);
    assert.notEqual(ramirez.submitted_by.email, rivas.submitted_by.email);
  });

  it("rejects an email outside the corporate domain", () => {
    const result = ditoExtensionOrderEnvelopeV2Schema.safeParse(
      createEnvelope({
        submitted_by: {
          installation_id: "f24b8f20-6ce3-4c3f-a2bb-c10110c26c2d",
          email: "carmen.ramirez@gmail.com",
        },
      }),
    );

    assert.equal(result.success, false);
  });

  it("rejects a malformed installation identifier", () => {
    const result = ditoExtensionOrderEnvelopeV2Schema.safeParse(
      createEnvelope({
        submitted_by: {
          installation_id: "installation-1",
          email: "carmen.ramirez@distribuidoronline.com",
        },
      }),
    );

    assert.equal(result.success, false);
  });

  it("continues accepting the legacy 1.0 envelope", () => {
    const legacy = createEnvelope({
      schema_version: "1.0",
      source: "DITO_EXTENSION_LEGACY",
    });
    delete legacy.submitted_by;

    assert.equal(safeParseDitoIncomingOrderEnvelope(legacy).success, true);
  });

  it("accepts structured billing and delivery details", () => {
    const envelope = createEnvelope();
    envelope.order.sales_code = "FE-1128647263";
    envelope.order.billing_cycle_day = 9;
    envelope.order.payment_due_day = 22;
    envelope.delivery.contact_phone = "941586778";
    envelope.delivery.time_range = "3pm-7pm";
    envelope.delivery.address =
      "AVENIDA MARISCAL ANDRES AVELINO CACERES 1220";
    envelope.delivery.reference = "garilazo de la vega";
    envelope.delivery.latitude = -13.156957739;
    envelope.delivery.longitude = -74.227206392;

    assert.equal(
      ditoExtensionOrderEnvelopeV2Schema.safeParse(envelope).success,
      true,
    );
  });
});
