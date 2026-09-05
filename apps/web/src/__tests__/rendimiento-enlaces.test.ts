import { describe, expect, it } from "vitest";

import {
  advisorHref,
  ordersHref,
  performanceHref,
  recoveryCasesHref,
} from "@/features/performance/performance-links";

const alcance = {
  month: "2026-09",
  view: "TEAM" as const,
  canSwitchView: false,
  teamFilter: "t-lima",
  agentFilter: "u-ana",
  from: "2026-09-01",
  to: "2026-09-30",
};

/**
 * SPEC-044 REN-01/REN-03: cada cifra abre el conjunto que cuenta, con el
 * mismo asesor y equipo, y con camino de vuelta a Rendimiento.
 */
describe("Enlaces del tablero de Rendimiento", () => {
  it("las órdenes llevan cohorte, equipo, asesor y camino de vuelta", () => {
    const href = ordersHref(alcance, "AWAITING_ACTIVATION");
    const url = new URL(href, "http://x");

    expect(url.pathname).toBe("/orders");
    expect(url.searchParams.get("period")).toBe("RANGE");
    expect(url.searchParams.get("from")).toBe("2026-09-01");
    expect(url.searchParams.get("to")).toBe("2026-09-30");
    expect(url.searchParams.get("status")).toBe("AWAITING_ACTIVATION");
    expect(url.searchParams.get("team")).toBe("t-lima");
    expect(url.searchParams.get("advisor")).toBe("u-ana");
    expect(url.searchParams.get("volver")).toBe(
      "/performance?month=2026-09&team=t-lima&agent=u-ana",
    );
  });

  it("una fila puede pedir su propio asesor; sin asignar no lleva asesor", () => {
    const fila = new URL(
      ordersHref({ ...alcance, agentFilter: "ALL" }, "RECOVERY", {
        advisor: "u-luis",
      }),
      "http://x",
    );
    expect(fila.searchParams.get("advisor")).toBe("u-luis");

    const sinAsignar = new URL(
      ordersHref(alcance, "ALL", { team: "UNASSIGNED" }),
      "http://x",
    );
    expect(sinAsignar.searchParams.get("team")).toBe("UNASSIGNED");
    expect(sinAsignar.searchParams.get("advisor")).toBeNull();
  });

  it("en la vista personal no viajan equipo ni asesor: el alcance ya es el propio", () => {
    const url = new URL(
      ordersHref({ ...alcance, view: "SELF", canSwitchView: true }, "RECOVERY"),
      "http://x",
    );

    expect(url.searchParams.get("team")).toBeNull();
    expect(url.searchParams.get("advisor")).toBeNull();
    expect(url.searchParams.get("volver")).toBe(
      "/performance?month=2026-09&view=SELF&team=t-lima&agent=u-ana",
    );
  });

  it("los casos de recupero abren la bandeja del responsable, o del equipo", () => {
    expect(recoveryCasesHref(alcance)).toBe("/recovery/sales?advisor=u-ana");
    expect(recoveryCasesHref({ ...alcance, agentFilter: "ALL" })).toBe(
      "/recovery/sales?team=t-lima",
    );
    expect(recoveryCasesHref(alcance, "u-luis")).toBe(
      "/recovery/sales?advisor=u-luis",
    );
    expect(recoveryCasesHref({ ...alcance, view: "SELF" })).toBe(
      "/recovery/sales",
    );
  });

  it("el nombre del asesor filtra por él y, si ya lo está, vuelve al conjunto", () => {
    expect(advisorHref({ ...alcance, agentFilter: "ALL" }, "u-ana")).toBe(
      "/performance?month=2026-09&team=t-lima&agent=u-ana",
    );
    expect(advisorHref(alcance, "u-ana")).toBe(
      "/performance?month=2026-09&team=t-lima",
    );
    expect(performanceHref(alcance, "2026-08")).toBe(
      "/performance?month=2026-08&team=t-lima&agent=u-ana",
    );
  });
});
