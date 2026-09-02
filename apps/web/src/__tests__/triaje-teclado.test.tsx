import { act, createEvent, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  RecoveryTriageForm,
  type RecoveryTriageRow,
} from "@/features/recovery/components/recovery-triage-form";

// La acción del servidor arrastra la sesión y la base de datos; aquí solo se
// ejercita la selección, que ocurre entera en el cliente.
vi.mock("@/features/recovery/server/mark-recovery-triage-action", () => ({
  markRecoveryTriageAction: async () => ({ type: "idle", message: "" }),
}));

function buildRows(count: number): RecoveryTriageRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `caso-${index}`,
    holderName: `Cliente ${index}`,
    documentNumber: `1000000${index}`,
    status: "TRIAGE" as const,
    serviceNumbers: [`93000000${index}`],
    planSummary: "Máximo S/39.9",
    carrierSummary: "BITEL",
    teamName: null,
    lastSightingLabel: "01/09/26, 10:00",
    sightingCount: 1,
  }));
}

function renderTriage(count = 4) {
  const view = render(
    <RecoveryTriageForm canAssignTeams={false} rows={buildRows(count)} teams={[]} />,
  );
  const rows = [
    ...view.container.querySelectorAll<HTMLTableRowElement>("tbody tr"),
  ];

  return {
    rows,
    selectedIndexes: () =>
      rows
        .map((row, index) =>
          row.getAttribute("aria-selected") === "true" ? index : null,
        )
        .filter((index): index is number => index !== null),
  };
}

/**
 * El triage se trabaja en tandas de decenas de casos. Antes solo se podía
 * marcar con el ratón: la fila no era enfocable y su casilla estaba fuera del
 * orden de tabulación, así que con el teclado no había forma de seleccionar.
 */
describe("Triage · selección con teclado", () => {
  it("solo una fila entra en el orden de tabulación", () => {
    const { rows } = renderTriage();

    expect(rows.map((row) => row.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it("Espacio marca la fila enfocada", () => {
    const { rows, selectedIndexes } = renderTriage();

    fireEvent.keyDown(rows[2]!, { key: " " });

    expect(selectedIndexes()).toEqual([2]);
  });

  it("Espacio no desplaza la página", () => {
    const { rows } = renderTriage();
    const event = createEvent.keyDown(rows[0]!, { key: " " });

    fireEvent(rows[0]!, event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("Shift + Espacio extiende el rango, igual que Shift + clic", () => {
    const { rows, selectedIndexes } = renderTriage();

    fireEvent.keyDown(rows[0]!, { key: " " });
    fireEvent.keyDown(rows[3]!, { key: " ", shiftKey: true });

    expect(selectedIndexes()).toEqual([0, 1, 2, 3]);
  });

  it("Espacio sobre una fila marcada la desmarca", () => {
    const { rows, selectedIndexes } = renderTriage();

    fireEvent.keyDown(rows[1]!, { key: " " });
    fireEvent.keyDown(rows[1]!, { key: " " });

    expect(selectedIndexes()).toEqual([]);
  });

  it("las flechas mueven el foco entre filas sin marcar nada", () => {
    const { rows, selectedIndexes } = renderTriage();

    act(() => rows[1]!.focus());
    fireEvent.keyDown(rows[1]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[2]);

    fireEvent.keyDown(rows[2]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows[1]);

    expect(selectedIndexes()).toEqual([]);
  });

  it("la flecha no salta fuera de la tabla en los extremos", () => {
    const { rows } = renderTriage();

    act(() => rows[0]!.focus());
    fireEvent.keyDown(rows[0]!, { key: "ArrowUp" });

    expect(document.activeElement).toBe(rows[0]);
  });

  it("el clic conserva la misma semántica que el teclado", () => {
    const { rows, selectedIndexes } = renderTriage();

    fireEvent.click(rows[1]!);
    fireEvent.click(rows[3]!, { shiftKey: true });

    expect(selectedIndexes()).toEqual([1, 2, 3]);
  });
});
