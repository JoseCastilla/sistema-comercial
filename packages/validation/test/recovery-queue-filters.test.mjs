import assert from "node:assert/strict";
import test from "node:test";

import {
  parseRecoveryAgeBucket,
  recoveryAgeBucketRange,
  recoveryAgeBuckets,
  summarizeRecoveryPlan,
} from "../dist/recovery-queue-filters.js";

test("el plan se resume por su precio, que es lo que distingue uno de otro", () => {
  assert.equal(
    summarizeRecoveryPlan("PLAN MAXIMO ILIMITADO S/ 39.90 PROMO 3M"),
    "Máximo S/ 39.90",
  );
  assert.equal(summarizeRecoveryPlan("Máximo S/49.9"), "Máximo S/49.9");
});

test("sin precio reconocible se muestra el texto tal cual; sin plan, un guion", () => {
  assert.equal(summarizeRecoveryPlan("Plan Corporativo"), "Plan Corporativo");
  assert.equal(summarizeRecoveryPlan(null), "—");
});

test("solo se aceptan los tramos definidos", () => {
  assert.equal(parseRecoveryAgeBucket("hoy"), "hoy");
  assert.equal(parseRecoveryAgeBucket("2-3"), "2-3");
  assert.equal(parseRecoveryAgeBucket("semana"), null);
  assert.equal(parseRecoveryAgeBucket(""), null);
  assert.equal(parseRecoveryAgeBucket(undefined), null);
});

// Un jueves 05/09/2026 a las 15:00 en Lima (20:00 UTC).
const ahora = new Date("2026-09-05T20:00:00.000Z");
const medianocheLima = (isoDia) => new Date(`${isoDia}T00:00:00-05:00`);

test("los tramos se cortan a medianoche de Lima, no de UTC", () => {
  assert.deepEqual(recoveryAgeBucketRange("hoy", ahora), {
    gte: medianocheLima("2026-09-05"),
  });
  assert.deepEqual(recoveryAgeBucketRange("ayer", ahora), {
    gte: medianocheLima("2026-09-04"),
    lt: medianocheLima("2026-09-05"),
  });
  assert.deepEqual(recoveryAgeBucketRange("2-3", ahora), {
    gte: medianocheLima("2026-09-02"),
    lt: medianocheLima("2026-09-04"),
  });
  assert.deepEqual(recoveryAgeBucketRange("mas", ahora), {
    lt: medianocheLima("2026-09-02"),
  });
});

test("los tramos son excluyentes y cubren toda la recta", () => {
  const cortes = recoveryAgeBuckets.map((bucket) =>
    recoveryAgeBucketRange(bucket.value, ahora),
  );

  // Cada tramo empieza exactamente donde termina el siguiente más antiguo.
  assert.equal(cortes[0].gte.getTime(), cortes[1].lt.getTime());
  assert.equal(cortes[1].gte.getTime(), cortes[2].lt.getTime());
  assert.equal(cortes[2].gte.getTime(), cortes[3].lt.getTime());
  assert.equal(cortes[0].lt, undefined);
  assert.equal(cortes[3].gte, undefined);
});

test("cerca de medianoche en Lima el día sigue siendo el de Lima", () => {
  // 23:30 en Lima del 05/09 son las 04:30 UTC del 06/09.
  const tarde = new Date("2026-09-06T04:30:00.000Z");

  assert.deepEqual(recoveryAgeBucketRange("hoy", tarde), {
    gte: medianocheLima("2026-09-05"),
  });
});
