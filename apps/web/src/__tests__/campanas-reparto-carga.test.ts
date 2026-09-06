import { describe, expect, it } from "vitest";

import { describeAdminPending } from "@/features/performance/admin-pending";
import {
  previewDirectLoad,
  previewEquitableLoad,
} from "@/features/recovery/distribution-preview";

const participante = (
  id: string,
  openCases: number,
  unworkedCases = 0,
  overdueCases = 0,
) => ({ id, name: id, openCases, unworkedCases, overdueCases });

/**
 * SPEC-045 PL-04: la vista previa del reparto usa la misma regla que el
 * servidor y solo informa.
 */
describe("Vista previa de carga del reparto", () => {
  it("reparte parejo y el residuo va a quien menos abiertos tiene", () => {
    const rows = previewEquitableLoad(7, [
      participante("ana", 10),
      participante("luis", 2),
      participante("eva", 5),
    ]);
    const porId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(porId.luis?.receives).toBe(3);
    expect(porId.eva?.receives).toBe(2);
    expect(porId.ana?.receives).toBe(2);
    expect(porId.luis?.resulting).toBe(5);
    expect(rows.reduce((sum, r) => sum + r.receives, 0)).toBe(7);
  });

  it("sin participantes no hay reparto; con cero seleccionados nadie recibe", () => {
    expect(previewEquitableLoad(5, [])).toEqual([]);
    expect(previewEquitableLoad(0, [participante("ana", 3)])[0]?.receives).toBe(
      0,
    );
  });

  it("la asignación directa carga todo a una sola persona", () => {
    const row = previewDirectLoad(4, participante("ana", 6, 2, 1));
    expect(row.receives).toBe(4);
    expect(row.resulting).toBe(10);
    expect(row.unworkedCases).toBe(2);
  });
});

/**
 * SPEC-045 PL-01: cada pendiente lleva definición, alcance, cantidad, quién
 * y destino; los bloques no se suman.
 */
describe("Resumen administrativo de pendientes", () => {
  const conteos = {
    overdueInternalCases: 70,
    criticalUnassignedCases: 2,
    campaignUnverified: 396,
    campaignVerified: 270,
    campaignOpen: 186,
    campaignAssignedUnworked: 305,
    campaignOverdue: 40,
    teamsWithoutSupervisor: 2,
    activeAgentsWithoutTeam: 1,
    openEscalations: 0,
    logisticsPending: 347,
  };

  it("cada pendiente tiene definición, responsable y un destino propio", () => {
    const groups = describeAdminPending(conteos);
    const items = groups.flatMap((g) => g.items);
    for (const item of items) {
      expect(item.definition.length).toBeGreaterThan(10);
      expect(item.responsible.length).toBeGreaterThan(3);
      expect(item.href.startsWith("/")).toBe(true);
    }
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
    expect(groups.map((g) => g.key)).toEqual([
      "recupero",
      "campanas",
      "personas",
      "logistica",
    ]);
  });

  it("sin integración logística el bloque no aparece; ningún bloque suma", () => {
    const groups = describeAdminPending({ ...conteos, logisticsPending: null });
    expect(groups.map((g) => g.key)).not.toContain("logistica");
    for (const group of groups) {
      expect(group.scope.length).toBeGreaterThan(3);
      expect("total" in group).toBe(false);
    }
  });
});
