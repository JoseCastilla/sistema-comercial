import "server-only";

import { EventEmitter } from "node:events";

/**
 * Emisor de eventos en proceso (SPEC-062 M-04). Todo lo que pasa en el dominio
 * se anuncia aquí: la bandeja (SSE), los flujos y el agente se suscriben.
 * Al acoplar al Sistema Comercial se reemplaza por LISTEN/NOTIFY.
 */
export type DomainEvent =
  | { type: "message.inbound"; organizationId: string; conversationId: string; contactId: string; messageId: string; isFirstInConversation: boolean }
  | { type: "message.outbound.queued"; organizationId: string; conversationId: string; messageId: string }
  | { type: "message.status"; organizationId: string; conversationId: string; messageId: string; status: string }
  | { type: "conversation.updated"; organizationId: string; conversationId: string; reason: string }
  | { type: "conversation.responder"; organizationId: string; conversationId: string; state: string; actorUserId?: string }
  | { type: "conversation.unanswered"; organizationId: string; conversationId: string; minutes: number }
  | { type: "opportunity.opened"; organizationId: string; opportunityId: string; contactId: string; conversationId?: string; origin: string }
  | { type: "opportunity.stage"; organizationId: string; opportunityId: string; contactId: string; stage: string; previousStage: string }
  | { type: "order.status"; organizationId: string; orderId: string; opportunityId?: string; contactId?: string; status: string }
  | { type: "appointment.created"; organizationId: string; appointmentId: string; contactId: string; scheduledAt: string }
  | { type: "contact.tagged"; organizationId: string; contactId: string; tag: string }
  | { type: "template.updated"; organizationId: string; templateId: string; status: string }
  | { type: "whatsapp.number.updated"; organizationId: string; numberId: string };

type Listener = (event: DomainEvent) => void;

const globalForBus = globalThis as typeof globalThis & { crmEventBus?: EventEmitter };
const emitter = globalForBus.crmEventBus ?? new EventEmitter();
emitter.setMaxListeners(0);
globalForBus.crmEventBus = emitter;

export function publishEvent(event: DomainEvent): void {
  // Nunca dejar que un suscriptor roto tumbe al emisor.
  setImmediate(() => emitter.emit("domain", event));
}

export function subscribeToEvents(listener: Listener): () => void {
  const safe: Listener = (event) => {
    try {
      listener(event);
    } catch (error) {
      console.error("Suscriptor de eventos falló", error);
    }
  };
  emitter.on("domain", safe);
  return () => emitter.off("domain", safe);
}
