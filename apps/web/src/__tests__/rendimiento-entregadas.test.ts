import {
  calculatePerformanceMetrics,
  countOrdersDeliveredBefore,
  filterOrdersRegisteredThroughLimaDay,
} from "@repo/validation";
import { describe, expect, it } from "vitest";

import { performanceHref } from "@/features/performance/performance-links";
import {
  defaultBreakdownSort,
  filterBreakdown,
  getManagementFilterOption,
  parseBreakdownSort,
  sortBreakdown,
} from "@/features/performance/performance-management";

import type { PerformanceOrderInput } from "@repo/validation";

import type { PerformanceBreakdownItem } from "@/features/performance/performance.types";

/**
 * SPEC-047 fase 1: el resultado se mide en ventas entregadas de la cohorte
 * por fecha de ingreso; la comparación con el mes pasado respeta la
 * maduración; el orden y el filtro nuevos hablan de entregadas.
 */
function order(
  overrides: Partial<PerformanceOrderInput> & {
    registeredAt: Date;
  },
): PerformanceOrderInput {
  return {
    commercialOperation: "PORT_POSTPAID",
    status: "SENT",
    deliveryStatus: "PENDING",
    sentSubstatus: null,
    deliveredAt: null,
    closedAt: null,
    agentUserId: "u-1",
    assignedTeamId: "t-1",
    ...overrides,
  };
}

const lima = (iso: string) => new Date(`${iso}-05:00`);

describe("Entregadas por operación (BR-001)", () => {
  it("separa portabilidades y altas nuevas entregadas; lo no entregado no cuenta", () => {
    const metrics = calculatePerformanceMetrics([
      order({
        registeredAt: lima("2026-09-02T10:00:00"),
        deliveryStatus: "DELIVERED",
        deliveredAt: lima("2026-09-03T12:00:00"),
      }),
      order({
        registeredAt: lima("2026-09-02T11:00:00"),
        commercialOperation: "NEW_LINE",
        deliveryStatus: "DELIVERED",
        deliveredAt: lima("2026-09-04T12:00:00"),
      }),
      order({
        registeredAt: lima("2026-09-02T12:00:00"),
        commercialOperation: "PORT_PREPAID",
      }),
      order({
        registeredAt: lima("2026-09-02T13:00:00"),
        // Entregada sin fecha no es entregada: la misma regla de siempre.
        deliveryStatus: "DELIVERED",
      }),
    ]);

    expect(metrics.entered).toBe(4);
    expect(metrics.delivered).toBe(2);
    expect(metrics.deliveredPortability).toBe(1);
    expect(metrics.deliveredNewLines).toBe(1);
  });
});

describe("Maduración equivalente y cruce de meses (BR-003, BR-006)", () => {
  // Registrada el último día de agosto y entregada el 2 de setiembre.
  const crossMonth = order({
    registeredAt: lima("2026-08-31T18:00:00"),
    deliveryStatus: "DELIVERED",
    deliveredAt: lima("2026-09-02T09:00:00"),
  });
  const early = order({
    registeredAt: lima("2026-08-03T09:00:00"),
    deliveryStatus: "DELIVERED",
    deliveredAt: lima("2026-08-04T09:00:00"),
  });
  const late = order({
    registeredAt: lima("2026-08-05T09:00:00"),
    deliveryStatus: "DELIVERED",
    deliveredAt: lima("2026-08-20T09:00:00"),
  });
  const august = [early, late, crossMonth];

  it("una venta ingresada en agosto y entregada en setiembre es entregada de la cohorte de agosto", () => {
    expect(calculatePerformanceMetrics(august).delivered).toBe(3);
    // Y no pertenece a la cohorte de setiembre.
    expect(
      filterOrdersRegisteredThroughLimaDay(august, 31).map(
        (item) => item.registeredAt,
      ),
    ).toHaveLength(3);
  });

  it("hasta el día 6 del mes pasado solo cuenta lo entregado antes del corte", () => {
    const cohortThroughDay6 = filterOrdersRegisteredThroughLimaDay(august, 6);
    const cutoff = lima("2026-08-07T00:00:00");

    expect(cohortThroughDay6).toHaveLength(2);
    expect(countOrdersDeliveredBefore(cohortThroughDay6, cutoff)).toBe(1);
    // A hoy, esa misma cohorte terminó con dos entregadas: la maduración.
    expect(calculatePerformanceMetrics(cohortThroughDay6).delivered).toBe(2);
  });
});

function advisor(
  name: string,
  overrides: {
    delivered?: number;
    payable?: number;
    entered?: number;
    active?: boolean;
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
  return {
    name,
    dailyEntered: [],
    isActiveSeller: overrides.active ?? true,
    openRecoveryCases: 0,
    quota: null,
    metrics: {
      entered: overrides.entered ?? 0,
      delivered: overrides.delivered ?? 0,
      payable: overrides.payable ?? 0,
      deliveredPendingActivation: 0,
      recovery: 0,
    } as PerformanceBreakdownItem["metrics"],
  };
}

describe("Orden y filtro por entregadas (BR-004, BR-005)", () => {
  it("el orden por defecto es «más entregadas», luego pagables, luego nombre", () => {
    expect(defaultBreakdownSort).toBe("ENTREGADAS");
    expect(parseBreakdownSort(undefined)).toBe("ENTREGADAS");
    const rows = [
      advisor("B", { delivered: 4, payable: 1 }),
      advisor("A", { delivered: 4, payable: 1 }),
      advisor("C", { delivered: 6, payable: 0 }),
      advisor("D", { delivered: 4, payable: 3 }),
    ];
    expect(sortBreakdown(rows, "ENTREGADAS").map((r) => r.name)).toEqual([
      "C",
      "D",
      "A",
      "B",
    ]);
  });

  it("«sin entregas en el mes» es un vendedor activo con cero entregadas, venda o no", () => {
    const rows = [
      advisor("Vende sin entregar", { entered: 5, delivered: 0 }),
      advisor("Sin ventas", { entered: 0, delivered: 0 }),
      advisor("Entrega", { entered: 5, delivered: 2 }),
      advisor("Histórico", { entered: 0, delivered: 0, active: false }),
    ];
    expect(filterBreakdown(rows, "SIN_ENTREGAS").map((r) => r.name)).toEqual([
      "Vende sin entregar",
      "Sin ventas",
    ]);
    expect(getManagementFilterOption("SIN_ENTREGAS").definition).toMatch(
      /cero ventas entregadas/,
    );
  });

  it("el orden por entregadas no viaja en la URL; pagables sí, porque dejó de ser el defecto", () => {
    const alcance = {
      month: "2026-09",
      view: "TEAM" as const,
      canSwitchView: false,
      teamFilter: "ALL",
      agentFilter: "ALL",
      from: "2026-09-01",
      to: "2026-09-30",
    };
    expect(performanceHref({ ...alcance, sort: "ENTREGADAS" })).toBe(
      "/performance?month=2026-09",
    );
    expect(performanceHref({ ...alcance, sort: "PAGABLES" })).toBe(
      "/performance?month=2026-09&orden=PAGABLES",
    );
  });
});
