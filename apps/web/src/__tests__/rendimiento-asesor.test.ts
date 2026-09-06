import { describe, expect, it } from "vitest";

import { getPerformanceCommissionPolicy } from "@repo/validation";

import {
  describeAcceleratorWindows,
  describePendingAdvice,
  isOutsideAcceleratorWindows,
} from "@/features/performance/accelerator-windows";
import { earlierPendingHref } from "@/features/performance/performance-links";

const windows = getPerformanceCommissionPolicy().acceleratorWindows;

/**
 * SPEC-044 fase 5 (asesor): las ventanas se presentan según el día, el
 * consejo nace de los pendientes reales y lo de meses anteriores abre
 * exactamente lo que cuenta.
 */
describe("Ventanas del acelerador según el día (ASE-02)", () => {
  it("el día 5 la primera está en curso y la segunda por comenzar el 25", () => {
    const view = describeAcceleratorWindows(windows, 5, 30);
    expect(view.map((w) => [w.key, w.state, w.startDay, w.endDay])).toEqual([
      ["ONE", "ACTIVE", 1, 15],
      ["TWO", "UPCOMING", 25, 30],
    ]);
    expect(isOutsideAcceleratorWindows(view, 5)).toBe(false);
  });

  it("del 16 al 24 no hay tramo: la primera cerró y la segunda no empezó", () => {
    const view = describeAcceleratorWindows(windows, 20, 31);
    expect(view.map((w) => w.state)).toEqual(["CLOSED", "UPCOMING"]);
    expect(isOutsideAcceleratorWindows(view, 20)).toBe(true);
    expect(isOutsideAcceleratorWindows(view, 25)).toBe(false);
  });

  it("en un mes cerrado todas las ventanas están cerradas y no hay «hoy»", () => {
    const view = describeAcceleratorWindows(windows, null, 31);
    expect(view.map((w) => w.state)).toEqual(["CLOSED", "CLOSED"]);
    expect(isOutsideAcceleratorWindows(view, null)).toBe(false);
  });
});

describe("Consejo según pendientes reales (ASE-03)", () => {
  it("con cero por activar no pide activar; con pedidos por recuperar ofrece revisarlos sin prometer", () => {
    const advice = describePendingAdvice({
      enteredToday: 4,
      deliveredPendingActivation: 0,
      recovery: 3,
      openRecoveryCases: 0,
    });
    expect(advice).toBe(
      "3 pedidos del mes no se entregaron o se cancelaron: revísalos por si alguno se puede reingresar.",
    );
    expect(advice).not.toMatch(/activ/);
  });

  it("sin pendientes lo dice, y distingue si hoy hubo ventas", () => {
    expect(
      describePendingAdvice({
        enteredToday: 0,
        deliveredPendingActivation: 0,
        recovery: 0,
        openRecoveryCases: 0,
      }),
    ).toBe("Aún no registras ventas hoy y no tienes pendientes del mes.");
    expect(
      describePendingAdvice({
        enteredToday: 2,
        deliveredPendingActivation: 1,
        recovery: 0,
        openRecoveryCases: 2,
      }),
    ).toBe(
      "1 venta entregada espera activarse: todavía no pagan. 2 casos abiertos en Recupero de ventas con cadencia por cumplir.",
    );
  });
});

describe("Pendientes de meses anteriores (ASE-04)", () => {
  it("abre Pedidos con el rango exacto, el filtro de activos y el alcance del tablero", () => {
    const href = earlierPendingHref(
      {
        month: "2026-09",
        view: "TEAM",
        canSwitchView: false,
        teamFilter: "t-1",
        agentFilter: "u-ana",
        from: "2026-09-01",
        to: "2026-09-30",
      },
      { from: "2026-03-12", to: "2026-08-31" },
    );
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/orders");
    expect(url.searchParams.get("period")).toBe("RANGE");
    expect(url.searchParams.get("from")).toBe("2026-03-12");
    expect(url.searchParams.get("to")).toBe("2026-08-31");
    expect(url.searchParams.get("status")).toBe("ACTIVE");
    expect(url.searchParams.get("team")).toBe("t-1");
    expect(url.searchParams.get("advisor")).toBe("u-ana");
    expect(url.searchParams.get("volver")).toBe(
      "/performance?month=2026-09&team=t-1&agent=u-ana",
    );
  });

  it("en la vista personal no viaja asesor ni equipo: el alcance ya es el propio", () => {
    const url = new URL(
      earlierPendingHref(
        {
          month: "2026-09",
          view: "SELF",
          canSwitchView: false,
          teamFilter: "ALL",
          agentFilter: "ALL",
          from: "2026-09-01",
          to: "2026-09-30",
        },
        { from: "2026-05-01", to: "2026-08-31" },
      ),
      "http://x",
    );
    expect(url.searchParams.get("advisor")).toBeNull();
    expect(url.searchParams.get("team")).toBeNull();
  });
});
