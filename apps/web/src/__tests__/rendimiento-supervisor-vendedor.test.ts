import { describe, expect, it } from "vitest";

import {
  earlierPendingHref,
  ordersHref,
  reconciliationHref,
  recoveryCasesHref,
} from "@/features/performance/performance-links";

const supervisorQueVende = {
  month: "2026-09",
  view: "SELF" as const,
  canSwitchView: true,
  teamFilter: "ALL",
  agentFilter: "ALL",
  from: "2026-09-01",
  to: "2026-09-30",
  selfAdvisorId: "u-super",
};

const asesor = {
  ...supervisorQueVende,
  canSwitchView: false,
  selfAdvisorId: null,
};

/**
 * SPEC-044 SV-01: en «Mi rendimiento» de un supervisor que vende, cada
 * enlace pide «solo lo mío», porque Pedidos, Recupero y la conciliación le
 * abrirían sus equipos. Un asesor no lo necesita: ya es su alcance.
 */
describe("Enlaces de la vista personal del supervisor que vende", () => {
  it("Pedidos, anteriores y Recupero llevan su propio id", () => {
    expect(
      new URL(
        ordersHref(supervisorQueVende, "RECOVERY"),
        "http://x",
      ).searchParams.get("advisor"),
    ).toBe("u-super");
    expect(
      new URL(
        earlierPendingHref(supervisorQueVende, {
          from: "2026-08-01",
          to: "2026-08-31",
        }),
        "http://x",
      ).searchParams.get("advisor"),
    ).toBe("u-super");
    expect(recoveryCasesHref(supervisorQueVende)).toBe(
      "/recovery/sales?advisor=u-super",
    );
  });

  it("la conciliación se abre filtrada por él, no por sus equipos", () => {
    expect(reconciliationHref(supervisorQueVende, "ALL")).toBe(
      "/performance/reconciliation?month=2026-09&reason=ALL&agent=u-super",
    );
  });

  it("un asesor sigue sin asesor ni equipo en sus enlaces", () => {
    expect(
      new URL(ordersHref(asesor, "RECOVERY"), "http://x").searchParams.get(
        "advisor",
      ),
    ).toBeNull();
    expect(recoveryCasesHref(asesor)).toBe("/recovery/sales");
    expect(reconciliationHref(asesor, "ALL")).toBe(
      "/performance/reconciliation?month=2026-09&reason=ALL",
    );
  });
});
