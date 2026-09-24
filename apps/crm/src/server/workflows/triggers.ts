import type { WorkflowTrigger } from "./schema";

/**
 * Reglas puras de disparo (SPEC-060 BR-001 y BR-014). Aquí no se consulta la
 * base: el bucle trae los hechos y estas funciones deciden si el flujo arranca
 * y con qué clave de idempotencia.
 */

export type InboundFilters = Extract<WorkflowTrigger, { kind: "INBOUND_MESSAGE" }>["filters"];

/** Minúsculas y sin tildes: «Portabilidad» y «portabilidad» son la misma palabra. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export interface InboundFacts {
  isFirstInConversation: boolean;
  fromAd: boolean;
  body: string;
  withinBusinessHours: boolean;
}

export function matchesInbound(filters: InboundFilters, facts: InboundFacts): boolean {
  if (filters.firstMessageOnly && !facts.isFirstInConversation) return false;
  if (filters.fromAd && !facts.fromAd) return false;
  if (filters.outsideBusinessHours && facts.withinBusinessHours) return false;
  const keyword = filters.keyword ? normalizeText(filters.keyword) : "";
  if (keyword && !normalizeText(facts.body).includes(keyword)) return false;
  return true;
}

/**
 * Hora redondeada hacia abajo, en UTC. Los disparadores de tiempo se evalúan
 * cada pocos segundos: la clave los agrupa por hora para que el mismo objeto
 * no arranque dos ejecuciones.
 */
export function hourKey(date: Date): string {
  return `${date.toISOString().slice(0, 13)}h`;
}

/** Flujo + objeto + evento: el mismo disparador no crea dos ejecuciones (BR-014). */
export function idempotencyKey(kind: string, objectId: string, eventKey: string): string {
  return `${kind}:${objectId}:${eventKey}`.slice(0, 200);
}
