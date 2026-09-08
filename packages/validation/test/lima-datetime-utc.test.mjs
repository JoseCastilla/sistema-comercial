import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import process from "node:process";
import test from "node:test";
import { URL } from "node:url";

// SPEC-048 BR-001. Node lee TZ al arrancar, así que la zona de producción
// (UTC, la de los contenedores sin TZ) se prueba en un proceso hijo. Es la
// condición exacta en la que el `new Date(texto)` anterior fallaba.

const moduleUrl = new URL("../dist/lima-datetime.js", import.meta.url).href;

function parseUnder(timeZone, raw) {
  const script = [
    `import(${JSON.stringify(moduleUrl)}).then((m) => {`,
    `  const parsed = m.parseLimaDateTimeLocal(${JSON.stringify(raw)});`,
    "  process.stdout.write(parsed ? parsed.toISOString() : \"null\");",
    "});",
  ].join("\n");

  return execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, TZ: timeZone },
    encoding: "utf8",
  });
}


test("con TZ=UTC una cita a las 10:00 de Lima sigue siendo las 15:00 UTC", () => {
  assert.equal(parseUnder("UTC", "2026-09-09T10:00"), "2026-09-09T15:00:00.000Z");
});

test("con TZ=America/Lima el resultado es el mismo", () => {
  assert.equal(parseUnder("America/Lima", "2026-09-09T10:00"), "2026-09-09T15:00:00.000Z");
});

test("con una zona al este de Greenwich tampoco cambia", () => {
  assert.equal(parseUnder("Europe/Madrid", "2026-09-09T10:00"), "2026-09-09T15:00:00.000Z");
});
