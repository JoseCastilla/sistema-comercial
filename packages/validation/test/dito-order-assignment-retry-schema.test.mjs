import assert from "node:assert/strict";
import test from "node:test";

import { ditoOrderAssignmentRetrySchema } from "../dist/index.js";

test("accepts an order id and optimistic concurrency timestamp", () => {
  const result = ditoOrderAssignmentRetrySchema.safeParse({
    orderId: "847483f1-8d64-4a37-9d8e-a0f1dc2a124e",
    expectedUpdatedAt: "2026-08-06T16:47:37.475Z",
  });

  assert.equal(result.success, true);
});

test("rejects invalid recovery identifiers", () => {
  const result = ditoOrderAssignmentRetrySchema.safeParse({
    orderId: "1943794978A",
    expectedUpdatedAt: "today",
  });

  assert.equal(result.success, false);
});
