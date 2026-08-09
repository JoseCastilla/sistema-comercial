import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ditoOrderCancellationReviewSchema } from "../dist/dito-order-cancellation-request-schema.js";

const requestId = "11111111-1111-4111-8111-111111111111";

describe("ditoOrderCancellationReviewSchema", () => {
  it("accepts approval without an additional observation", () => {
    const result = ditoOrderCancellationReviewSchema.safeParse({
      requestId,
      decision: "APPROVE",
      observation: "",
    });

    assert.equal(result.success, true);
  });

  it("requires an explanation when rejecting", () => {
    const result = ditoOrderCancellationReviewSchema.safeParse({
      requestId,
      decision: "REJECT",
      observation: "no",
    });

    assert.equal(result.success, false);

    if (!result.success) {
      assert.equal(
        result.error.flatten().fieldErrors.observation?.[0],
        "Explica el rechazo con al menos 10 caracteres",
      );
    }
  });

  it("accepts a descriptive rejection", () => {
    assert.equal(
      ditoOrderCancellationReviewSchema.safeParse({
        requestId,
        decision: "REJECT",
        observation: "La venta continúa vigente",
      }).success,
      true,
    );
  });
});
