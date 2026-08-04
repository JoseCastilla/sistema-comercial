import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeAgentAlias } from "../dist/agent-alias.js";

describe("normalizeAgentAlias", () => {
  it("normalizes casing and surrounding spaces", () => {
    assert.equal(normalizeAgentAlias("  Jimena C.  "), "JIMENA C.");
  });

  it("removes accents", () => {
    assert.equal(normalizeAgentAlias("José Núñez"), "JOSE NUNEZ");
  });

  it("collapses repeated whitespace", () => {
    assert.equal(normalizeAgentAlias("Jimena    Cuya"), "JIMENA CUYA");
  });

  it("returns null for blank text", () => {
    assert.equal(normalizeAgentAlias("   "), null);
  });

  it("returns null for non-string values", () => {
    assert.equal(normalizeAgentAlias({ name: "Jimena" }), null);
  });
});
