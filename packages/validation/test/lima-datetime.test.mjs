import assert from "node:assert/strict";
import test from "node:test";

import { parseLimaDateTimeLocal } from "../dist/lima-datetime.js";

// SPEC-048 BR-001. La prueba corre con la zona que tenga el proceso; el
// script `test` la ejecuta además con TZ=UTC, que es la de producción.

test("una hora local de Lima se convierte al instante correcto sin mirar la zona del proceso", () => {
  const parsed = parseLimaDateTimeLocal("2026-09-09T10:00");
  assert.equal(parsed?.toISOString(), "2026-09-09T15:00:00.000Z");
});

test("acepta segundos y espacios alrededor", () => {
  assert.equal(
    parseLimaDateTimeLocal("  2026-09-09T10:00:30 ")?.toISOString(),
    "2026-09-09T15:00:30.000Z",
  );
});

test("una hora nocturna de Lima cae en el día siguiente en UTC", () => {
  assert.equal(
    parseLimaDateTimeLocal("2026-12-31T20:30")?.toISOString(),
    "2027-01-01T01:30:00.000Z",
  );
});

test("un texto con zona explícita se respeta tal cual", () => {
  assert.equal(
    parseLimaDateTimeLocal("2026-09-09T10:00:00Z")?.toISOString(),
    "2026-09-09T10:00:00.000Z",
  );
  assert.equal(
    parseLimaDateTimeLocal("2026-09-09T10:00-05:00")?.toISOString(),
    "2026-09-09T15:00:00.000Z",
  );
});

test("rechaza lo que no es una fecha y hora completas", () => {
  assert.equal(parseLimaDateTimeLocal(""), null);
  assert.equal(parseLimaDateTimeLocal("mañana"), null);
  assert.equal(parseLimaDateTimeLocal("2026-09-09"), null);
  assert.equal(parseLimaDateTimeLocal("2026-02-31T10:00"), null);
  assert.equal(parseLimaDateTimeLocal("2026-09-09T25:00"), null);
  assert.equal(parseLimaDateTimeLocal("2026-09-09T10:60"), null);
});
