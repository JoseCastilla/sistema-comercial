import assert from "node:assert/strict";
import test from "node:test";

import {
  compareTeamMembers,
  sumTeamDay,
  summarizeTeamMemberDay,
} from "../dist/team-today.js";

const lima = (texto) => new Date(`${texto}-05:00`);

function miembro(extra = {}) {
  return {
    userId: "u-1",
    name: "Christian",
    now: [],
    campaignTotal: 0,
    coldCount: 0,
    attemptsToday: 0,
    enteredToday: 0,
    quotaDelivered: 0,
    quotaTarget: 45,
    lastAttemptAt: null,
    ...extra,
  };
}

test("separa ventas sin llamar, seguimientos, citas y pedidos del «Ahora»", () => {
  const resumen = summarizeTeamMemberDay(
    miembro({
      now: [
        { kind: "venta_caida", tier: "venta_en_riesgo", overdue: true },
        { kind: "venta_caida", tier: "venta_en_riesgo", overdue: false },
        { kind: "venta_caida", tier: "seguimiento_vencido", overdue: true },
        { kind: "cita", tier: "cita_vencida", overdue: true },
        { kind: "cita", tier: "cita_pronto", overdue: false },
        { kind: "pedido", tier: "pedido", overdue: true },
        { kind: "campana", tier: "campana", overdue: false },
      ],
      campaignTotal: 26,
      coldCount: 17,
    }),
    lima("2026-09-25T10:00"),
  );

  assert.equal(resumen.salesNotCalled, 2);
  assert.equal(resumen.salesNotCalledOverdue, 1);
  assert.equal(resumen.salesFollowUp, 1);
  assert.equal(resumen.citasOverdue, 1);
  assert.equal(resumen.citasSoon, 1);
  assert.equal(resumen.orders, 1);
  assert.equal(resumen.campaignTotal, 26);
  assert.equal(resumen.coldCount, 17);
});

test("sin gestiones: gris antes de las 11:00 y ámbar después; no es ausencia", () => {
  assert.equal(
    summarizeTeamMemberDay(miembro(), lima("2026-09-25T10:59")).idle,
    "temprano",
  );
  assert.equal(
    summarizeTeamMemberDay(miembro(), lima("2026-09-25T11:00")).idle,
    "tarde",
  );
  const activo = summarizeTeamMemberDay(
    miembro({ attemptsToday: 3, lastAttemptAt: lima("2026-09-25T11:40") }),
    lima("2026-09-25T15:00"),
  );
  assert.equal(activo.idle, "no");
  assert.equal(activo.lastAttemptLabel, "11:40");
});

test("primero quien pierde más: ventas vencidas, luego citas, luego pedidos", () => {
  const hora = lima("2026-09-25T15:00");
  const venta = summarizeTeamMemberDay(
    miembro({
      userId: "a",
      name: "Zoila",
      now: [{ kind: "venta_caida", tier: "venta_en_riesgo", overdue: true }],
    }),
    hora,
  );
  const cita = summarizeTeamMemberDay(
    miembro({
      userId: "b",
      name: "Ana",
      now: [
        { kind: "cita", tier: "cita_vencida", overdue: true },
        { kind: "cita", tier: "cita_vencida", overdue: true },
      ],
    }),
    hora,
  );
  const tranquilo = summarizeTeamMemberDay(
    miembro({ userId: "c", name: "Beto", campaignTotal: 30 }),
    hora,
  );

  assert.deepEqual(
    [tranquilo, cita, venta].sort(compareTeamMembers).map((m) => m.userId),
    ["a", "b", "c"],
  );
});

test("el equipo suma lo de hoy y la cuota", () => {
  const hora = lima("2026-09-25T15:00");
  const total = sumTeamDay([
    summarizeTeamMemberDay(
      miembro({
        now: [{ kind: "venta_caida", tier: "venta_en_riesgo", overdue: true }],
        quotaDelivered: 30,
        quotaTarget: 60,
        attemptsToday: 4,
      }),
      hora,
    ),
    summarizeTeamMemberDay(
      miembro({ userId: "u-2", quotaDelivered: 10, quotaTarget: 45 }),
      hora,
    ),
  ]);

  assert.equal(total.salesNotCalled, 1);
  assert.equal(total.quotaDelivered, 40);
  assert.equal(total.quotaTarget, 105);
  assert.equal(total.attemptsToday, 4);
});
