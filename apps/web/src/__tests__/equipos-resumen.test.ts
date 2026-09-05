import { describe, expect, it } from "vitest";

import {
  describeTeamDisableImpact,
  summarizeTeamMembers,
} from "@/features/teams/team-roster";

const miembro = (
  memberRole: "SUPERVISOR" | "AGENT",
  salesEnabled: boolean,
  name: string,
) => ({ memberRole, salesEnabled, user: { id: name, name } });

/**
 * SPEC-043 UX-05 y PE-06: rol y capacidad de venta se cuentan por separado,
 * y deshabilitar un equipo se anticipa con nombres y números.
 */
describe("Plantilla de un equipo", () => {
  it("separa asesores, supervisores y supervisores que venden", () => {
    const resumen = summarizeTeamMembers(
      [
        miembro("AGENT", true, "Ana"),
        miembro("AGENT", true, "Luis"),
        miembro("SUPERVISOR", true, "Rosa"),
        miembro("SUPERVISOR", false, "Pedro"),
      ],
      true,
    );

    expect(resumen.agents.map((m) => m.user.name)).toEqual(["Ana", "Luis"]);
    expect(resumen.supervisors.map((m) => m.user.name)).toEqual([
      "Rosa",
      "Pedro",
    ]);
    expect(resumen.sellingSupervisors.map((m) => m.user.name)).toEqual([
      "Rosa",
    ]);
    expect(resumen.sellers.map((m) => m.user.name)).toEqual([
      "Ana",
      "Luis",
      "Rosa",
    ]);
    expect(resumen.needsSupervisor).toBe(false);
  });

  it("un equipo activo sin supervisor necesita supervisión; uno deshabilitado no", () => {
    expect(
      summarizeTeamMembers([miembro("AGENT", true, "Ana")], true)
        .needsSupervisor,
    ).toBe(true);
    expect(
      summarizeTeamMembers([miembro("AGENT", true, "Ana")], false)
        .needsSupervisor,
    ).toBe(false);
  });

  it("la confirmación de deshabilitar nombra a quien pierde equipo y cuenta el trabajo abierto", () => {
    const lineas = describeTeamDisableImpact({
      losingTeam: ["Ana", "Rosa"],
      supervisionsClosed: ["Pedro"],
      openOrders: 12,
      openCases: 3,
    });

    expect(lineas[0]).toMatch(/no da de baja a nadie/);
    expect(lineas).toContainEqual(
      expect.stringMatching(
        /2 persona\(s\) pierden su equipo operativo.*Ana, Rosa/,
      ),
    );
    expect(lineas).toContainEqual(
      expect.stringMatching(/1 supervisión\(es\) se cierran: Pedro/),
    );
    expect(lineas).toContainEqual(
      expect.stringMatching(/12 venta\(s\) abiertas y 3 caso\(s\) de recupero/),
    );
  });

  it("sin vendedores ni trabajo, lo dice en vez de callar", () => {
    const lineas = describeTeamDisableImpact({
      losingTeam: [],
      supervisionsClosed: [],
      openOrders: 0,
      openCases: 0,
    });

    expect(lineas).toContainEqual(
      expect.stringMatching(/Nadie vende en este equipo/),
    );
    expect(lineas).toContainEqual(
      expect.stringMatching(/No hay ventas abiertas ni casos/),
    );
  });
});
