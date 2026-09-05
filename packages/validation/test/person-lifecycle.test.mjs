import assert from "node:assert/strict";
import test from "node:test";

import {
  canDisablePerson,
  canPromotePerson,
  canReenterPerson,
  parsePersonDisableReason,
  planPortfolioRelease,
} from "../dist/person-lifecycle.js";

test("solo administración da de baja, nunca a sí misma, solo a comerciales activos", () => {
  const base = {
    actorRole: "ADMIN",
    actorUserId: "admin",
    targetUserId: "asesor",
    targetRole: "AGENT",
    targetStatus: "ACTIVE",
  };

  assert.equal(canDisablePerson(base).allowed, true);
  assert.equal(
    canDisablePerson({ ...base, actorRole: "SUPERVISOR" }).allowed,
    false,
  );
  assert.match(
    canDisablePerson({ ...base, targetUserId: "admin" }).reason,
    /a sí mismo/,
  );
  assert.equal(
    canDisablePerson({ ...base, targetRole: "BACKOFFICE" }).allowed,
    false,
  );
  assert.equal(
    canDisablePerson({ ...base, targetStatus: "DISABLED" }).allowed,
    false,
  );
  assert.equal(
    canDisablePerson({ ...base, targetRole: "SUPERVISOR" }).allowed,
    true,
  );
});

test("reingresa quien está de baja; promueve solo a un asesor activo con equipo", () => {
  assert.equal(
    canReenterPerson({
      actorRole: "ADMIN",
      targetRole: "AGENT",
      targetStatus: "DISABLED",
    }).allowed,
    true,
  );
  assert.equal(
    canReenterPerson({
      actorRole: "ADMIN",
      targetRole: "AGENT",
      targetStatus: "ACTIVE",
    }).allowed,
    false,
  );

  const promo = {
    actorRole: "ADMIN",
    targetRole: "AGENT",
    targetStatus: "ACTIVE",
    hasPrimaryTeam: true,
  };
  assert.equal(canPromotePerson(promo).allowed, true);
  assert.equal(
    canPromotePerson({ ...promo, targetRole: "SUPERVISOR" }).allowed,
    false,
  );
  assert.match(
    canPromotePerson({ ...promo, hasPrimaryTeam: false }).reason,
    /equipo/,
  );
});

test("el motivo de baja es uno de la lista", () => {
  assert.equal(parsePersonDisableReason("RENUNCIA"), "RENUNCIA");
  assert.equal(parsePersonDisableReason("despido"), null);
});

const casos = [
  {
    id: "c1",
    source: "NATIONAL_BASE",
    priority: null,
    originalAgentUserId: null,
  },
  {
    id: "c2",
    source: "INTERNAL_ORDER_STATE",
    priority: "ALTA",
    originalAgentUserId: "u-1",
  },
  {
    id: "c3",
    source: "INTERNAL_ORDER_STATE",
    priority: "CRITICA",
    originalAgentUserId: "u-dest",
  },
  { id: "c4", source: "MANUAL", priority: "MEDIA", originalAgentUserId: null },
];

test("sin destino: Campañas al pool y lo interno sin responsable", () => {
  assert.deepEqual(planPortfolioRelease(casos, null), {
    toPool: ["c1"],
    toUnassigned: ["c2", "c3", "c4"],
    toDestination: [],
    blockedByCritical: 0,
  });
});

test("con destino: lo interno se entrega, salvo la Crítica cuyo originador es el destino", () => {
  assert.deepEqual(planPortfolioRelease(casos, "u-dest"), {
    toPool: ["c1"],
    toUnassigned: ["c3"],
    toDestination: ["c2", "c4"],
    blockedByCritical: 1,
  });
});
