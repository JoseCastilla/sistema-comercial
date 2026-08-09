import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ditoOrderOrphanClaimSchema } from "../dist/dito-order-orphan-claim-schema.js";

const validClaim = {
  orderId: "847483f1-8d64-4a37-9d8e-a0f1dc2a124e",
  expectedUpdatedAt: "2026-08-08T22:36:28.514Z",
  teamId: "571d4e11-0f64-4ea9-9550-71c6ccd4c394",
  agentUserId: "98ac3f89-e6b3-4d1e-bb17-072974bae7db",
  reason: "DATA_CORRECTION",
  observation: "Asignación validada con el código de orden.",
};

describe("ditoOrderOrphanClaimSchema", () => {
  it("accepts a complete manual orphan claim", () => {
    assert.equal(
      ditoOrderOrphanClaimSchema.safeParse(validClaim).success,
      true,
    );
  });

  it("requires both an active-team candidate and an agent candidate", () => {
    assert.equal(
      ditoOrderOrphanClaimSchema.safeParse({
        ...validClaim,
        teamId: "",
        agentUserId: "",
      }).success,
      false,
    );
  });

  it("requires an observation when the selected reason is OTHER", () => {
    assert.equal(
      ditoOrderOrphanClaimSchema.safeParse({
        ...validClaim,
        reason: "OTHER",
        observation: "   ",
      }).success,
      false,
    );
  });
});
