import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PersonLifecycleActions,
  type PersonLifecyclePerson,
} from "@/features/users/components/person-lifecycle-actions";

vi.mock("@/features/users/server/disable-person-action", () => ({
  disablePersonAction: async () => ({ type: "idle", message: "" }),
}));
vi.mock("@/features/users/server/promote-person-action", () => ({
  promotePersonAction: async () => ({ type: "idle", message: "" }),
}));
vi.mock("@/features/users/server/reenter-person-action", () => ({
  reenterPersonAction: async () => ({ type: "idle", message: "" }),
}));

const persona = (
  extra: Partial<PersonLifecyclePerson>,
): PersonLifecyclePerson => ({
  id: "u-1",
  name: "Ana Quispe",
  email: "ana@empresa.pe",
  role: "AGENT",
  status: "ACTIVE",
  primaryTeamId: "t-1",
  primaryTeamName: "Lima Centro",
  teamsLeftWithoutSupervisor: [],
  ...extra,
});

const equipos = [
  { id: "t-1", name: "Lima Centro" },
  { id: "t-2", name: "Huancayo" },
];

function renderAcciones(
  extra: Partial<PersonLifecyclePerson> = {},
  props: Partial<Parameters<typeof PersonLifecycleActions>[0]> = {},
) {
  render(
    <PersonLifecycleActions
      destinationCandidates={[{ id: "u-2", name: "Luis" }]}
      history={[]}
      isCurrentUser={false}
      overview={{ openOrders: 3, internalCases: 4, campaignCases: 6 }}
      person={persona(extra)}
      teams={equipos}
      {...props}
    />,
  );
}

/**
 * SPEC-042: las tres acciones aparecen según estado y rol, se abren al
 * pedirlas y anticipan con números lo que va a pasar antes de confirmar.
 */
describe("Ciclo de vida de una persona", () => {
  it("un asesor activo puede darse de baja o promoverse; no reingresar", () => {
    renderAcciones();

    expect(
      screen.getByRole("button", { name: "Dar de baja" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Promover a supervisor" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reingresar" })).toBeNull();
  });

  it("nadie se da de baja a sí mismo; una persona de baja solo reingresa", () => {
    renderAcciones({}, { isCurrentUser: true });
    expect(screen.queryByRole("button", { name: "Dar de baja" })).toBeNull();

    render(
      <PersonLifecycleActions
        destinationCandidates={[]}
        history={[]}
        isCurrentUser={false}
        overview={{ openOrders: 0, internalCases: 0, campaignCases: 0 }}
        person={persona({ id: "u-9", status: "DISABLED" })}
        teams={equipos}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Reingresar" }),
    ).toBeInTheDocument();
  });

  it("la baja anticipa con números, exige motivo y ofrece entregar la cartera", () => {
    renderAcciones({
      role: "SUPERVISOR",
      teamsLeftWithoutSupervisor: ["Huancayo"],
    });

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));

    expect(
      screen.getByText(/3 venta\(s\) abiertas siguen a su nombre/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /4 caso\(s\) de recupero de ventas quedan sin responsable.*6 de Campañas vuelven al pool/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Huancayo quedaría sin ningún supervisor/),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Motivo" })).toBeRequired();

    const destino = screen.getByRole("combobox", {
      name: "Entregar sus casos de recupero a",
    });
    fireEvent.change(destino, { target: { value: "u-2" } });
    expect(
      screen.getByText(
        /4 caso\(s\) de recupero de ventas se entregan al asesor elegido/,
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), {
      target: { value: "OTRO" },
    });
    expect(screen.getByRole("textbox", { name: "Cuál" })).toBeRequired();
  });

  it("promover propone su equipo, y dice qué pasa con su venta", () => {
    renderAcciones();

    fireEvent.click(
      screen.getByRole("button", { name: "Promover a supervisor" }),
    );

    expect(
      screen.getByRole("combobox", { name: "Equipo que va a supervisar" }),
    ).toHaveValue("t-1");
    expect(screen.getByText(/se le siguen asignando/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Sigue vendiendo/ }));
    expect(
      screen.getByText(/Su membresía de venta se cierra hoy/),
    ).toBeInTheDocument();
  });

  it("el reingreso pide equipo y contraseña nueva, y ofrece cambiar el correo", () => {
    renderAcciones({
      status: "DISABLED",
      primaryTeamId: null,
      primaryTeamName: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Reingresar" }));

    expect(
      screen.getByRole("combobox", { name: "Equipo principal" }),
    ).toBeRequired();
    expect(screen.getByLabelText("Contraseña nueva")).toBeRequired();
    expect(screen.getByLabelText(/Correo \(déjalo vacío/)).toHaveAttribute(
      "placeholder",
      "ana@empresa.pe",
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Rol" }), {
      target: { value: "SUPERVISOR" },
    });
    expect(
      screen.getByRole("checkbox", { name: "También vende en ese equipo" }),
    ).toBeInTheDocument();
  });

  it("el historial se ve cuando existe", () => {
    renderAcciones(
      {},
      {
        history: [
          {
            action: "PROMOTED",
            label: "Promoción a supervisor",
            reason: "Promoción a supervisor",
            actorName: "Admin",
            createdAtLabel: "05/09/2026, 16:00",
            summary: "equipo Lima Centro · sigue vendiendo",
          },
        ],
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Historial (1)" }));
    expect(
      screen.getByText("equipo Lima Centro · sigue vendiendo"),
    ).toBeInTheDocument();
  });
});
