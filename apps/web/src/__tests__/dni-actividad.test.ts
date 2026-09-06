import { describe, expect, it } from "vitest";

import { buildDniLookupStats, splitBySource } from "@/features/dni/dni-stats";

/**
 * SPEC-045 PL-10: la actividad propia y la de la organización se cuentan
 * aparte, y las consultas nuevas (gastan crédito) se distinguen de las
 * lecturas guardadas.
 */
describe("Actividad de consultas DNI", () => {
  it("separa consultas nuevas de lecturas guardadas", () => {
    expect(
      splitBySource([
        { source: "API", count: 3 },
        { source: "CACHE", count: 5 },
        { source: "API", count: 1 },
      ]),
    ).toEqual({ api: 4, cache: 5 });
    expect(splitBySource([])).toEqual({ api: 0, cache: 0 });
  });

  it("la organización solo aparece cuando se pide; lo propio siempre", () => {
    const personal = {
      today: 1,
      month: 9,
      uniqueDnisThisMonth: 7,
      apiThisMonth: 4,
      cacheThisMonth: 5,
    };
    expect(buildDniLookupStats(personal, null).organization).toBeNull();
    const withOrganization = buildDniLookupStats(personal, {
      ...personal,
      month: 40,
      apiThisMonth: 30,
      cacheThisMonth: 10,
    });
    expect(withOrganization.month).toBe(9);
    expect(withOrganization.organization?.month).toBe(40);
    expect(withOrganization.organization?.apiThisMonth).toBe(30);
  });
});
