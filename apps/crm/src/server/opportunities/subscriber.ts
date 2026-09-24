import "server-only";

import { registerLoop } from "../background/registry";
import { database } from "../database";
import { subscribeToEvents, type DomainEvent } from "../events/bus";
import { originForConversation, shouldOpenOpportunity } from "./rules";
import { closeStaleOpportunities, findOpenOpportunity, hasOrderInProgress, openOpportunity, setStage, touchActivity } from "./service";

const RECENT_BROADCAST_DAYS = 7;

/** Difusión reciente al contacto: el mensaje responde a ella (BR-004 DIFUSION). */
async function recentBroadcastId(contactId: string, now: Date): Promise<string | null> {
  const recipient = await database.broadcastRecipient.findFirst({
    where: {
      contactId,
      status: { in: ["SENT", "DELIVERED", "READ", "REPLIED"] },
      message: { createdAt: { gte: new Date(now.getTime() - RECENT_BROADCAST_DAYS * 86_400_000) } },
    },
    orderBy: { updatedAt: "desc" },
    select: { broadcastId: true },
  });
  return recipient?.broadcastId ?? null;
}

async function onInbound(event: Extract<DomainEvent, { type: "message.inbound" }>) {
  const conversation = await database.conversation.findFirst({
    where: { id: event.conversationId, organizationId: event.organizationId },
    select: {
      id: true,
      contactId: true,
      assignedUserId: true,
      originAdId: true,
      isOrderInquiry: true,
      contact: { select: { id: true, documentNumber: true } },
    },
  });
  if (!conversation) return;
  const message = await database.message.findUnique({ where: { id: event.messageId }, select: { createdAt: true } });
  const now = message?.createdAt ?? new Date();

  const open = await findOpenOpportunity(event.organizationId, conversation.contactId);

  if (event.isFirstInConversation || !open) {
    const decision = shouldOpenOpportunity({
      hasOpenOpportunity: Boolean(open),
      hasOrderInProgress: open ? false : await hasOrderInProgress(event.organizationId, conversation.contact, now),
    });
    if (decision.markOrderInquiry && !conversation.isOrderInquiry) {
      await database.conversation.update({ where: { id: conversation.id }, data: { isOrderInquiry: true } });
      await database.conversationEvent.create({
        data: { conversationId: conversation.id, type: "ORDER_INQUIRY", detail: { reason: "Tiene un pedido ingresado en curso: no abre oportunidad." } },
      });
    }
    if (decision.open || open) {
      const broadcastId = conversation.originAdId ? null : await recentBroadcastId(conversation.contactId, now);
      const origin = originForConversation({ originAdId: conversation.originAdId, repliedToBroadcast: Boolean(broadcastId) });
      await openOpportunity({
        organizationId: event.organizationId,
        contactId: conversation.contactId,
        conversationId: conversation.id,
        origin,
        originRef: conversation.originAdId ?? broadcastId,
        assignedUserId: conversation.assignedUserId,
        actorKind: "SYSTEM",
      });
    }
  }

  if (open) {
    if (open.stage === "NUEVO") {
      // El negocio respondió y el cliente contestó: ya está en contacto (BR-007).
      const outboundBefore = await database.message.count({
        where: { conversationId: conversation.id, direction: "OUTBOUND", createdAt: { lt: now }, status: { notIn: ["FAILED", "CANCELLED"] } },
      });
      if (outboundBefore > 0) {
        await setStage({ organizationId: event.organizationId, opportunityId: open.id, stage: "EN_CONTACTO", actorKind: "SYSTEM", reason: "el cliente contestó" });
      }
    }
    await touchActivity(open.id, now);
  }
}

async function onOrderStatus(event: Extract<DomainEvent, { type: "order.status" }>) {
  // Las consecuencias del estado (ganar, pedido caído) las aplica el servicio de pedidos; aquí solo cuenta como actividad.
  if (event.opportunityId) await touchActivity(event.opportunityId);
}

async function onConversationUpdated(event: Extract<DomainEvent, { type: "conversation.updated" }>) {
  if (event.reason !== "assignment") return;
  const conversation = await database.conversation.findFirst({
    where: { id: event.conversationId, organizationId: event.organizationId },
    select: { id: true, contactId: true, assignedUserId: true },
  });
  if (!conversation) return;
  const open = await findOpenOpportunity(event.organizationId, conversation.contactId);
  if (!open || open.assignedUserId === conversation.assignedUserId) return;
  await database.opportunity.update({ where: { id: open.id }, data: { assignedUserId: conversation.assignedUserId } });
  await database.opportunityEvent.create({
    data: {
      opportunityId: open.id,
      type: "ASSIGNED",
      actorKind: "SYSTEM",
      detail: { from: open.assignedUserId, to: conversation.assignedUserId, reason: "sigue a la conversación" },
    },
  });
}

const globalForSubscriber = globalThis as typeof globalThis & { crmOpportunitySubscriber?: () => void };

/** Abre oportunidades al llegar mensajes y las vence por inactividad (módulo oportunidades). */
export function registerOpportunitySubscriber(): void {
  globalForSubscriber.crmOpportunitySubscriber?.();
  globalForSubscriber.crmOpportunitySubscriber = subscribeToEvents((event) => {
    const task =
      event.type === "message.inbound"
        ? onInbound(event)
        : event.type === "order.status"
          ? onOrderStatus(event)
          : event.type === "conversation.updated"
            ? onConversationUpdated(event)
            : null;
    task?.catch((error) => console.error(`Suscriptor de oportunidades falló en ${event.type}`, error));
  });

  registerLoop({
    name: "oportunidades-vencidas",
    intervalMs: 3_600_000,
    run: async () => {
      const organizations = await database.organization.findMany({ select: { id: true } });
      for (const organization of organizations) {
        await closeStaleOpportunities(organization.id);
      }
    },
  });
}
