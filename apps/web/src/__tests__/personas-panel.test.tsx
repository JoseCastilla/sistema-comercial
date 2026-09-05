import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PersonAdminPanel,
  type PersonAdminPanelPerson,
} from "@/features/users/components/person-admin-panel";

vi.mock("@/features/users/server/disable-person-action", () => ({
  disablePersonAction: async () => ({ type: "idle", message: "" }),
}));
vi.mock("@/features/users/server/promote-person-action", () => ({
  promotePersonAction: async () => ({ type: "idle", message: "" }),
}));
vi.mock("@/features/users/server/reenter-person-action", () => ({
  reenterPersonAction: async () => ({ type: "idle", message: "" }),
}));
vi.mock("@/features/users/server/reset-user-password-action", () => ({
  resetUserPasswordAction: async () => ({ type: "idle", message: "" }),
}));

const persona = (
  extra: Partial<PersonAdminPanelPerson>,
): PersonAdminPanelPerson => ({
  id: "u-1",
  name: "Ana Quispe Huamán de la Torre",
  email: "ana.quispe@empresa.pe",
  role: "SUPERVISOR",
  status: "ACTIVE",
  primaryTeamId: "t-1",
  primaryTeamName: "Lima Centro",
  teamsLeftWithoutSupervisor: [],
  emailVerified: true,
  sinceLabel: "09/08/2026",
  supervisedTeamNames: ["Lima Centro", "Huancayo"],
  ...extra,
});

function renderPanel(extra: Partial<PersonAdminPanelPerson> = {}) {
  render(
    <PersonAdminPanel
      closeHref="/admin/users?q=ana#persona-u-1"
      destinationCandidates={[]}
      history={[
        {
          action: "PROMOTED",
          label: "Promoción a supervisor",
          reason: "Promoción a supervisor",
          actorName: "Admin",
          createdAtLabel: "05/09/2026, 16:00",
          summary: "equipo Lima Centro · sigue vendiendo",
        },
      ]}
      isCurrentUser={false}
      overview={{ openOrders: 0, internalCases: 0, campaignCases: 0 }}
      person={persona(extra)}
      teams={[{ id: "t-1", name: "Lima Centro" }]}
    />,
  );
}

/**
 * SPEC-043 UX-02: el panel administra a una persona con nombre y correo
 * siempre visibles, sus relaciones comerciales por separado, las acciones
 * que su estado permite, seguridad aparte y el historial.
 */
describe("Panel de administración de una persona", () => {
  it("nombra a la persona completa, con correo, rol y estado, y cierra volviendo a la fila", () => {
    renderPanel();

    const panel = screen.getByRole("complementary", {
      name: "Ana Quispe Huamán de la Torre",
    });
    expect(
      within(panel).getByText("ana.quispe@empresa.pe"),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Supervisor")).toBeInTheDocument();
    expect(within(panel).getByText("Activo")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Cerrar" })).toHaveAttribute(
      "href",
      "/admin/users?q=ana#persona-u-1",
    );
  });

  it("separa el equipo comercial de los equipos supervisados", () => {
    renderPanel();

    expect(screen.getByText("Equipo comercial").nextSibling).toHaveTextContent(
      "Lima Centro",
    );
    expect(screen.getByText("Supervisa").nextSibling).toHaveTextContent(
      "Lima Centro, Huancayo",
    );
  });

  it("agrupa seguridad y ciclo de vida, y muestra el historial", () => {
    renderPanel();

    expect(
      screen.getByRole("heading", { name: "Seguridad" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cambiar contraseña" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ciclo de vida" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dar de baja" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("equipo Lima Centro · sigue vendiendo"),
    ).toBeInTheDocument();
  });

  it("administración no requiere equipo ni tiene ciclo de vida desde aquí", () => {
    renderPanel({
      role: "ADMIN",
      primaryTeamId: null,
      primaryTeamName: null,
      supervisedTeamNames: [],
    });

    expect(screen.getByText("No requiere equipo")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ciclo de vida" })).toBeNull();
  });
});
