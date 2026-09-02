import { act, createEvent, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RecoveryTriageForm,
  type RecoveryTriageRow,
} from "@/features/recovery/components/recovery-triage-form";

// La acción del servidor arrastra la sesión y la base de datos; aquí solo se
// ejercita la selección, que ocurre entera en el cliente.
vi.mock("@/features/recovery/server/mark-recovery-triage-action", () => ({
  markRecoveryTriageAction: async () => ({ type: "idle", message: "" }),
}));

const writeText = vi.fn(async () => undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

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
    <RecoveryTriageForm
      canAssignTeams={false}
      rows={buildRows(count)}
      teams={[]}
    />,
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
    focusedIndexes: () =>
      rows
        .map((row, index) =>
          row.getAttribute("data-focused") === "true" ? index : null,
        )
        .filter((index): index is number => index !== null),
    valuesOf: (index: number) => [
      ...rows[index]!.querySelectorAll<HTMLButtonElement>("button"),
    ],
  };
}

/**
 * El triage se trabaja en tandas de decenas de casos y con una consulta
 * externa abierta al lado. El teclado reparte como la hoja de cálculo:
 * Espacio actúa sobre el dato bajo el cursor, Shift + Espacio sobre el
 * cliente entero.
 */
describe("Triage · cursor de teclado", () => {
  it("solo una fila entra en el orden de tabulación", () => {
    const { rows } = renderTriage();

    expect(rows.map((row) => row.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it("no dibuja cursor mientras el teclado está fuera de la tabla", () => {
    const { focusedIndexes } = renderTriage();

    expect(focusedIndexes()).toEqual([]);
  });

  it("marca la fila donde está el cursor y lo sigue con las flechas", () => {
    const { rows, focusedIndexes } = renderTriage();

    act(() => rows[0]!.focus());
    expect(focusedIndexes()).toEqual([0]);

    fireEvent.keyDown(rows[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
    expect(focusedIndexes()).toEqual([1]);

    fireEvent.keyDown(rows[1]!, { key: "ArrowUp" });
    expect(focusedIndexes()).toEqual([0]);
  });

  it("mantiene el cursor mientras se elige un dato dentro de la fila", () => {
    const { rows, valuesOf, focusedIndexes } = renderTriage();

    act(() => rows[1]!.focus());
    act(() => valuesOf(1)[0]!.focus());

    expect(focusedIndexes()).toEqual([1]);
  });

  it("retira el cursor al salir de la tabla", () => {
    const { rows, focusedIndexes } = renderTriage();

    act(() => rows[0]!.focus());
    fireEvent.blur(rows[0]!, { relatedTarget: document.body });

    expect(focusedIndexes()).toEqual([]);
  });

  it("la flecha no salta fuera de la tabla en los extremos", () => {
    const { rows } = renderTriage();

    act(() => rows[0]!.focus());
    fireEvent.keyDown(rows[0]!, { key: "ArrowUp" });

    expect(document.activeElement).toBe(rows[0]);
  });
});

describe("Triage · Espacio copia el dato", () => {
  it("sobre la fila copia el DNI, que es el primer dato", async () => {
    const { rows } = renderTriage();

    act(() => rows[2]!.focus());
    // El acuse «copiado» llega cuando el portapapeles resuelve, ya fuera del
    // evento: sin esperarlo, la aserción mira una pantalla a medio pintar.
    await act(async () => {
      fireEvent.keyDown(rows[2]!, { key: " " });
    });

    expect(writeText).toHaveBeenCalledWith("10000002");
  });

  it("las flechas laterales eligen entre DNI y línea", () => {
    const { rows, valuesOf } = renderTriage();

    act(() => rows[1]!.focus());

    // La tecla se dispara siempre sobre lo que tiene el cursor y burbujea
    // hasta la fila; enviarla a la fila fija fingiría un cursor que no se
    // movió.
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(valuesOf(1)[0]);

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(valuesOf(1)[1]);

    // El último dato no lleva al cliente siguiente: se queda donde está.
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(valuesOf(1)[1]);
  });

  it("sobre un dato no interfiere: copia el propio botón", () => {
    const { valuesOf } = renderTriage();
    const linea = valuesOf(0)[1]!;

    act(() => linea.focus());
    const event = createEvent.keyDown(linea, { key: " " });
    fireEvent(linea, event);

    // El botón nativo copia al soltar la tecla; el manejador de la fila no
    // debe adelantarse ni cancelarlo.
    expect(event.defaultPrevented).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("la flecha izquierda vuelve del primer dato a la fila", () => {
    const { rows, valuesOf } = renderTriage();
    const dni = valuesOf(3)[0]!;

    act(() => dni.focus());
    fireEvent.keyDown(dni, { key: "ArrowLeft" });

    expect(document.activeElement).toBe(rows[3]);
  });

  it("copiar no marca al cliente", async () => {
    const { rows, selectedIndexes } = renderTriage();

    act(() => rows[2]!.focus());
    await act(async () => {
      fireEvent.keyDown(rows[2]!, { key: " " });
    });

    expect(selectedIndexes()).toEqual([]);
  });
});

describe("Triage · Shift + Espacio marca al cliente", () => {
  it("marca la fila del cursor", () => {
    const { rows, selectedIndexes } = renderTriage();

    fireEvent.keyDown(rows[2]!, { key: " ", shiftKey: true });

    expect(selectedIndexes()).toEqual([2]);
  });

  it("vuelve a pulsarse para desmarcar", () => {
    const { rows, selectedIndexes } = renderTriage();

    fireEvent.keyDown(rows[1]!, { key: " ", shiftKey: true });
    fireEvent.keyDown(rows[1]!, { key: " ", shiftKey: true });

    expect(selectedIndexes()).toEqual([]);
  });

  it("marca una sola fila, no un rango: para eso está Shift + clic", () => {
    const { rows, selectedIndexes } = renderTriage();

    fireEvent.keyDown(rows[0]!, { key: " ", shiftKey: true });
    fireEvent.keyDown(rows[3]!, { key: " ", shiftKey: true });

    expect(selectedIndexes()).toEqual([0, 3]);
  });

  it("funciona con el cursor sobre un dato, no solo sobre la fila", () => {
    const { valuesOf, selectedIndexes } = renderTriage();
    const linea = valuesOf(1)[1]!;

    act(() => linea.focus());
    fireEvent.keyDown(linea, { key: " ", shiftKey: true });

    expect(selectedIndexes()).toEqual([1]);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("no desplaza la página", () => {
    const { rows } = renderTriage();
    const event = createEvent.keyDown(rows[0]!, { key: " ", shiftKey: true });

    fireEvent(rows[0]!, event);

    expect(event.defaultPrevented).toBe(true);
  });
});

describe("Triage · el ratón conserva su semántica", () => {
  it("el clic marca y Shift + clic extiende el rango", () => {
    const { rows, selectedIndexes } = renderTriage();

    fireEvent.click(rows[1]!);
    fireEvent.click(rows[3]!, { shiftKey: true });

    expect(selectedIndexes()).toEqual([1, 2, 3]);
  });
});
