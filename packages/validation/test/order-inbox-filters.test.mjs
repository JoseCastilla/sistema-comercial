import assert from "node:assert/strict";
import test from "node:test";

import {
  orderActionFilterOptions,
  orderActionGroups,
  orderActionKindLabels,
  orderDueFilterWindow,
  parseOrderActionFilter,
  parseOrderDueFilter,
  resolveOrderActionKinds,
} from "../dist/order-inbox-filters.js";

test("el filtro de acción acepta el grupo del indicador y la acción exacta", () => {
  assert.equal(parseOrderActionFilter("coordinar"), "coordinar");
  assert.equal(parseOrderActionFilter("RESCHEDULE"), "RESCHEDULE");
  assert.equal(parseOrderActionFilter("reagendar"), null);
  assert.equal(parseOrderActionFilter(undefined), null);
});

test("un grupo abre exactamente las acciones que su indicador cuenta", () => {
  assert.deepEqual(resolveOrderActionKinds("coordinar"), [
    "RESCHEDULE",
    "MEETING_POINT",
  ]);
  assert.deepEqual(resolveOrderActionKinds("reingresar"), [
    "REENTER",
    "WAIT_PORTABILITY",
  ]);
  // Reagendar muestra solo lo que hay que reagendar.
  assert.deepEqual(resolveOrderActionKinds("RESCHEDULE"), ["RESCHEDULE"]);
});

test("cada acción pertenece a un solo grupo y el selector las ofrece todas", () => {
  const kinds = Object.keys(orderActionKindLabels);
  const grouped = orderActionGroups.flatMap((group) => group.kinds);

  assert.deepEqual([...grouped].sort(), [...kinds].sort());
  assert.equal(new Set(grouped).size, grouped.length);

  const offered = orderActionFilterOptions.map((option) => option.value);
  for (const kind of kinds) assert.ok(offered.includes(kind), kind);
  for (const group of orderActionGroups)
    assert.ok(offered.includes(group.value));
});

test("el filtro de plazo solo acepta sus cuatro tramos", () => {
  assert.equal(parseOrderDueFilter("vencido"), "vencido");
  assert.equal(parseOrderDueFilter("sin_horario"), "sin_horario");
  assert.equal(parseOrderDueFilter("OVERDUE"), null);
});

test("vencido es antes de ahora; pronto, los próximos 30 minutos; el resto no tiene fecha", () => {
  const ahora = new Date("2026-09-05T20:00:00.000Z");

  assert.deepEqual(orderDueFilterWindow("vencido", ahora), { lt: ahora });
  assert.deepEqual(orderDueFilterWindow("pronto", ahora), {
    gte: ahora,
    lt: new Date("2026-09-05T20:30:00.000Z"),
  });
  assert.equal(orderDueFilterWindow("sin_horario", ahora), null);
  assert.equal(orderDueFilterWindow("sin_plazo", ahora), null);
});
