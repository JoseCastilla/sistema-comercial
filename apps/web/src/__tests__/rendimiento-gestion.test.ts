import { describe, expect, it } from "vitest";

import {
  managementHref,
  performanceHref,
  sortHref,
} from "@/features/performance/performance-links";
import {
  filterBreakdown,
  matchesManagementFilter,
  parseBreakdownSort,
  parseManagementFilter,
  sortBreakdown,
} from "@/features/performance/performance-management";

import type { PerformanceBreakdownItem } from "@/features/performance/performance.types";

function advisor(
  name: string,
  overrides: {
    entered?: number;
    payable?: number;
    pending?: number;
    recovery?: number;
    cases?: number;
    active?: boolean;
    quota?: { target: number; delivered: number; confirmed?: number } | null;
  } = {},
): Pick<
  PerformanceBreakdownItem,
  | "name"
  | "metrics"
  | "quota"
  | "openRecoveryCases"
  | "isActiveSeller"
  | "dailyEntered"
> {
  const quota = overrides.quota ?? null;
  return {
    name,
    dailyEntered: [],
    isActiveSeller: overrides.active ?? true,
    openRecoveryCases: overrides.cases ?? 0,
    metrics: {
      entered: overrides.entered ?? 0,
      payable: overrides.payable ?? 0,
      deliveredPendingActivation: overrides.pending ?? 0,
      recovery: overrides.recovery ?? 0,
    } as PerformanceBreakdownItem["metrics"],
    quota: quota
      ? {
          target: quota.target,
          delivered: quota.delivered,
          confirmed: quota.confirmed ?? 0,
          missing: Math.max(0, quota.target - quota.delivered),
          reached: quota.delivered >= quota.target,
          nextTarget: null,
          missingForNextTarget: 0,
        }
      : null,
  };
}

const alcance = {
  month: "2026-09",
  view: "TEAM" as const,
  canSwitchView: false,
  teamFilter: "ALL",
  agentFilter: "ALL",
  from: "2026-09-01",
  to: "2026-09-30",
  sort: "ENTREGADAS" as const,
  management: null,
};

/**
 * SPEC-044 REN-04/REN-05: el orden y los filtros de gestión del desglose
 * tienen una definición única y viven en la URL.
 */
describe("Filtros de gestión del desglose", () => {
  it("«sin producción» es un vendedor activo con cero ingresadas; un histórico no cuenta", () => {
    expect(
      matchesManagementFilter(advisor("Ana", { entered: 0 }), "SIN_PRODUCCION"),
    ).toBe(true);
    expect(
      matchesManagementFilter(
        advisor("Luis", { entered: 0, active: false }),
        "SIN_PRODUCCION",
      ),
    ).toBe(false);
    expect(
      matchesManagementFilter(advisor("Eva", { entered: 3 }), "SIN_PRODUCCION"),
    ).toBe(false);
  });

  it("«cuota pendiente» es entregadas < cuota, sin proyección; sin cuota no aplica", () => {
    const rows = [
      advisor("Ana", { quota: { target: 30, delivered: 28 } }),
      advisor("Luis", { quota: { target: 30, delivered: 30 } }),
      advisor("Eva", { quota: null }),
    ];
    expect(filterBreakdown(rows, "CUOTA_PENDIENTE").map((r) => r.name)).toEqual(
      ["Ana"],
    );
    expect(filterBreakdown(rows, null)).toHaveLength(3);
  });

  it("por activar y por recuperar exigen al menos una", () => {
    const rows = [
      advisor("Ana", { pending: 2 }),
      advisor("Luis", { recovery: 1 }),
      advisor("Eva"),
    ];
    expect(filterBreakdown(rows, "POR_ACTIVAR").map((r) => r.name)).toEqual([
      "Ana",
    ]);
    expect(filterBreakdown(rows, "POR_RECUPERAR").map((r) => r.name)).toEqual([
      "Luis",
    ]);
  });

  it("un valor desconocido en la URL vuelve al orden y al filtro por defecto", () => {
    expect(parseBreakdownSort("lo-que-sea")).toBe("ENTREGADAS");
    expect(parseBreakdownSort("CUOTA")).toBe("CUOTA");
    expect(parseManagementFilter("x")).toBeNull();
    expect(parseManagementFilter("POR_ACTIVAR")).toBe("POR_ACTIVAR");
  });
});

describe("Orden del desglose", () => {
  it("por cuota: primero quien no llega, del más cercano al más lejano; luego los cumplidos", () => {
    const rows = [
      advisor("Cumplida", { quota: { target: 30, delivered: 35 } }),
      advisor("Lejos", { quota: { target: 30, delivered: 5 } }),
      advisor("Cerca", { quota: { target: 30, delivered: 28 } }),
      advisor("SinCuota", { quota: null }),
    ];
    expect(sortBreakdown(rows, "CUOTA").map((r) => r.name)).toEqual([
      "Cerca",
      "Lejos",
      "Cumplida",
      "SinCuota",
    ]);
  });

  it("«más pagables» manda pagables, luego ingresadas, luego el nombre", () => {
    const rows = [
      advisor("B", { payable: 2, entered: 5 }),
      advisor("A", { payable: 2, entered: 5 }),
      advisor("C", { payable: 3, entered: 1 }),
    ];
    expect(sortBreakdown(rows, "PAGABLES").map((r) => r.name)).toEqual([
      "C",
      "A",
      "B",
    ]);
    expect(sortBreakdown(rows, "NOMBRE").map((r) => r.name)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("por activar y por recuperar ordenan de mayor a menor", () => {
    const rows = [
      advisor("Uno", { pending: 1, recovery: 4 }),
      advisor("Dos", { pending: 3, recovery: 0, cases: 2 }),
    ];
    expect(sortBreakdown(rows, "POR_ACTIVAR")[0]?.name).toBe("Dos");
    expect(sortBreakdown(rows, "POR_RECUPERAR")[0]?.name).toBe("Uno");
  });
});

describe("Enlaces de orden y gestión", () => {
  it("el orden y el filtro viajan en la URL solo cuando se apartan del defecto", () => {
    expect(performanceHref(alcance)).toBe("/performance?month=2026-09");
    expect(sortHref(alcance, "CUOTA")).toBe(
      "/performance?month=2026-09&orden=CUOTA",
    );
    expect(managementHref(alcance, "SIN_PRODUCCION")).toBe(
      "/performance?month=2026-09&gestion=SIN_PRODUCCION",
    );
  });

  it("volver a elegir el filtro activo lo quita, y el resto del alcance se conserva", () => {
    const filtrado = {
      ...alcance,
      teamFilter: "t-1",
      sort: "CUOTA" as const,
      management: "SIN_PRODUCCION" as const,
    };
    expect(managementHref(filtrado, "SIN_PRODUCCION")).toBe(
      "/performance?month=2026-09&team=t-1&orden=CUOTA",
    );
    expect(managementHref(filtrado, "POR_ACTIVAR")).toBe(
      "/performance?month=2026-09&team=t-1&orden=CUOTA&gestion=POR_ACTIVAR",
    );
  });
});
