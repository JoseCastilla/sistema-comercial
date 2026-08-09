import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ditoOrderStatusUpdateSchema } from "../dist/dito-order-status-update-schema.js";

const orderId = "11111111-1111-4111-8111-111111111111";

describe("ditoOrderStatusUpdateSchema", () => {
  it("accepts SENT with a valid sent substatus", () => {
    const result = ditoOrderStatusUpdateSchema.safeParse({
      orderId,
      status: "SENT",
      sentSubstatus: "ASSIGNED",
      observation: "Pedido asignado a logística",
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.status, "SENT");
      assert.equal(result.data.sentSubstatus, "ASSIGNED");
      assert.equal(result.data.observation, "Pedido asignado a logística");
    }
  });

  it("rejects SENT without a sent substatus", () => {
    const result = ditoOrderStatusUpdateSchema.safeParse({
      orderId,
      status: "SENT",
      sentSubstatus: "",
      observation: "",
    });

    assert.equal(result.success, false);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;

      assert.equal(
        errors.sentSubstatus?.[0],
        "Selecciona el subestado de la orden enviada",
      );
    }
  });

  it("rejects a sent substatus for a non-SENT status", () => {
    const result = ditoOrderStatusUpdateSchema.safeParse({
      orderId,
      status: "OPEN",
      sentSubstatus: "SCHEDULED",
      observation: "",
    });

    assert.equal(result.success, false);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;

      assert.equal(
        errors.sentSubstatus?.[0],
        "Los subestados solo corresponden al estado Enviado",
      );
    }
  });

  it("normalizes blank observations to null and trims text", () => {
    const blankResult = ditoOrderStatusUpdateSchema.safeParse({
      orderId,
      status: "OPEN",
      sentSubstatus: "",
      observation: "   ",
    });

    assert.equal(blankResult.success, true);

    if (blankResult.success) {
      assert.equal(blankResult.data.observation, null);
    }

    const textResult = ditoOrderStatusUpdateSchema.safeParse({
      orderId,
      status: "OPEN",
      sentSubstatus: "",
      observation: "  Cliente solicita seguimiento  ",
    });

    assert.equal(textResult.success, true);

    if (textResult.success) {
      assert.equal(textResult.data.observation, "Cliente solicita seguimiento");
    }
  });

  it("rejects observations longer than 2000 characters", () => {
    const result = ditoOrderStatusUpdateSchema.safeParse({
      orderId,
      status: "OPEN",
      sentSubstatus: "",
      observation: "x".repeat(2001),
    });

    assert.equal(result.success, false);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;

      assert.equal(
        errors.observation?.[0],
        "La observación no puede superar 2000 caracteres",
      );
    }
  });

  it("requires a descriptive cancellation reason", () => {
    for (const observation of ["", "   ", "muy corto"]) {
      const result = ditoOrderStatusUpdateSchema.safeParse({
        orderId,
        status: "CANCELLED",
        sentSubstatus: "",
        observation,
      });

      assert.equal(result.success, false);

      if (!result.success) {
        assert.equal(
          result.error.flatten().fieldErrors.observation?.[0],
          "Indica un motivo de cancelación de al menos 10 caracteres",
        );
      }
    }

    assert.equal(
      ditoOrderStatusUpdateSchema.safeParse({
        orderId,
        status: "CANCELLED",
        sentSubstatus: "",
        observation: "Cliente desistió de la compra",
      }).success,
      true,
    );
  });

  it("rejects an invalid order identifier", () => {
    const result = ditoOrderStatusUpdateSchema.safeParse({
      orderId: "orden-no-valida",
      status: "OPEN",
      sentSubstatus: "",
      observation: "",
    });

    assert.equal(result.success, false);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;

      assert.equal(errors.orderId?.[0], "La orden no es válida");
    }
  });
});
