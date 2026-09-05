import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateAgentForm } from "@/features/teams/components/create-agent-form";

vi.mock("@/features/teams/server/create-agent-for-team-action", () => ({
  createAgentForTeamAction: async () => ({ type: "idle", message: "" }),
}));

/**
 * SPEC-043 PE-07: el alta desde «Mi equipo» no elige rol y solo ofrece los
 * equipos supervisados.
 */
describe("Alta de asesor desde Mi equipo", () => {
  it("no ofrece rol y limita el equipo a los supervisados", () => {
    render(
      <CreateAgentForm
        teams={[
          { id: "t-1", name: "Lima Centro" },
          { id: "t-2", name: "Huancayo" },
        ]}
      />,
    );

    expect(document.querySelector('select[name="role"]')).toBeNull();
    const equipo = document.querySelector('select[name="teamId"]')!;
    expect(equipo).toBeRequired();
    expect(
      Array.from(equipo.querySelectorAll("option")).map((o) => o.textContent),
    ).toEqual(["Elige el equipo", "Lima Centro", "Huancayo"]);
    expect(document.querySelector('input[name="password"]')).toHaveAttribute(
      "minlength",
      "12",
    );
  });

  it("con un solo equipo lo preselecciona; sin equipos, no deja crear", () => {
    const { unmount } = render(
      <CreateAgentForm teams={[{ id: "t-1", name: "Lima Centro" }]} />,
    );
    expect(document.querySelector('select[name="teamId"]')).toHaveValue("t-1");
    unmount();

    render(<CreateAgentForm teams={[]} />);
    expect(screen.getByRole("button", { name: "Crear asesor" })).toBeDisabled();
    expect(
      screen.getByText("No supervisas equipos activos"),
    ).toBeInTheDocument();
  });
});
