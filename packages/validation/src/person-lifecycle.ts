/**
 * Ciclo de vida del vendedor: baja, reingreso y promoción — SPEC-042.
 *
 * Reglas puras sobre quién puede hacer qué a quién, y sobre qué pasa con la
 * cartera de recupero de quien se da de baja. No tocan base de datos: las
 * acciones de servidor las consultan y aplican lo que decidan.
 */

export type PersonLifecycleAction = "DISABLED" | "REENTERED" | "PROMOTED";

export const personLifecycleActionLabels: Record<
  PersonLifecycleAction,
  string
> = {
  DISABLED: "Baja",
  REENTERED: "Reingreso",
  PROMOTED: "Promoción a supervisor",
};

export type PersonDisableReason =
  "RENUNCIA" | "CESE" | "FIN_DE_CAMPANA" | "OTRO";

export const personDisableReasonOptions: ReadonlyArray<{
  value: PersonDisableReason;
  label: string;
}> = [
  { value: "RENUNCIA", label: "Renuncia" },
  { value: "CESE", label: "Cese" },
  { value: "FIN_DE_CAMPANA", label: "Fin de campaña" },
  { value: "OTRO", label: "Otro motivo" },
];

export function parsePersonDisableReason(
  value: string | null | undefined,
): PersonDisableReason | null {
  const text = String(value ?? "").trim();

  return personDisableReasonOptions.some((option) => option.value === text)
    ? (text as PersonDisableReason)
    : null;
}

export type PersonCommercialRole =
  "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";
export type PersonStatus = "INVITED" | "ACTIVE" | "DISABLED";

export interface LifecycleDecision {
  allowed: boolean;
  /** Por qué no, en una frase para quien intentó. */
  reason: string | null;
}

const allowed: LifecycleDecision = { allowed: true, reason: null };
const denied = (reason: string): LifecycleDecision => ({
  allowed: false,
  reason,
});

const commercialRoles = new Set<PersonCommercialRole>(["AGENT", "SUPERVISOR"]);

/**
 * BR-007: solo administración da de baja, nadie a sí mismo, y solo a
 * asesores y supervisores activos. Administradores y back office quedan
 * fuera de este incremento.
 */
export function canDisablePerson(input: {
  actorRole: PersonCommercialRole;
  actorUserId: string;
  targetUserId: string;
  targetRole: PersonCommercialRole;
  targetStatus: PersonStatus;
}): LifecycleDecision {
  if (input.actorRole !== "ADMIN") {
    return denied("Solo administración puede dar de baja.");
  }
  if (input.actorUserId === input.targetUserId) {
    return denied("Nadie se da de baja a sí mismo.");
  }
  if (!commercialRoles.has(input.targetRole)) {
    return denied("Desde aquí solo se dan de baja asesores y supervisores.");
  }
  if (input.targetStatus !== "ACTIVE") {
    return denied("La persona ya no está activa.");
  }

  return allowed;
}

/** BR-008: reingresa la misma persona, que hoy está deshabilitada. */
export function canReenterPerson(input: {
  actorRole: PersonCommercialRole;
  targetRole: PersonCommercialRole;
  targetStatus: PersonStatus;
}): LifecycleDecision {
  if (input.actorRole !== "ADMIN") {
    return denied("Solo administración puede reingresar a una persona.");
  }
  if (!commercialRoles.has(input.targetRole)) {
    return denied("Desde aquí solo reingresan asesores y supervisores.");
  }
  if (input.targetStatus !== "DISABLED") {
    return denied("La persona no está de baja.");
  }

  return allowed;
}

/** BR-011, BR-012: se promueve a un asesor activo con equipo. */
export function canPromotePerson(input: {
  actorRole: PersonCommercialRole;
  targetRole: PersonCommercialRole;
  targetStatus: PersonStatus;
  hasPrimaryTeam: boolean;
}): LifecycleDecision {
  if (input.actorRole !== "ADMIN") {
    return denied("Solo administración puede promover.");
  }
  if (input.targetRole !== "AGENT") {
    return denied("Solo un asesor puede promoverse a supervisor.");
  }
  if (input.targetStatus !== "ACTIVE") {
    return denied("La persona no está activa.");
  }
  if (!input.hasPrimaryTeam) {
    return denied(
      "Primero asígnale un equipo: un asesor sin equipo no se promueve.",
    );
  }

  return allowed;
}

export interface ReleasableCase {
  id: string;
  /** `NATIONAL_BASE` es Campañas; lo demás es el carril interno. */
  source: string;
  priority: string | null;
  originalAgentUserId: string | null;
}

export interface PortfolioReleasePlan {
  /** Casos de Campañas: vuelven al pool de su equipo (BR-077). */
  toPool: string[];
  /** Casos internos que quedan sin responsable en su equipo. */
  toUnassigned: string[];
  /** Casos internos entregados al asesor destino. */
  toDestination: string[];
  /** Internos que no pudieron ir al destino por la regla de Crítica (BR-065). */
  blockedByCritical: number;
}

/**
 * BR-005: qué pasa con la cartera de quien se da de baja. Campañas siempre
 * al pool; el carril interno al destino si hay uno y la regla de Crítica lo
 * permite, o sin responsable en su equipo.
 */
export function planPortfolioRelease(
  cases: readonly ReleasableCase[],
  destinationUserId: string | null,
): PortfolioReleasePlan {
  const plan: PortfolioReleasePlan = {
    toPool: [],
    toUnassigned: [],
    toDestination: [],
    blockedByCritical: 0,
  };

  for (const item of cases) {
    if (item.source === "NATIONAL_BASE") {
      plan.toPool.push(item.id);
      continue;
    }

    if (destinationUserId === null) {
      plan.toUnassigned.push(item.id);
      continue;
    }

    if (
      item.priority === "CRITICA" &&
      item.originalAgentUserId === destinationUserId
    ) {
      plan.blockedByCritical += 1;
      plan.toUnassigned.push(item.id);
      continue;
    }

    plan.toDestination.push(item.id);
  }

  return plan;
}
