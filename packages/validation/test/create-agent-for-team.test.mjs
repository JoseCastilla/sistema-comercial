import assert from "node:assert/strict";
import test from "node:test";

import { canCreateAgentForTeam } from "../dist/commercial-team-rules.js";

test("un supervisor da de alta asesores solo en equipos activos que supervisa", () => {
  const base = {
    actorRole: "SUPERVISOR",
    supervisedTeamIds: ["t-1", "t-2"],
    teamId: "t-1",
    teamStatus: "ACTIVE",
  };

  assert.equal(canCreateAgentForTeam(base), true);
  assert.equal(canCreateAgentForTeam({ ...base, teamId: "t-9" }), false);
  assert.equal(canCreateAgentForTeam({ ...base, teamStatus: "DISABLED" }), false);
});

test("administración puede en cualquier equipo activo; asesor y back office, en ninguno", () => {
  const base = { supervisedTeamIds: [], teamId: "t-1", teamStatus: "ACTIVE" };

  assert.equal(canCreateAgentForTeam({ ...base, actorRole: "ADMIN" }), true);
  assert.equal(
    canCreateAgentForTeam({ ...base, actorRole: "ADMIN", teamStatus: "DISABLED" }),
    false,
  );
  assert.equal(canCreateAgentForTeam({ ...base, actorRole: "AGENT" }), false);
  assert.equal(canCreateAgentForTeam({ ...base, actorRole: "BACKOFFICE" }), false);
});
