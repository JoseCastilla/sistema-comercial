import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TeamToday } from "@/features/team-today/components/team-today";

import type { TeamTodayData } from "@/features/team-today/server/get-team-today";
import type { TeamMemberDaySummary } from "@repo/validation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

/**
 * SPEC-069 fase 1: el equipo en una línea y una tarjeta por asesor, primero
 * quien más pierde, con cada cifra enlazada a la lista que la explica.
 */
function miembro(extra: Partial<TeamMemberDaySummary>): TeamMemberDaySummary {
  return {
    userId: "u-1",
    name: "Christian Ruiz",
    salesNotCalled: 0,
    salesNotCalledOverdue: 0,
    salesFollowUp: 0,
    citasOverdue: 0,
    citasSoon: 0,
    orders: 0,
    campaignTotal: 0,
    coldCount: 0,
    attemptsToday: 0,
    enteredToday: 0,
    quotaDelivered: 10,
    quotaTarget: 45,
    lastAttemptLabel: null,
    idle: "tarde",
    ...extra,
  };
}

function datos(members: TeamMemberDaySummary[]): TeamTodayData {
  return {
    generatedAt: new Date("2026-09-25T20:00:00.000Z"),
    teamNames: ["HUANCAYO - EL TAMBO"],
    totals: {
      salesNotCalled: members.reduce((t, m) => t + m.salesNotCalled, 0),
      citasOverdue: members.reduce((t, m) => t + m.citasOverdue, 0),
      orders: members.reduce((t, m) => t + m.orders, 0),
      campaignTotal: members.reduce((t, m) => t + m.campaignTotal, 0),
      attemptsToday: members.reduce((t, m) => t + m.attemptsToday, 0),
      quotaDelivered: members.reduce((t, m) => t + m.quotaDelivered, 0),
      quotaTarget: members.reduce((t, m) => t + m.quotaTarget, 0),
    },
    members,
  };
}

describe("Hoy en mi equipo", () => {
  it("el equipo en una línea: lo caliente de hoy y la cuota", () => {
    render(
      <TeamToday
        data={datos([
          miembro({ salesNotCalled: 6, salesNotCalledOverdue: 6 }),
          miembro({ userId: "u-2", name: "Sarai Flores", salesNotCalled: 2 }),
        ])}
        dateLabel="Viernes, 25 de setiembre"
      />,
    );

    const equipo = screen.getByRole("region", { name: "El equipo hoy" });
    expect(within(equipo).getByText("Calientes sin llamar")).toBeInTheDocument();
    expect(within(equipo).getByText("8")).toBeInTheDocument();
    expect(within(equipo).getByText("20 de 90")).toBeInTheDocument();
  });

  it("cada asesor dice lo de ahora y cada cifra abre su lista", () => {
    render(
      <TeamToday
        data={datos([
          miembro({
            salesNotCalled: 6,
            salesNotCalledOverdue: 6,
            citasOverdue: 1,
            orders: 2,
            campaignTotal: 26,
            coldCount: 17,
          }),
        ])}
        dateLabel="Viernes, 25 de setiembre"
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "6 ventas calientes sin llamar (6 vencidas)",
      }),
    ).toHaveAttribute("href", "/recovery/sales?advisor=u-1");
    expect(
      screen.getByRole("link", { name: "1 cita vencida" }),
    ).toHaveAttribute(
      "href",
      "/recovery/follow-up?advisor=u-1&next=vencida&status=SCHEDULED",
    );
    expect(
      screen.getByRole("link", { name: "2 pedidos que necesitan acción" }),
    ).toHaveAttribute("href", "/orders?advisor=u-1&status=LOGISTICS");
    expect(
      screen.getByRole("link", { name: /Campaña: 26 casos por trabajar hoy/ }),
    ).toHaveAttribute("href", "/recovery/follow-up?advisor=u-1");
    expect(screen.getByText("17 antiguas")).toBeInTheDocument();
    expect(screen.getByText("Cuota 10 de 45")).toBeInTheDocument();
    // Fase 2: su «Mi día», en solo lectura.
    expect(screen.getByRole("link", { name: "Ver su día" })).toHaveAttribute(
      "href",
      "/team/today/u-1",
    );
  });

  it("sin gestiones: gris temprano, ámbar tarde, y nunca «ausente»", () => {
    const { rerender } = render(
      <TeamToday
        data={datos([miembro({ idle: "temprano" })])}
        dateLabel="Viernes"
      />,
    );
    expect(screen.getByText("Sin gestiones hoy")).not.toHaveClass(
      "text-ui-warning",
    );

    rerender(
      <TeamToday data={datos([miembro({ idle: "tarde" })])} dateLabel="Viernes" />,
    );
    expect(screen.getByText("Sin gestiones hoy")).toHaveClass("text-ui-warning");
    expect(screen.queryByText(/ausente/i)).not.toBeInTheDocument();
  });

  it("quien trabajó dice cuántas gestiones y a qué hora fue la última", () => {
    render(
      <TeamToday
        data={datos([
          miembro({ attemptsToday: 4, lastAttemptLabel: "11:40", idle: "no" }),
        ])}
        dateLabel="Viernes"
      />,
    );

    expect(
      screen.getByText("4 gestiones hoy · la última a las 11:40"),
    ).toBeInTheDocument();
    expect(screen.getByText("Nada urgente ahora.")).toBeInTheDocument();
  });

  it("sin asesores, dice dónde darlos de alta", () => {
    render(<TeamToday data={datos([])} dateLabel="Viernes" />);

    expect(
      screen.getByText(/no tienen asesores con venta habilitada/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Mi equipo y alta de asesores" }),
    ).toHaveAttribute("href", "/team");
  });
});
