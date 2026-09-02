import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addPortabilityLock,
  decideRecoveryPortability,
  isMovistarReceiver,
  needsPortabilityRecross,
  parseRecoveryPortabilityState,
  parseRecoveryPortabilityWindow,
} from "../dist/recovery-portability.js";

const MOVISTAR = "Telefónica del Perú S. A.A.(22)";
const CLARO = "América Móvil Perú S.A.C. (Claro)";
const now = new Date("2026-08-26T12:00:00.000-05:00");

describe("isMovistarReceiver", () => {
  it("recognises the report spelling for Movistar", () => {
    assert.equal(isMovistarReceiver(MOVISTAR), true);
  });

  it("rejects other carriers and empty receivers", () => {
    assert.equal(isMovistarReceiver(CLARO), false);
    assert.equal(isMovistarReceiver("Entel Perú S.A."), false);
    assert.equal(isMovistarReceiver("-"), false);
    assert.equal(isMovistarReceiver(null), false);
  });
});

describe("parseRecoveryPortabilityState", () => {
  it("maps the three states of the report", () => {
    assert.equal(parseRecoveryPortabilityState("Número portado"), "PORTADO");
    assert.equal(
      parseRecoveryPortabilityState("Número no portado"),
      "NO_PORTADO",
    );
    assert.equal(
      parseRecoveryPortabilityState("Número programado para portación"),
      "PROGRAMADO",
    );
  });

  it("falls back to DESCONOCIDO", () => {
    assert.equal(parseRecoveryPortabilityState(""), "DESCONOCIDO");
    assert.equal(parseRecoveryPortabilityState("otra cosa"), "DESCONOCIDO");
  });
});

describe("parseRecoveryPortabilityWindow", () => {
  it("parses the latin date format of the report", () => {
    const parsed = parseRecoveryPortabilityWindow("5/07/2026 00:00");

    assert.equal(parsed?.toISOString(), "2026-07-05T05:00:00.000Z");
  });

  it("treats the dash as no window at all", () => {
    assert.equal(parseRecoveryPortabilityWindow("-"), null);
    assert.equal(parseRecoveryPortabilityWindow(""), null);
    assert.equal(parseRecoveryPortabilityWindow(null), null);
  });
});

describe("addPortabilityLock", () => {
  it("adds the thirty day lock", () => {
    const eligible = addPortabilityLock(new Date("2026-08-01T05:00:00.000Z"));

    assert.equal(eligible.toISOString(), "2026-08-31T05:00:00.000Z");
  });
});

describe("decideRecoveryPortability", () => {
  it("discards a line already ported to Movistar (BR-019)", () => {
    const decision = decideRecoveryPortability({
      state: "PORTADO",
      receiverRaw: MOVISTAR,
      windowDate: new Date("2026-07-05T05:00:00.000Z"),
      now,
    });

    assert.equal(decision.outcome, "DISCARD_ALREADY_ACTIVE");
  });

  it("waits when a portability to Movistar is scheduled with a date (BR-019b)", () => {
    const decision = decideRecoveryPortability({
      state: "PROGRAMADO",
      receiverRaw: MOVISTAR,
      windowDate: new Date("2026-08-28T05:00:00.000Z"),
      now,
    });

    assert.equal(decision.outcome, "WAIT_IN_PROGRESS");
    assert.equal(decision.needsRevalidation, false);
  });

  it("flags revalidation when the scheduled portability has no date (BR-019e)", () => {
    const decision = decideRecoveryPortability({
      state: "PROGRAMADO",
      receiverRaw: MOVISTAR,
      windowDate: null,
      now,
    });

    assert.equal(decision.outcome, "WAIT_REVALIDATE");
    assert.equal(decision.needsRevalidation, true);
  });

  it("schedules a line ported elsewhere until it can port again (BR-019d)", () => {
    const decision = decideRecoveryPortability({
      state: "PORTADO",
      receiverRaw: CLARO,
      windowDate: new Date("2026-08-20T05:00:00.000Z"),
      now,
    });

    assert.equal(decision.outcome, "SCHEDULE_UNTIL_ELIGIBLE");
    assert.equal(decision.eligibleAt?.toISOString(), "2026-09-19T05:00:00.000Z");
  });

  it("keeps an old portability as an immediate opportunity", () => {
    const decision = decideRecoveryPortability({
      state: "PORTADO",
      receiverRaw: CLARO,
      windowDate: new Date("2025-05-06T05:00:00.000Z"),
      now,
    });

    assert.equal(decision.outcome, "OPPORTUNITY");
    assert.equal(decision.eligibleAt, null);
  });

  it("marks a line without any window as a plant line (BR-040)", () => {
    const decision = decideRecoveryPortability({
      state: "NO_PORTADO",
      receiverRaw: "-",
      windowDate: null,
      now,
    });

    assert.equal(decision.outcome, "PLANT_LINE");
    assert.equal(decision.isPlantLine, true);
    assert.equal(decision.eligibleAt, null);
  });

  it("signals competition when the scheduled portability goes elsewhere (BR-019c)", () => {
    const decision = decideRecoveryPortability({
      state: "PROGRAMADO",
      receiverRaw: CLARO,
      windowDate: new Date("2026-08-25T05:00:00.000Z"),
      now,
    });

    assert.equal(decision.outcome, "SCHEDULE_UNTIL_ELIGIBLE");
    assert.equal(decision.eligibleAt?.toISOString(), "2026-09-24T05:00:00.000Z");
  });

  it("never declares a loss on its own (BR-019d)", () => {
    const outcomes = [
      "PORTADO",
      "NO_PORTADO",
      "PROGRAMADO",
      "DESCONOCIDO",
    ].flatMap((state) =>
      [MOVISTAR, CLARO, "-"].map(
        (receiver) =>
          decideRecoveryPortability({
            state,
            receiverRaw: receiver,
            windowDate: new Date("2026-08-20T05:00:00.000Z"),
            now,
          }).outcome,
      ),
    );

    assert.equal(
      outcomes.every((outcome) => outcome !== "LOST"),
      true,
    );
  });
});

