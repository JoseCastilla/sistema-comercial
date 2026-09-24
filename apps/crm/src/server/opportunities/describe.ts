/**
 * Historial de la oportunidad en lenguaje directo: se dice lo que pasó, no el
 * nombre del evento. Función pura: recibe la fila y devuelve la frase.
 */
import type { OpportunityStage } from "@/generated/prisma/enums";

import { lostReasonLabel, NEXT_ACTION_LABELS, ORIGIN_LABELS, RELATION_LABELS, STAGE_LABELS } from "./rules";

export interface TimelineEvent {
  type: string;
  actorKind: string;
  actorUserId: string | null;
  detail: unknown;
}

const ACTOR_LABELS: Record<string, string> = {
  SYSTEM: "El sistema",
  AGENT_AI: "El asistente virtual",
  WORKFLOW: "Un flujo automático",
  USER: "Alguien del equipo",
};

/** Quién lo hizo: el nombre si se conoce, si no el tipo de autor. */
export function actorLabel(event: TimelineEvent, names: Map<string, string>): string {
  if (event.actorUserId) return names.get(event.actorUserId) ?? "Alguien del equipo";
  return ACTOR_LABELS[event.actorKind] ?? "El sistema";
}

function field(detail: unknown, key: string): string | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const value = (detail as Record<string, unknown>)[key];
  if (value === null || value === undefined) return null;
  return String(value);
}

function stageLabel(value: string | null): string {
  return value && value in STAGE_LABELS ? STAGE_LABELS[value as OpportunityStage] : (value ?? "—");
}

export function describeOpportunityEvent(event: TimelineEvent): string {
  const detail = event.detail;
  switch (event.type) {
    case "OPENED": {
      const origin = field(detail, "origin");
      const relation = field(detail, "relation");
      const originText = origin && origin in ORIGIN_LABELS ? ORIGIN_LABELS[origin as keyof typeof ORIGIN_LABELS] : "origen desconocido";
      const relationText = relation === "EXISTING" ? RELATION_LABELS.EXISTING.toLowerCase() : RELATION_LABELS.NEW.toLowerCase();
      return `Se abrió la oportunidad. Llegó por ${originText.toLowerCase()} y el cliente es ${relationText}.`;
    }
    case "STAGE_CHANGED": {
      const to = field(detail, "to");
      const from = field(detail, "from");
      const reason = field(detail, "reason");
      if (to === "PERDIDA") {
        const lost = lostReasonLabel(field(detail, "lostReason"));
        const lostDetail = field(detail, "lostDetail");
        return `Se cerró como perdida: ${lost.toLowerCase()}.${lostDetail ? ` ${lostDetail}` : ""}`;
      }
      if (to === "GANADA") return `Se ganó: ${reason ?? "se vinculó un pedido"}.`;
      return `Pasó de ${stageLabel(from)} a ${stageLabel(to)}.${reason ? ` Motivo: ${reason}.` : ""}`;
    }
    case "ASSIGNED": {
      const reason = field(detail, "reason");
      return field(detail, "to") ? `Cambió el responsable.${reason ? ` ${reason}.` : ""}` : "Quedó sin responsable.";
    }
    case "PROPOSAL": {
      const plan = field(detail, "planName");
      const lines = field(detail, "lines");
      const charge = field(detail, "fixedCharge");
      return `Se registró la propuesta${plan ? `: ${plan}` : ""}${lines ? ` · ${lines} línea(s)` : ""}${charge ? ` · S/ ${Number(charge).toFixed(2)}` : ""}.`;
    }
    case "ORDER_LINKED":
      return `Se vinculó el pedido ${field(detail, "externalRef") ?? ""}.`.trim();
    case "ORDER_UNLINKED":
      return `Se quitó el pedido ${field(detail, "externalRef") ?? ""}: ${field(detail, "reason") ?? "sin motivo"}.`;
    case "ORDER_DROPPED":
      return `El pedido ${field(detail, "externalRef") ?? ""} se canceló. La venta sigue contada, pero marcada como caída.`.trim();
    case "NEXT_ACTION": {
      const kind = field(detail, "kind");
      if (!kind) return "Se quitó la siguiente acción.";
      const label = kind in NEXT_ACTION_LABELS ? NEXT_ACTION_LABELS[kind as keyof typeof NEXT_ACTION_LABELS] : kind;
      return `Siguiente acción: ${label.toLowerCase()}.`;
    }
    case "TOUCH": {
      const origin = field(detail, "origin");
      const originText = origin && origin in ORIGIN_LABELS ? ORIGIN_LABELS[origin as keyof typeof ORIGIN_LABELS] : "otro canal";
      return `Volvió a escribir, esta vez por ${originText.toLowerCase()}. Se mantiene la misma oportunidad.`;
    }
    default:
      return event.type;
  }
}
