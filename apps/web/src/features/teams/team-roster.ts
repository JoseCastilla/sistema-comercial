/**
 * Lectura de la plantilla de un equipo — SPEC-043 fase 2 (UX-05, PE-06).
 *
 * Rol y capacidad de venta no son lo mismo (SPEC-019): un supervisor puede
 * vender. Aquí se cuenta cada cosa por su nombre, y se describe con números
 * qué pasa si el equipo se deshabilita: quién pierde su equipo operativo,
 * qué supervisiones se cierran y cuánto trabajo abierto conserva el equipo
 * registrado. Deshabilitar un equipo no da de baja a nadie (SPEC-001 BR-009).
 */

export interface TeamRosterMember {
  memberRole: "SUPERVISOR" | "AGENT";
  salesEnabled: boolean;
  user: { id: string; name: string };
}

export interface TeamRosterSummary<
  T extends TeamRosterMember = TeamRosterMember,
> {
  /** Integrantes con función asesor. */
  agents: T[];
  /** Supervisores del equipo, vendan o no. */
  supervisors: T[];
  /** Supervisores que además venden aquí. */
  sellingSupervisors: T[];
  /** Personas habilitadas para vender en el equipo: asesores + supervisores que venden. */
  sellers: T[];
  needsSupervisor: boolean;
}

export function summarizeTeamMembers<T extends TeamRosterMember>(
  members: readonly T[],
  active: boolean,
): TeamRosterSummary<T> {
  const agents = members.filter((member) => member.memberRole === "AGENT");
  const supervisors = members.filter(
    (member) => member.memberRole === "SUPERVISOR",
  );
  const sellingSupervisors = supervisors.filter(
    (member) => member.salesEnabled,
  );

  return {
    agents,
    supervisors,
    sellingSupervisors,
    sellers: [
      ...agents.filter((member) => member.salesEnabled),
      ...sellingSupervisors,
    ],
    needsSupervisor: active && supervisors.length === 0,
  };
}

export interface TeamDisableImpact {
  /** Personas que pierden su equipo operativo (venden aquí). */
  losingTeam: string[];
  /** Supervisiones que se cierran (supervisores que no venden aquí). */
  supervisionsClosed: string[];
  openOrders: number;
  openCases: number;
}

/**
 * Frases que la confirmación muestra antes de deshabilitar. Una por
 * consecuencia; ninguna promete lo que la acción no hace.
 */
export function describeTeamDisableImpact(impact: TeamDisableImpact): string[] {
  const lines: string[] = [
    "Deshabilitar el equipo no da de baja a nadie ni libera su cartera personal; solo impide nuevas asignaciones aquí.",
  ];

  if (impact.losingTeam.length > 0) {
    lines.push(
      `${impact.losingTeam.length} persona(s) pierden su equipo operativo y dejan de recibir ventas por correo hasta que se les asigne otro: ${impact.losingTeam.join(", ")}.`,
    );
  } else {
    lines.push(
      "Nadie vende en este equipo: ninguna persona pierde su equipo operativo.",
    );
  }

  if (impact.supervisionsClosed.length > 0) {
    lines.push(
      `${impact.supervisionsClosed.length} supervisión(es) se cierran: ${impact.supervisionsClosed.join(", ")}.`,
    );
  }

  if (impact.openOrders > 0 || impact.openCases > 0) {
    lines.push(
      `${impact.openOrders} venta(s) abiertas y ${impact.openCases} caso(s) de recupero asignados al equipo conservan el equipo registrado y siguen visibles para administración.`,
    );
  } else {
    lines.push(
      "No hay ventas abiertas ni casos de recupero asignados al equipo.",
    );
  }

  lines.push("Las órdenes, los casos y el historial no se tocan.");

  return lines;
}