describe("needsPortabilityRecross", () => {
  it("keeps out the line whose chip already has a date", () => {
    assert.equal(
      needsPortabilityRecross({
        state: "PROGRAMADO",
        receiverRaw: MOVISTAR,
        now,
        windowDate: new Date("2026-09-01T10:00:00.000-05:00"),
      }),
      false,
    );
    assert.equal(
      needsPortabilityRecross({
        state: "PROGRAMADO",
        receiverRaw: MOVISTAR,
        now,
        windowDate: new Date("2026-09-30T10:00:00.000-05:00"),
      }),
      false,
    );
  });

  it("keeps out the line already ported to Movistar", () => {
    assert.equal(
      needsPortabilityRecross({
        state: "PORTADO",
        receiverRaw: MOVISTAR,
        now,
        windowDate: new Date("2026-08-20T10:00:00.000-05:00"),
      }),
      false,
    );
  });

  it("returns the Movistar order without a date: it can fall through today", () => {
    assert.equal(
      needsPortabilityRecross({
        state: "PROGRAMADO",
        receiverRaw: MOVISTAR,
        now,
        windowDate: null,
      }),
      true,
    );
  });

  it("returns every line sitting at another carrier", () => {
    for (const state of ["PORTADO", "NO_PORTADO", "PROGRAMADO", "DESCONOCIDO"]) {
      assert.equal(
        needsPortabilityRecross({
          state,
          receiverRaw: CLARO,
          now,
        windowDate: new Date("2026-08-20T10:00:00.000-05:00"),
        }),
        true,
        `${state} hacia otro operador debe volver al filtro`,
      );
    }
  });

  it("returns the line nobody has consulted yet", () => {
    assert.equal(
      needsPortabilityRecross({
        state: null,
        receiverRaw: null,
        now,
        windowDate: null,
      }),
      true,
    );
  });
});

describe("needsPortabilityRecross · la ventana manda", () => {
  it("no vuelve al filtro mientras la ventana está por delante", () => {
    assert.equal(
      needsPortabilityRecross({
        state: "PROGRAMADO",
        receiverRaw: MOVISTAR,
        windowDate: new Date("2026-08-30T10:00:00.000-05:00"),
        now: new Date("2026-08-26T12:00:00.000-05:00"),
      }),
      false,
    );
  });

  it("tampoco el mismo día de la ventana: el chip llega hoy", () => {
    assert.equal(
      needsPortabilityRecross({
        state: "PROGRAMADO",
        receiverRaw: MOVISTAR,
        windowDate: new Date("2026-08-26T23:00:00.000-05:00"),
        now: new Date("2026-08-26T08:00:00.000-05:00"),
      }),
      false,
    );
  });

  it("vuelve al filtro al día siguiente de la ventana", () => {
    assert.equal(
      needsPortabilityRecross({
        state: "PROGRAMADO",
        receiverRaw: MOVISTAR,
        windowDate: new Date("2026-08-25T23:00:00.000-05:00"),
        now: new Date("2026-08-26T08:00:00.000-05:00"),
      }),
      true,
    );
  });
});
