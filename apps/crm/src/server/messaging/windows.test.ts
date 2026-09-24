import { describe, expect, it } from "vitest";

import { canWriteFreely, describeWindow, freeTextUntil } from "./windows";

const now = new Date("2026-09-12T15:00:00Z");

describe("ventana de 24 h", () => {
  it("sin mensaje del cliente no se puede escribir libre", () => {
    expect(canWriteFreely(null, now)).toBe(false);
    expect(freeTextUntil(null)).toBeNull();
  });

  it("dentro de las 24 h se puede; a las 24 h exactas ya no", () => {
    expect(canWriteFreely(new Date("2026-09-11T15:00:01Z"), now)).toBe(true);
    expect(canWriteFreely(new Date("2026-09-11T15:00:00Z"), now)).toBe(false);
  });

  it("el texto dice la consecuencia, no el término de Meta", () => {
    expect(describeWindow(new Date("2026-09-10T15:00:00Z"), null, now)).toMatch(/usa una plantilla|Envía una plantilla/i);
    expect(describeWindow(new Date("2026-09-12T14:00:00Z"), null, now)).toMatch(/libremente/);
  });
});
