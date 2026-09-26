import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DistributeRecoveryForm } from "@/features/recovery/components/distribute-recovery-form";

import type {
  DistributeAdvisorOption,
  DistributeRecoveryRow,
} from "@/features/recovery/components/distribute-recovery-form";

/**
 * SPEC-071: marcar casos, elegir una forma de repartir a la vez y ver a todo
 * el ancho cuánto recibiría cada uno.
 */
vi.mock("@/features/recovery/server/distribute-recovery-cases-action", () => ({
  distributeRecoveryCasesAction: vi.fn(async () => ({
    type: "idle",
    message: "",
  })),
}));

function fila(id: string, extra: Partial<DistributeRecoveryRow> = {}): DistributeRecoveryRow {
  return {
    id,
    holderName: `CLIENTE ${id}`,
    documentNumber: "40000000",
    department: "JUNIN",
    planSummary: "Máximo S/39.9",
    serviceCount: 1,
    teamName: "HUANCAYO",
    assignedToName: null,
    habilitationOverdue: false,
    unverified: false,
    lastSightingLabel: "24/09 10:00",
    ...extra,
  };
}

const asesores: DistributeAdvisorOption[] = [
  {
    id: "u-1",
    name: "Silvia",
    teamId: "t-1",
    teamName: "HUANCAYO",
    openCases: 57,
    unworkedCases: 0,
    overdueCases: 57,
  },
  {
    id: "u-2",
    name: "Steven",
    teamId: "t-1",
    teamName: "HUANCAYO",
    openCases: 63,
    unworkedCases: 0,
    overdueCases: 59,
  },
];

function renderForm() {
  return render(
    <DistributeRecoveryForm
      advisors={asesores}
      rows={[fila("a"), fila("b", { habilitationOverdue: true }), fila("c")]}
      teams={[{ id: "t-1", name: "HUANCAYO" }]}
      viewerRole="SUPERVISOR"
      viewerUserId="u-sup"
    />,
  );
}

describe("Repartir la base", () => {
  it("cada caso es una fila compacta con lo que importa para repartir", () => {
    renderForm();

    expect(screen.getByText("CLIENTE b")).toBeInTheDocument();
    expect(screen.getByText("Ya puede portar")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "JUNIN · Máximo S/39.9 · HUANCAYO · en la base el 24/09 10:00",
      ),
    ).toHaveLength(3);
  });

  it("marcar los primeros N y el botón dice cuántos reparte", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Cuántos marcar"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));

    expect(screen.getByText("2 de 3 marcados")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Repartir 2 casos" }),
    ).toBeEnabled();
  });

  it("el reparto parejo muestra a todo el ancho cuánto recibiría cada uno", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Marcar todos" }));

    const panel = screen.getByRole("region", { name: "A quién van" });
    expect(within(panel).getByText(/Tiene 57 abiertos/)).toBeInTheDocument();
    expect(within(panel).getAllByText(/Recibiría/)).toHaveLength(2);

    fireEvent.click(within(panel).getByRole("checkbox", { name: /Steven/ }));
    expect(within(panel).getByText("No participa hoy")).toBeInTheDocument();
  });

  it("una forma a la vez: al elegir «A un asesor» aparece su selector", () => {
    renderForm();

    expect(screen.queryByRole("combobox", { name: "Asesor destino" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "A un asesor" }));
    expect(
      screen.getByRole("combobox", { name: "Asesor destino" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Equipo para el reparto equitativo" }),
    ).toBeNull();
  });

  it("sin casos marcados no se puede enviar", () => {
    renderForm();

    expect(
      screen.getByRole("button", { name: "Repartir 0 casos" }),
    ).toBeDisabled();
  });
});
