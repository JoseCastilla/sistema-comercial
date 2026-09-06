import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DirectoryFilters } from "@/features/admin/components/directory-filters";
import {
  filterBreakdown,
  managementFilterOptions,
  sortBreakdown,
  summarizeAdvisorActivity,
} from "@/features/performance/performance-management";
import { describeQuotaDistribution } from "@/features/performance/quota-distribution";

import type { PerformanceBreakdownItem } from "@/features/performance/performance.types";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockClear();
});

function advisor(
  name: string,
  overrides: {
    daily?: number[];
    active?: boolean;
    nextTarget?: number | null;
    missingForNextTarget?: number;
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
  const daily = overrides.daily ?? [];
  return {
    name,
    dailyEntered: daily,
    isActiveSeller: overrides.active ?? true,
    openRecoveryCases: 0,
    metrics: {
      entered: daily.reduce((total, value) => total + value, 0),
      payable: 0,
      deliveredPendingActivation: 0,
      recovery: 0,
    } as PerformanceBreakdownItem["metrics"],
    quota:
      overrides.nextTarget === undefined
        ? null
        : {
            target: 30,
            delivered: 0,
            confirmed: 0,
            missing: 30,
            reached: false,
            nextTarget: overrides.nextTarget,
            missingForNextTarget: overrides.missingForNextTarget ?? 0,
            ratio: 0,
            source: "DEFAULT" as const,
          },
  };
}

const days = [
  { day: 1, isFuture: false, isToday: false },
  { day: 2, isFuture: false, isToday: false },
  { day: 3, isFuture: false, isToday: true },
  { day: 4, isFuture: true, isToday: false },
];

/**
 * SPEC-044 SUP-02/03/04/06: acompañamiento sin juzgar asistencia, orden por
 * cercanía al bono, reparto de cuotas explicado y cambio de equipo que quita
 * al asesor del equipo anterior.
 */
describe("Acompañamiento del supervisor (SUP-02)", () => {
  it("resume ventas de hoy, última venta y días con ventas sin contar días futuros", () => {
    expect(summarizeAdvisorActivity([2, 0, 0, 5], days)).toEqual({
      today: 0,
      lastSaleDay: 1,
      productiveDays: 1,
      elapsedDays: 3,
    });
    expect(summarizeAdvisorActivity([0, 0, 0, 0], days).lastSaleDay).toBeNull();
  });

  it("«sin ventas hoy» solo existe en el mes en curso y solo para vendedores activos", () => {
    const rows = [
      advisor("Hoy sí", { daily: [0, 0, 3] }),
      advisor("Hoy no", { daily: [4, 0, 0] }),
      advisor("Histórico", { daily: [0, 0, 0], active: false }),
    ];
    expect(
      filterBreakdown(rows, "SIN_VENTAS_HOY", { todayIndex: 2 }).map(
        (r) => r.name,
      ),
    ).toEqual(["Hoy no"]);
    expect(filterBreakdown(rows, "SIN_VENTAS_HOY")).toEqual([]);
    expect(
      managementFilterOptions.find((o) => o.key === "SIN_VENTAS_HOY")
        ?.requiresCurrentMonth,
    ).toBe(true);
  });

  it("las definiciones hablan de ventas registradas, no de asistencia", () => {
    for (const option of managementFilterOptions) {
      expect(option.definition).not.toMatch(
        /falt[óo] al trabajo|ausen|inasisten/i,
      );
    }
  });
});

describe("Orden por cercanía al bono (SUP-03)", () => {
  it("primero quien menos confirmadas necesita; sin siguiente tramo, al final", () => {
    const rows = [
      advisor("Lejos", { nextTarget: 30, missingForNextTarget: 20 }),
      advisor("SinTramo", { nextTarget: null }),
      advisor("Cerca", { nextTarget: 30, missingForNextTarget: 2 }),
      advisor("SinCuota"),
    ];
    expect(sortBreakdown(rows, "BONO").map((r) => r.name)).toEqual([
      "Cerca",
      "Lejos",
      "SinCuota",
      "SinTramo",
    ]);
  });
});

describe("Reparto de cuotas explicado (SUP-04)", () => {
  it("distingue repartir de menos, justo o de más, sin bloquear", () => {
    expect(
      describeQuotaDistribution({
        teamTarget: 300,
        assignedTarget: 330,
        remaining: -30,
        covers: true,
      }),
    ).toEqual({
      tone: "OVER",
      text: "Objetivo del equipo: 300. Repartido: 330, 30 por encima del objetivo. Puede ser deliberado; no bloquea.",
    });
    expect(
      describeQuotaDistribution({
        teamTarget: 300,
        assignedTarget: 270,
        remaining: 30,
        covers: false,
      }).text,
    ).toBe("Objetivo del equipo: 300. Repartido: 270. Faltan 30 por repartir.");
    expect(
      describeQuotaDistribution({
        teamTarget: 300,
        assignedTarget: 300,
        remaining: 0,
        covers: true,
      }).tone,
    ).toBe("EXACT");
  });
});

describe("Cambio de equipo (SUP-06)", () => {
  it("al cambiar de equipo se quita el asesor del equipo anterior", () => {
    render(
      <DirectoryFilters
        basePath="/performance"
        fields={[{ key: "month", label: "Mes", value: "2026-09" }]}
        resultLabel=""
        selects={[
          {
            key: "team",
            label: "Equipo",
            value: "t-1",
            emptyLabel: "Mis equipos",
            options: [
              { value: "t-1", label: "Huancayo" },
              { value: "t-2", label: "Ayacucho" },
            ],
            resets: ["agent"],
          },
          {
            key: "agent",
            label: "Asesor",
            value: "u-ana",
            emptyLabel: "Todos",
            options: [{ value: "u-ana", label: "Ana" }],
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Equipo" }), {
      target: { value: "t-2" },
    });
    expect(replace).toHaveBeenLastCalledWith(
      "/performance?month=2026-09&team=t-2",
      { scroll: false },
    );
  });
});
