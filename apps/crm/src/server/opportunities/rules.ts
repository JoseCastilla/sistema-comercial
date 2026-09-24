/**
 * Reglas puras del embudo (SPEC-061 BR-001 a BR-021, adaptadas al MVP).
 * Sin base de datos ni `server-only`: las importan el servidor, las pruebas
 * y los componentes de cliente (etiquetas y transiciones válidas).
 */
import type { ContactOrigin, CustomerRelation, NextActionKind, OpportunityStage, OrderStatus } from "@/generated/prisma/enums";

export type ActorKind = "USER" | "AGENT_AI" | "WORKFLOW" | "SYSTEM";

/** Etapas abiertas, en el orden del embudo (BR-007). */
export const OPEN_STAGES: readonly OpportunityStage[] = ["NUEVO", "EN_CONTACTO", "CALIFICADO", "PROPUESTA", "EN_CIERRE"];
export const CLOSED_STAGES: readonly OpportunityStage[] = ["GANADA", "PERDIDA"];
export const ALL_STAGES: readonly OpportunityStage[] = [...OPEN_STAGES, ...CLOSED_STAGES];

/** Días sin actividad tras los cuales la oportunidad se pierde sola (BR-003). */
export const staleAfterDays = 30;
/** Días con pedido ingresado durante los que un mensaje es «consulta de pedido» (BR-002). */
export const orderInProgressDays = 30;
/** Días tras el cierre en los que un pedido nuevo aún puede vincularse (BR-011). */
export const linkAfterCloseDays = 7;

export function isOpenStage(stage: OpportunityStage): boolean {
  return OPEN_STAGES.includes(stage);
}

export function stageIndex(stage: OpportunityStage): number {
  return ALL_STAGES.indexOf(stage);
}

/** Llegó a CALIFICADO o más (cuenta como «calificada» en resultados). */
export function reachedQualified(stage: OpportunityStage): boolean {
  return stageIndex(stage) >= stageIndex("CALIFICADO");
}

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  NUEVO: "Nuevo",
  EN_CONTACTO: "En contacto",
  CALIFICADO: "Calificado",
  PROPUESTA: "Propuesta",
  EN_CIERRE: "En cierre",
  GANADA: "Ganada",
  PERDIDA: "Perdida",
};

export const STAGE_HINTS: Record<OpportunityStage, string> = {
  NUEVO: "Escribió y nadie le respondió todavía.",
  EN_CONTACTO: "Ya hubo respuesta del negocio y del cliente.",
  CALIFICADO: "Tiene DNI, operador, líneas y distrito.",
  PROPUESTA: "Se le ofreció un plan o tiene cita.",
  EN_CIERRE: "Aceptó y se está ingresando el pedido.",
  GANADA: "Tiene un pedido ingresado. Se gana sola al vincular el pedido.",
  PERDIDA: "Cerrada con motivo.",
};

export const ORIGIN_LABELS: Record<ContactOrigin, string> = {
  AD: "Anuncio",
  BROADCAST: "Difusión",
  REFERRAL: "Referido",
  ADVISOR: "Asesor",
  ORGANIC: "Orgánico",
  UNKNOWN: "Desconocido",
};

export const RELATION_LABELS: Record<CustomerRelation, string> = {
  NEW: "Nuevo",
  EXISTING: "Existente",
};

export const NEXT_ACTION_LABELS: Record<NextActionKind, string> = {
  LLAMAR: "Llamar",
  CITA: "Cita",
  ESPERAR_RESPUESTA: "Esperar respuesta",
  COMPLETAR_DATOS: "Completar datos",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  INGRESADO: "Ingresado",
  ENTREGADO: "Entregado",
  ACTIVADO: "Activado",
  CANCELADO: "Cancelado",
};

/** Motivos de pérdida, lista cerrada (SPEC-054 BR-017). El código se guarda en `lostReason`. */
export const LOST_REASONS = [
  { code: "NO_INTERESA", label: "No le interesa" },
  { code: "NO_CUMPLE_REQUISITOS", label: "No cumple requisitos" },
  { code: "YA_ES_CLIENTE", label: "Ya es cliente" },
  { code: "NO_RESPONDE", label: "No responde" },
  { code: "PRECIO", label: "Precio" },
  { code: "DATOS_INVALIDOS", label: "Datos inválidos" },
  { code: "OTRO", label: "Otro (con detalle)" },
] as const;

export type LostReasonCode = (typeof LOST_REASONS)[number]["code"];

/** Motivo que solo pone el sistema al vencer por inactividad (BR-003). */
export const STALE_LOST_REASON = "SIN_ACTIVIDAD";

export function lostReasonLabel(code: string | null | undefined): string {
  if (!code) return "—";
  if (code === STALE_LOST_REASON) return "Sin actividad (30 días)";
  return LOST_REASONS.find((reason) => reason.code === code)?.label ?? code;
}

export function isLostReason(code: string): code is LostReasonCode {
  return LOST_REASONS.some((reason) => reason.code === code);
}

/**
 * BR-001 / BR-002: una sola abierta por contacto; con pedido ingresado en
 * curso el mensaje no abre oportunidad y la conversación es consulta de pedido.
 */
export function shouldOpenOpportunity(input: { hasOpenOpportunity: boolean; hasOrderInProgress: boolean }): {
  open: boolean;
  markOrderInquiry: boolean;
} {
  if (input.hasOpenOpportunity) return { open: false, markOrderInquiry: false };
  if (input.hasOrderInProgress) return { open: false, markOrderInquiry: true };
  return { open: true, markOrderInquiry: false };
}

