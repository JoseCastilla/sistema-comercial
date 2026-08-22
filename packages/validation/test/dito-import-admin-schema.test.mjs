import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assignSharedDitoImportRowsSchema,
  confirmDitoImportBatchSchema,
  deleteDitoImportBatchSchema,
  markDitoAgentIdentitySharedSchema,
  resolveDitoImportConflictSchema,
  resolveDitoAgentIdentitySchema,
} from "../dist/dito-import-admin-schema.js";

const batchId = "847483f1-8d64-4a37-9d8e-a0f1dc2a124e";
const identityId = "571d4e11-0f64-4ea9-9550-71c6ccd4c394";
const userId = "98ac3f89-e6b3-4d1e-bb17-072974bae7db";
const expectedUpdatedAt = "2026-08-08T22:36:28.514Z";

describe("DITO import admin schemas", () => {
  it("accepts a complete identity resolution", () => {
    assert.equal(
      resolveDitoAgentIdentitySchema.safeParse({
        batchId,
        identityId,
        userId,
        expectedUpdatedAt,
      }).success,
      true,
    );
  });

  it("accepts a batch confirmation with optimistic concurrency", () => {
    assert.equal(
      confirmDitoImportBatchSchema.safeParse({ batchId, expectedUpdatedAt })
        .success,
      true,
    );
  });

  it("accepts deleting a preview with optimistic concurrency", () => {
    assert.equal(
      deleteDitoImportBatchSchema.safeParse({ batchId, expectedUpdatedAt })
        .success,
      true,
    );
  });

  it("rejects malformed identifiers", () => {
    assert.equal(
      confirmDitoImportBatchSchema.safeParse({
        batchId: "batch-1",
        expectedUpdatedAt,
      }).success,
      false,
    );
  });

  it("accepts marking an unresolved identity as shared", () => {
    assert.equal(
      markDitoAgentIdentitySharedSchema.safeParse({
        batchId,
        identityId,
        expectedUpdatedAt,
      }).success,
      true,
    );
  });

  it("accepts one or more manual row assignments", () => {
    assert.equal(
      assignSharedDitoImportRowsSchema.safeParse({
        batchId,
        assignments: [
          {
            rowId: identityId,
            userId,
            expectedUpdatedAt,
          },
        ],
      }).success,
      true,
    );
  });

  it("accepts explicit decisions for import conflicts", () => {
    assert.equal(
      resolveDitoImportConflictSchema.safeParse({
        batchId,
        rowId: identityId,
        expectedUpdatedAt,
        resolutions: [
          { field: "holderDocumentNumber", decision: "KEEP_CURRENT" },
          { field: "deliveryLatitude", decision: "USE_INCOMING" },
        ],
      }).success,
      true,
    );
  });

  it("rejects duplicate or unsafe conflict fields", () => {
    assert.equal(
      resolveDitoImportConflictSchema.safeParse({
        batchId,
        rowId: identityId,
        expectedUpdatedAt,
        resolutions: [
          { field: "salesCode", decision: "USE_INCOMING" },
          { field: "salesCode", decision: "KEEP_CURRENT" },
        ],
      }).success,
      false,
    );
  });
});
