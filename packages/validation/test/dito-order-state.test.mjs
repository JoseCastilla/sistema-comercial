import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isNoStatusIncident,
  normalizeDitoOrderState,
  resolveDitoDeliveredAt,
} from "../dist/dito-order-state.js";

describe("normalizeDitoOrderState", () => {
  const occurredAt = new Date("2026-08-04T15:00:00.000Z");

  it("maps ABIERTO to OPEN", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "Abierto",

      occurredAt,
    });

    assert.equal(result.status, "OPEN");

    assert.equal(result.sentSubstatus, null);

    assert.equal(result.deliveryStatus, "PENDING");

    assert.equal(result.activationConfirmed, false);
  });

  it("maps ENVIADO without substatus to NO_STATUS", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "Enviado",

      occurredAt,
    });

    assert.equal(result.status, "SENT");

    assert.equal(result.sentSubstatus, "NO_STATUS");

    assert.deepEqual(result.noStatusDetectedAt, occurredAt);
  });

  it("preserves the first NO_STATUS detection time", () => {
    const detectedAt = new Date("2026-08-04T14:55:00.000Z");

    const result = normalizeDitoOrderState({
      statusRaw: "Enviado",

      sentSubstatusRaw: "Sin estado",

      occurredAt,

      currentNoStatusDetectedAt: detectedAt,
    });

    assert.deepEqual(result.noStatusDetectedAt, detectedAt);
  });

  it("maps ASIGNADO to IN_TRANSIT", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "Enviado",

      sentSubstatusRaw: "Asignado",

      occurredAt,
    });

    assert.equal(result.sentSubstatus, "ASSIGNED");

    assert.equal(result.deliveryStatus, "IN_TRANSIT");
  });

  it("maps AGENDADO to IN_TRANSIT", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "Enviado",

      sentSubstatusRaw: "Agendado",

      occurredAt,
    });

    assert.equal(result.sentSubstatus, "SCHEDULED");

    assert.equal(result.deliveryStatus, "IN_TRANSIT");
  });

  it("marks NO ENTREGADO as recoverable", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "Enviado",

      sentSubstatusRaw: "No entregado",

      occurredAt,
    });

    assert.equal(result.sentSubstatus, "NOT_DELIVERED");

    assert.equal(result.deliveryStatus, "NOT_DELIVERED");

    assert.equal(result.requiresRecovery, true);

    assert.equal(result.requiresReentryReview, false);
  });

  it("marks RECHAZADO for reentry review", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "Enviado",

      sentSubstatusRaw: "Rechazado",

      occurredAt,
    });

    assert.equal(result.sentSubstatus, "REJECTED");

    assert.equal(result.deliveryStatus, "CANCELLED");

    assert.equal(result.requiresReentryReview, true);
  });

  it("does not confirm activation for SENT DELIVERED", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "Enviado",

      sentSubstatusRaw: "Entregado",

      occurredAt,
    });

    assert.equal(result.sentSubstatus, "DELIVERED");

    assert.equal(result.deliveryStatus, "DELIVERED");

    assert.equal(result.activationConfirmed, false);

    assert.equal(result.isTerminal, false);
  });

  it("confirms activation only when CLOSED", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "Cerrado",

      occurredAt,
    });

    assert.equal(result.status, "CLOSED");

    assert.equal(result.sentSubstatus, null);

    assert.equal(result.deliveryStatus, "DELIVERED");

    assert.equal(result.activationConfirmed, true);

    assert.equal(result.isTerminal, true);
  });

  it("marks CANCELADO for human review", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "Cancelado",

      occurredAt,
    });

    assert.equal(result.status, "CANCELLED");

    assert.equal(result.deliveryStatus, "CANCELLED");

    assert.equal(result.requiresReentryReview, true);

    assert.equal(result.requiresRecovery, true);
  });

  it("infers SENT when only a sent substatus is received", () => {
    const result = normalizeDitoOrderState({
      statusRaw: "No entregado",

      occurredAt,
    });

    assert.equal(result.status, "SENT");

    assert.equal(result.sentSubstatus, "NOT_DELIVERED");
  });

  it("does not stringify objects as statuses", () => {
    const result = normalizeDitoOrderState({
      statusRaw: {
        value: "Abierto",
      },

      occurredAt,
    });

    assert.equal(result.status, "UNKNOWN");

    assert.equal(result.statusRaw, null);

    assert.equal(result.sentSubstatus, null);
  });
});

describe("resolveDitoDeliveredAt", () => {
  const changedAt = new Date("2026-08-04T16:00:00.000Z");

  it("sets the delivery time when the order becomes delivered", () => {
    const result = resolveDitoDeliveredAt("DELIVERED", null, changedAt);

    assert.deepEqual(result, changedAt);
  });

  it("preserves the original delivery time while delivery remains confirmed", () => {
    const originalDeliveredAt = new Date("2026-08-04T15:30:00.000Z");

    const result = resolveDitoDeliveredAt(
      "DELIVERED",
      originalDeliveredAt,
      changedAt,
    );

    assert.deepEqual(result, originalDeliveredAt);
  });

  it("clears the delivery time when delivery is reverted", () => {
    const originalDeliveredAt = new Date("2026-08-04T15:30:00.000Z");

    const result = resolveDitoDeliveredAt(
      "NOT_DELIVERED",
      originalDeliveredAt,
      changedAt,
    );

    assert.equal(result, null);
  });
});

describe("isNoStatusIncident", () => {
  const state = {
    status: "SENT",

    sentSubstatus: "NO_STATUS",

    noStatusDetectedAt: new Date("2026-08-04T15:00:00.000Z"),
  };

  it("does not trigger before ten minutes", () => {
    const incident = isNoStatusIncident(
      state,
      new Date("2026-08-04T15:09:59.999Z"),
    );

    assert.equal(incident, false);
  });

  it("triggers at ten minutes", () => {
    const incident = isNoStatusIncident(
      state,
      new Date("2026-08-04T15:10:00.000Z"),
    );

    assert.equal(incident, true);
  });
});