/** BR-004: origen según la evidencia de la conversación. Nunca se adivina. */
export function originForConversation(input: { originAdId: string | null | undefined; repliedToBroadcast: boolean }): ContactOrigin {
  if (input.originAdId) return "AD";
  if (input.repliedToBroadcast) return "BROADCAST";
  return "ORGANIC";
}

/** BR-006: relación con el cliente, con corte en la apertura. */
export function customerRelation(input: { hadDeliveredOrderBefore: boolean }): CustomerRelation {
  return input.hadDeliveredOrderBefore ? "EXISTING" : "NEW";
}

export type TransitionVerdict =
  | { allowed: true; requiresReason: boolean; backwards: boolean }
  | { allowed: false; message: string };

/**
 * BR-007 / BR-008 / BR-015. Manuales hacia adelante sin motivo; retroceder
 * con motivo; PERDIDA desde cualquier abierta con motivo; GANADA solo la pone
 * el sistema al vincular un pedido; desde GANADA no se mueve; desde PERDIDA
 * solo se reabre a EN_CONTACTO con motivo.
 */
export function canTransition(from: OpportunityStage, to: OpportunityStage, actorKind: ActorKind): TransitionVerdict {
  if (from === to) return { allowed: false, message: "Ya está en esa etapa." };
  if (to === "GANADA") {
    if (actorKind !== "SYSTEM") {
      return { allowed: false, message: "Nadie mueve a mano a Ganada: se gana sola cuando se vincula un pedido ingresado." };
    }
    if (from === "GANADA") return { allowed: false, message: "Ya está ganada." };
    return { allowed: true, requiresReason: false, backwards: false };
  }
  if (from === "GANADA") {
    return { allowed: false, message: "Una oportunidad ganada no se mueve. Si el pedido se cae, queda marcada como «pedido caído»." };
  }
  if (from === "PERDIDA") {
    if (to !== "EN_CONTACTO") return { allowed: false, message: "Una perdida solo se reabre a «En contacto», con motivo." };
    return { allowed: true, requiresReason: true, backwards: false };
  }
  if (to === "PERDIDA") return { allowed: true, requiresReason: true, backwards: false };
  const backwards = stageIndex(to) < stageIndex(from);
  return { allowed: true, requiresReason: backwards, backwards };
}

/** Etapas a las que se puede ir a mano desde `from` (para botones y arrastre). */
export function manualTargets(from: OpportunityStage, actorKind: ActorKind = "USER"): OpportunityStage[] {
  return ALL_STAGES.filter((to) => canTransition(from, to, actorKind).allowed);
}

export interface LinkCandidateOpportunity {
  id: string;
  stage: OpportunityStage;
  documentNumber: string | null;
  phone: string | null;
  /** Momento del cierre (GANADA/PERDIDA); nulo si sigue abierta. */
  closedAt: Date | null;
}

export type OrderLinkDecision = { kind: "AUTO"; opportunityId: string } | { kind: "SUGGESTED"; opportunityIds: string[] } | { kind: "NONE" };

export function normalizeDocument(value: string | null | undefined): string {
  return (value ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/** Últimos nueve dígitos: «51987654321», «+51 987 654 321» y «987654321» coinciden. */
export function phoneKey(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

/**
 * BR-011: DNI coincide y una única candidata → vínculo automático; varias
 * candidatas o solo teléfono → sugerido; nada → sin oportunidad. Son
 * candidatas las abiertas y las ganadas cerradas hace menos de 7 días (una
 * segunda línea de la misma venta).
 */
export function orderLinkCandidates(input: {
  orderDocument: string | null | undefined;
  orderPhone: string | null | undefined;
  opportunities: LinkCandidateOpportunity[];
  now?: Date;
}): OrderLinkDecision {
  const now = input.now ?? new Date();
  const cutoff = now.getTime() - linkAfterCloseDays * 86_400_000;
  const candidates = input.opportunities.filter((opportunity) => {
    if (isOpenStage(opportunity.stage)) return true;
    return opportunity.stage === "GANADA" && opportunity.closedAt !== null && opportunity.closedAt.getTime() >= cutoff;
  });
  const document = normalizeDocument(input.orderDocument);
  if (document) {
    const byDocument = candidates.filter((opportunity) => normalizeDocument(opportunity.documentNumber) === document);
    if (byDocument.length === 1) return { kind: "AUTO", opportunityId: byDocument[0]!.id };
    if (byDocument.length > 1) return { kind: "SUGGESTED", opportunityIds: byDocument.map((opportunity) => opportunity.id) };
  }
  const phone = phoneKey(input.orderPhone);
  if (phone) {
    const byPhone = candidates.filter((opportunity) => phoneKey(opportunity.phone) === phone);
    if (byPhone.length > 0) return { kind: "SUGGESTED", opportunityIds: byPhone.map((opportunity) => opportunity.id) };
  }
  return { kind: "NONE" };
}

/** Importes en soles, con el mismo formato en toda la sección. */
export function soles(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `S/ ${value.toFixed(2)}`;
}

/** Días completos que lleva en la etapa actual. */
export function daysInStage(stageChangedAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - stageChangedAt.getTime()) / 86_400_000));
}

export function isStale(lastActivityAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - lastActivityAt.getTime() >= staleAfterDays * 86_400_000;
}
