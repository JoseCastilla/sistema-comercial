import type { ScheduleMode } from "./prompt";

/**
 * Cuándo actúa el agente y cuándo la conversación va a la cola
 * (SPEC-058 BR-009). Reglas puras: el suscriptor solo le pasa los hechos ya
 * leídos de la base (estado de la conversación, del agente, horario y si hay
 * alguien conectado) y hace lo que digan.
 */

export interface AgentDecisionInput {
  /** IA_ACTIVA, REQUIERE_ASESOR o CONTROL_HUMANO. */
  responderState: string;
  /** DRAFT, PUBLISHED, PAUSED o null si la conversación no tiene agente. */
  agentStatus: string | null;
  hasPublishedVersion: boolean;
  scheduleMode: ScheduleMode;
  withinBusinessHours: boolean;
  /** Hay al menos un asesor conectado en este momento. */
  advisorAvailable: boolean;
}

export type AgentDecision =
  | { respond: true }
  /** No responde. Con `handoffReason` la conversación pasa a `REQUIERE_ASESOR` con ese motivo. */
  | { respond: false; handoffReason: string | null };

export const NO_AGENT_REASON = "sin asistente disponible";

/** El horario del agente cubre este momento. */
export function scheduleApplies(input: { scheduleMode: ScheduleMode; withinBusinessHours: boolean; advisorAvailable: boolean }): boolean {
  switch (input.scheduleMode) {
    case "ALWAYS":
      return true;
    case "OUTSIDE_BUSINESS_HOURS":
      return !input.withinBusinessHours;
    case "WHEN_NO_ADVISOR":
      return !input.advisorAvailable;
  }
}

export function shouldAgentRespond(input: AgentDecisionInput): AgentDecision {
  // Si no está en manos del asistente, aquí no se toca nada.
  if (input.responderState !== "IA_ACTIVA") return { respond: false, handoffReason: null };
  if (input.agentStatus !== "PUBLISHED" || !input.hasPublishedVersion) return { respond: false, handoffReason: NO_AGENT_REASON };
  if (!scheduleApplies(input)) return { respond: false, handoffReason: NO_AGENT_REASON };
  return { respond: true };
}
