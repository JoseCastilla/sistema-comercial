import "server-only";

import { registerLoop } from "../background/registry";
import { database } from "../database";
import { publishEvent } from "../events/bus";
import { isWithinBusinessHours } from "@/lib/time";
import { assignConversation } from "./conversation-state";

/**
 * SPEC-054 BR-007: conversación asignada sin respuesta → «sin atender» y luego
 * vuelve a la cola. Los tiempos son de la organización. Solo en horario.
 */
export function registerUnattendedLoop() {
  registerLoop({
    name: "conversaciones-sin-atender",
    intervalMs: 60_000,
    run: async () => {
      const now = new Date();
      const organizations = await database.organization.findMany({
        select: { id: true, timezone: true, businessHours: true, unattendedAfterMinutes: true, returnToQueueAfterMinutes: true },
      });
      for (const organization of organizations) {
        const hours = organization.businessHours as { days: number[]; start: string; end: string };
        if (!isWithinBusinessHours(now, hours, organization.timezone)) continue;

        const candidates = await database.conversation.findMany({
          where: {
            organizationId: organization.id,
            status: "OPEN",
            responderState: { not: "IA_ACTIVA" },
            unattendedSince: { not: null },
          },
          select: { id: true, unattendedSince: true, assignedUserId: true, events: { where: { type: "UNATTENDED" }, take: 1, orderBy: { createdAt: "desc" } } },
        });
        for (const conversation of candidates) {
          const minutes = (now.getTime() - conversation.unattendedSince!.getTime()) / 60_000;
          if (conversation.assignedUserId && minutes >= organization.returnToQueueAfterMinutes) {
            await assignConversation({ conversationId: conversation.id, userId: null, reason: `sin respuesta en ${organization.returnToQueueAfterMinutes} min`, type: "RETURNED" });
            await database.conversation.update({ where: { id: conversation.id }, data: { unattendedSince: now } });
            continue;
          }
          if (minutes >= organization.unattendedAfterMinutes && !conversation.events.length) {
            await database.conversationEvent.create({ data: { conversationId: conversation.id, type: "UNATTENDED", detail: { minutes: Math.round(minutes) } } });
            publishEvent({ type: "conversation.unanswered", organizationId: organization.id, conversationId: conversation.id, minutes: Math.round(minutes) });
            publishEvent({ type: "conversation.updated", organizationId: organization.id, conversationId: conversation.id, reason: "unattended" });
          }
        }
      }
    },
  });
}
