import assert from "node:assert/strict";
import test from "node:test";

import { allOf } from "../dist/recovery-where.js";

test("dos condiciones sobre la misma clave se conservan las dos", () => {
  // El caso real de COR-01: la vista exige «ninguna línea sin consultar» y
  // el filtro de plan «alguna línea con ese plan». Por spread sobrevivía
  // solo la segunda.
  const vista = { services: { none: { portabilityCheckedAt: null } } };
  const plan = { services: { some: { planRaw: { contains: "49.9" } } } };

  assert.deepEqual(allOf(vista, plan), { AND: [vista, plan] });
});

test("los fragmentos vacíos, nulos o falsos no ensucian la consulta", () => {
  const alcance = { organizationId: "org" };

  assert.deepEqual(allOf(alcance, null, undefined, false, {}), {
    AND: [alcance],
  });
});

test("sin fragmentos útiles devuelve un AND vacío, que no filtra nada", () => {
  assert.deepEqual(allOf(null, {}), { AND: [] });
});

test("respeta el orden en que se escribieron las condiciones", () => {
  const a = { status: "TRIAGE" };
  const b = { department: "Lima" };

  assert.deepEqual(allOf(a, b).AND, [a, b]);
});
