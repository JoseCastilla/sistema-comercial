import { describe, expect, it } from "vitest";

import { buildDeliveryTrend } from "@/features/performance/delivery-trend";
import {
  buildPriorityNotices,
  quotaSourceLabel,
} from "@/features/performance/priority-notices";

import type { PerformanceDashboardData } from "@/features/performance/performance.types";

const lima = (iso: string) => new Date(`${iso}-05:00`);

/**
 * SPEC-047 fase 2: la tendencia de entregas agrupa por día de entrega
 * registrada dentro del mes, de cualquier mes de venta; los avisos aparecen
 * solo con valor y en orden fijo.
 */
describe("Tendencia de entregas (BR-009)", () => {
  const start = lima("2026-09-01T00:00:00");
  const end = lima("2026-10-01T00:00:00");
  const now = lima("2026-09-06T15:00:00");

  it("cuenta por día de entrega registrada y separa las ventas de meses anteriores", () => {
    const trend = buildDeliveryTrend(
      [
        // Ingresada el 31/08, entregada el 02/09: cuenta aquí, en el día 2.
        {
          deliveryStatus: "DELIVERED",
          registeredAt: lima("2026-08-31T18:00:00"),
          deliveredAt: lima("2026-09-02T09:00:00"),
        },
        {
          deliveryStatus: "DELIVERED",
          registeredAt: lima("2026-09-01T10:00:00"),
          deliveredAt: lima("2026-09-02T16:00:00"),
        },
        {
          deliveryStatus: "DELIVERED",
          registeredAt: lima("2026-09-03T10:00:00"),
          deliveredAt: lima("2026-09-04T11:00:00"),
        },
        // Entregada en agosto: no pertenece a la actividad de setiembre.
        {
          deliveryStatus: "DELIVERED",
          registeredAt: lima("2026-08-20T10:00:00"),
          deliveredAt: lima("2026-08-21T11:00:00"),
        },
        // Sin fecha: no es una entrega.
        {
          deliveryStatus: "DELIVERED",
          registeredAt: lima("2026-09-03T10:00:00"),
          deliveredAt: null,
        },
      ],
      start,
      end,
      now,
    );

    expect(trend.total).toBe(3);
    expect(trend.fromEarlierMonths).toBe(1);
    expect(trend.days[1]).toMatchObject({
      day: 2,
      delivered: 2,
      cumulative: 2,
      fromEarlierMonths: 1,
    });
    expect(trend.days[3]).toMatchObject({
      day: 4,
      delivered: 1,
      cumulative: 3,
    });
    expect(trend.days[5]?.isToday).toBe(true);
    expect(trend.days[6]?.isFuture).toBe(true);
    expect(trend.elapsedDays).toBe(6);
    expect(trend.productiveDays).toBe(2);
    expect(trend.bestDay?.day).toBe(2);
    expect(trend.averagePerElapsedDay).toBeCloseTo(0.5);
  });
});

function scope(
  overrides: Partial<PerformanceDashboardData> = {},
): PerformanceDashboardData {
  return {
    role: "ADMIN",
    view: "TEAM",
    month: "2026-09",
    monthLabel: "setiembre de 2026",
    canSwitchView: false,
    teamFilter: "ALL",
    agentFilter: "ALL",
    from: "2026-09-01",
    to: "2026-09-30",
    scopeLabel: "Organización",
    teams: [],
    advisorOutsideTeam: false,
    workforce: null,
    metrics: { unassigned: 0, deliveredPendingActivation: 0 },
    pendingBeforeMonth: null,
    ...overrides,
  } as unknown as PerformanceDashboardData;
}

describe("Avisos prioritarios (BR-011)", () => {
  it("sin nada que avisar, no hay avisos", () => {
    expect(buildPriorityNotices(scope())).toEqual([]);
  });

  it("aparecen en orden fijo, solo con valor, y cada uno abre su conjunto", () => {
    const notices = buildPriorityNotices(
      scope({
        teams: [
          { kind: "TEAM", supervisorName: null },
          { kind: "TEAM", supervisorName: "Erika Lavado" },
          { kind: "UNASSIGNED", supervisorName: null },
        ] as PerformanceDashboardData["teams"],
        workforce: {
          activeSellers: 13,
          sellersWithSales: 10,
          sellersWithoutSales: 3,
          averageEnteredPerSeller: 2,
        },
        metrics: {
          unassigned: 2,
          deliveredPendingActivation: 29,
        } as PerformanceDashboardData["metrics"],
        pendingBeforeMonth: {
          count: 5,
          monthLabel: "setiembre de 2026",
          from: "2026-08-01",
          to: "2026-08-31",
        },
      }),
    );

    expect(notices.map((notice) => notice.key)).toEqual([
      "TEAMS_WITHOUT_SUPERVISOR",
      "SELLERS_WITHOUT_SALES",
      "UNASSIGNED_ORDERS",
      "AWAITING_ACTIVATION",
      "EARLIER_PENDING",
    ]);
    expect(notices[0]).toMatchObject({
      count: 1,
      href: "/admin/teams?sinSupervisor=1",
    });
    expect(notices[1]?.href).toBe(
      "/performance?month=2026-09&gestion=SIN_PRODUCCION",
    );
    expect(notices[2]?.href).toContain("team=UNASSIGNED");
    expect(notices[3]?.href).toContain("status=AWAITING_ACTIVATION");
    expect(notices[4]?.href).toContain("from=2026-08-01&to=2026-08-31");
  });

  it("un supervisor ve el equipo sin supervisor pero sin enlace a administración; en la vista personal no hay «sin asesor»", () => {
    const notices = buildPriorityNotices(
      scope({
        role: "SUPERVISOR",
        view: "SELF",
        teams: [
          { kind: "TEAM", supervisorName: null },
        ] as PerformanceDashboardData["teams"],
        metrics: {
          unassigned: 4,
          deliveredPendingActivation: 0,
        } as PerformanceDashboardData["metrics"],
      }),
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      key: "TEAMS_WITHOUT_SUPERVISOR",
      href: null,
    });
  });

  it("el origen de la cuota se dice con palabras", () => {
    expect(quotaSourceLabel("ASSIGNED")).toBe("cuota asignada");
    expect(quotaSourceLabel("DEFAULT")).toBe("cuota por defecto");
    expect(quotaSourceLabel("MIXED")).toMatch(/asignadas y por defecto/);
  });
});
