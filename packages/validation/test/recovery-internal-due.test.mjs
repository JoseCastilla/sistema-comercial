import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyInternalRecoveryDue,
  compareInternalRecoveryCases,
  parseInternalRecoveryDue,
} from "../dist/recovery-internal-due.js";

const ahora = new Date("2026-09-05T20:00:00.000Z");
const hace = (horas) => new Date(ahora.getTime() - horas * 60 * 60 * 1000);
const dentroDe = (horas) => new Date(ahora.getTime() + horas * 60 * 60 * 1000);

test("solo se aceptan los tres vencimientos definidos", () => {
  assert.equal(parseInternalRecoveryDue("agenda"), "agenda");
  assert.equal(parseInternalRecoveryDue("primer_contacto"), "primer_contacto");
  assert.equal(parseInternalRecoveryDue("vencido"), null);
  assert.equal(parseInternalRecoveryDue(undefined), null);
});

test("primer contacto vence a las dos horas de la novedad, si nadie llamó", () => {
  const base = { status: "ASSIGNED", firstContactAt: null, nextActionAt: null };

  assert.equal(
    classifyInternalRecoveryDue({ ...base, noveltyAt: hace(3) }, ahora),
    "primer_contacto",
  );
  assert.equal(
    classifyInternalRecoveryDue({ ...base, noveltyAt: hace(1) }, ahora),
    null,
  );
  // Sin responsable también corre: el Día 0 es del asesor original y, si no
  // actúa, escala.
  assert.equal(
    classifyInternalRecoveryDue(
      { ...base, status: "OPEN", noveltyAt: hace(5) },
      ahora,
    ),
    "primer_contacto",
  );
});

test("con contacto previo ya no es primer contacto: es seguimiento", () => {
  const base = { status: "IN_PROGRESS", firstContactAt: hace(30), noveltyAt: hace(40) };

  assert.equal(
    classifyInternalRecoveryDue({ ...base, nextActionAt: hace(2) }, ahora),
    "seguimiento",
  );
  assert.equal(
    classifyInternalRecoveryDue({ ...base, nextActionAt: dentroDe(2) }, ahora),
    null,
  );
  assert.equal(
    classifyInternalRecoveryDue({ ...base, nextActionAt: null }, ahora),
    null,
  );
});

test("una agenda futura no vence nada; una pasada es agenda vencida", () => {
  const base = { status: "SCHEDULED", firstContactAt: hace(30), noveltyAt: hace(48) };

  assert.equal(
    classifyInternalRecoveryDue({ ...base, nextActionAt: dentroDe(24) }, ahora),
    null,
  );
  assert.equal(
    classifyInternalRecoveryDue({ ...base, nextActionAt: hace(1) }, ahora),
    "agenda",
  );
  // Agendado sin contacto previo: sigue siendo agenda, no primer contacto.
  assert.equal(
    classifyInternalRecoveryDue(
      { ...base, firstContactAt: null, nextActionAt: hace(1) },
      ahora,
    ),
    "agenda",
  );
});

test("en espera de confirmación no vence: está en verificación", () => {
  assert.equal(
    classifyInternalRecoveryDue(
      { status: "WAITING", firstContactAt: null, nextActionAt: hace(5), noveltyAt: hace(48) },
      ahora,
    ),
    null,
  );
});

const caso = (extra) => ({
  priority: "MEDIA",
  due: null,
  nextActionAt: null,
  noveltyAt: hace(10),
  ...extra,
});
const orden = (lista) => [...lista].sort(compareInternalRecoveryCases).map((c) => c.id);

test("la prioridad manda sobre todo lo demás", () => {
  assert.deepEqual(
    orden([
      caso({ id: "media-vencida", due: "seguimiento" }),
      caso({ id: "critica", priority: "CRITICA" }),
      caso({ id: "condicionada", priority: "CONDICIONADA", due: "agenda" }),
    ]),
    ["critica", "media-vencida", "condicionada"],
  );
});

test("dentro de la prioridad, lo vencido va antes que lo que aún no vence", () => {
  assert.deepEqual(
    orden([
      caso({ id: "por-vencer", nextActionAt: dentroDe(1) }),
      caso({ id: "vencido", due: "seguimiento", nextActionAt: hace(1) }),
    ]),
    ["vencido", "por-vencer"],
  );
});

test("después, lo más próximo a vencer; sin fecha, al final", () => {
  assert.deepEqual(
    orden([
      caso({ id: "sin-fecha" }),
      caso({ id: "en-3h", nextActionAt: dentroDe(3) }),
      caso({ id: "en-1h", nextActionAt: dentroDe(1) }),
    ]),
    ["en-1h", "en-3h", "sin-fecha"],
  );
});

test("el desempate usa fechas reales: agosto va antes que septiembre", () => {
  // Con la etiqueta «dd/mm», «01/09» ordenaba antes que «31/08».
  assert.deepEqual(
    orden([
      caso({ id: "septiembre", noveltyAt: new Date("2026-09-01T12:00:00.000Z") }),
      caso({ id: "agosto", noveltyAt: new Date("2026-08-31T12:00:00.000Z") }),
    ]),
    ["agosto", "septiembre"],
  );
});
