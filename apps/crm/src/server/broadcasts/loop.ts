import "server-only";

import { database } from "../database";
import { subscribeToEvents, type DomainEvent } from "../events/bus";
import { registerLoop } from "../background/registry";
import { sendTemplateToConversation } from "../templates/send";
import { brakeDecision, dayKey, withinSendWindow } from "./rules";
import { parseStoredSegment } from "./segments";
import { pauseByBrake } from "./service";

/**
 * Envío escalonado de difusiones (SPEC-059 BR-008 a BR-010).
 *
 * Cada vuelta: arranca lo que ya tocaba, encola un puñado de destinatarios
 * dentro del horario permitido, refresca lo que Meta fue contando y frena la
 * difusión si la gente la está rechazando. El transporte a Meta lo hace el
 * bucle de salida: acá solo se encola.
 */

const LOOP_NAME = "difusiones";
const INTERVAL_MS = 10_000;
/** Cuántos se encolan por vuelta. A 10 s son 120 por minuto como techo. */
const BATCH = 20;

/** Códigos de Meta que significan que la persona bloqueó al negocio. */
const BLOCK_ERROR_CODES = ["131050", "131051"];

const RANK: Record<string, number> = {
  PENDING: 0,
  QUEUED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
  REPLIED: 5,
  FAILED: 9,
  CANCELLED: 9,
  EXCLUDED: 9,
};

/** Estado del mensaje → estado del destinatario. Solo avanza. */
function recipientStatusFor(messageStatus: string, current: string): string | null {
  const next =
    messageStatus === "SENT" ? "SENT"
      : messageStatus === "DELIVERED" ? "DELIVERED"
        : messageStatus === "READ" ? "READ"
          : messageStatus === "FAILED" ? "FAILED"
            : messageStatus === "CANCELLED" ? "CANCELLED"
              : null;
  if (!next || next === current) return null;
  // Quien ya respondió no vuelve a «entregado» porque llegue un acuse tarde.
  if (current === "REPLIED" && next !== "FAILED") return null;
  if ((RANK[next] ?? 0) <= (RANK[current] ?? 0) && next !== "FAILED" && next !== "CANCELLED") return null;
  return next;
}

// ───────────────────────── (a) Arrancar lo programado ─────────────────────────

async function startDue(now: Date): Promise<void> {
  const due = await database.broadcast.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, startedAt: true },
  });
  for (const broadcast of due) {
    await database.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "SENDING", startedAt: broadcast.startedAt ?? now },
    });
  }
}

// ───────────────────────── (b) Encolar destinatarios ─────────────────────────

/** Contactos cuyo día programado ya llegó. Vacío significa «todos». */
function dueContactIds(segment: unknown, now: Date): Set<string> | null {
  const plan = parseStoredSegment(segment).schedulePlan;
  if (!plan || !Object.keys(plan).length) return null;
  const today = dayKey(now);
  const due = new Set<string>();
  for (const [day, contactIds] of Object.entries(plan)) {
    if (day <= today) for (const contactId of contactIds) due.add(contactId);
  }
  return due;
}

async function conversationFor(
  organizationId: string,
  contactId: string,
  whatsappNumberId: string,
): Promise<string> {
  const open = await database.conversation.findFirst({
    where: { organizationId, contactId, whatsappNumberId, status: "OPEN" },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true },
  });
  if (open) return open.id;
  // Conversación nueva por difusión: la persona no escribió, así que no hay
  // ventana de 24 h abierta y solo puede atenderla una persona.
  const created = await database.conversation.create({
    data: {
      organizationId,
      contactId,
      whatsappNumberId,
      status: "OPEN",
      responderState: "REQUIERE_ASESOR",
      responderChangedAt: new Date(),
    },
    select: { id: true },
  });
  await database.conversationEvent.create({
    data: { conversationId: created.id, type: "OPENED", detail: { origin: "BROADCAST" } },
  });
  return created.id;
}

interface SendingBroadcast {
  id: string;
  organizationId: string;
  whatsappNumberId: string;
  templateId: string;
  name: string;
  segment: unknown;
  variableValues: unknown;
}

function manualValuesOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" && raw.trim()) out[key] = raw.trim();
  }
  return out;
}

async function enqueueBatch(broadcast: SendingBroadcast, now: Date): Promise<void> {
  const due = dueContactIds(broadcast.segment, now);
  const candidates = await database.broadcastRecipient.findMany({
    where: { broadcastId: broadcast.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: BATCH * 5,
    select: { id: true, contactId: true },
  });
  const batch = (due ? candidates.filter((row) => due.has(row.contactId)) : candidates).slice(0, BATCH);
  if (!batch.length) return;

  const values = manualValuesOf(broadcast.variableValues);
  for (const recipient of batch) {
    try {
      const conversationId = await conversationFor(broadcast.organizationId, recipient.contactId, broadcast.whatsappNumberId);
      const message = await sendTemplateToConversation({
        conversationId,
        templateId: broadcast.templateId,
        manualValues: values,
        originKind: "BROADCAST",
        originRef: broadcast.id,
        clientRequestId: `bc:${broadcast.id}:${recipient.contactId}`,
      });
      await database.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { messageId: message.id, status: "QUEUED", exclusionReason: null },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // No hay columna para el motivo del fallo al encolar: se reusa la del
      // motivo de exclusión para que la persona vea qué pasó (ver informe).
      await database.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", exclusionReason: reason.slice(0, 120) },
      });
      console.error(`Difusión ${broadcast.id}: no se pudo encolar a ${recipient.contactId}`, error);
    }
  }
}

// ───────────────────────── (c) Refrescar y frenar ─────────────────────────

async function refreshStatuses(broadcastId: string): Promise<void> {
  const inFlight = await database.broadcastRecipient.findMany({
    where: { broadcastId, status: { in: ["QUEUED", "SENT", "DELIVERED", "READ"] }, messageId: { not: null } },
    select: { id: true, status: true, message: { select: { status: true } } },
  });
  for (const recipient of inFlight) {
    const next = recipient.message ? recipientStatusFor(recipient.message.status, recipient.status) : null;
    if (next) await database.broadcastRecipient.update({ where: { id: recipient.id }, data: { status: next } });
  }
}

async function evaluateBrake(broadcast: { id: string; organizationId: string; startedAt: Date | null }): Promise<boolean> {
  const rows = await database.broadcastRecipient.groupBy({
    by: ["status"],
    where: { broadcastId: broadcast.id },
    _count: { _all: true },
  });
  const total = (statuses: string[]) =>
    rows.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);

  const delivered = total(["DELIVERED", "READ", "REPLIED"]);
  const failed = total(["FAILED"]);
  const sent = delivered + failed + total(["SENT"]);

  const [blocked, optOuts] = await Promise.all([
    database.broadcastRecipient.count({
      where: { broadcastId: broadcast.id, status: "FAILED", message: { errorCode: { in: BLOCK_ERROR_CODES } } },
    }),
    broadcast.startedAt
      ? database.contact.count({
          where: {
            organizationId: broadcast.organizationId,
            marketingOptOutAt: { gte: broadcast.startedAt },
            recipients: { some: { broadcastId: broadcast.id, status: { in: ["SENT", "DELIVERED", "READ", "REPLIED"] } } },
          },
        })
      : Promise.resolve(0),
  ]);

  const decision = brakeDecision({ delivered, failed, optOuts, blocked, sent });
  if (!decision.pause) return false;
  await pauseByBrake(broadcast.id, decision.reason);
  return true;
}

// ───────────────────────── Vuelta completa ─────────────────────────

async function tick(): Promise<void> {
  const now = new Date();
  await startDue(now);

  const sending = await database.broadcast.findMany({
    where: { status: "SENDING" },
    select: {
      id: true,
      organizationId: true,
      whatsappNumberId: true,
      templateId: true,
      name: true,
      segment: true,
      variableValues: true,
      startedAt: true,
      organization: { select: { timezone: true } },
    },
  });

  for (const broadcast of sending) {
    try {
      await refreshStatuses(broadcast.id);
      if (await evaluateBrake(broadcast)) continue;

      // La franja horaria solo detiene lo que aún no salió (BR-006).
      if (withinSendWindow(now, broadcast.organization.timezone)) {
        await enqueueBatch(broadcast, now);
      }

      const remaining = await database.broadcastRecipient.count({
        where: { broadcastId: broadcast.id, status: { in: ["PENDING", "QUEUED"] } },
      });
      if (remaining === 0) {
        await database.broadcast.update({ where: { id: broadcast.id }, data: { status: "DONE", finishedAt: new Date() } });
      }
    } catch (error) {
      console.error(`Difusión ${broadcast.id}: falló la vuelta del bucle`, error);
    }
  }
}

// ───────────────────────── Eventos ─────────────────────────

/** Una respuesta cuenta como respuesta a la difusión hasta 7 días después. */
const REPLY_WINDOW_DAYS = 7;

async function onInbound(event: Extract<DomainEvent, { type: "message.inbound" }>): Promise<void> {
  const since = new Date(Date.now() - REPLY_WINDOW_DAYS * 86_400_000);
  const recipient = await database.broadcastRecipient.findFirst({
    where: {
      contactId: event.contactId,
      status: { in: ["SENT", "DELIVERED", "READ"] },
      broadcast: { organizationId: event.organizationId },
      message: { createdAt: { gte: since } },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, broadcast: { select: { id: true, name: true } } },
  });
  if (!recipient) return;

  await database.broadcastRecipient.update({
    where: { id: recipient.id },
    data: { status: "REPLIED", repliedAt: new Date() },
  });
  // BR-012: la bandeja muestra de qué difusión viene la respuesta.
  await database.conversationEvent.create({
    data: {
      conversationId: event.conversationId,
      type: "BROADCAST_REPLY",
      detail: { broadcastId: recipient.broadcast.id, name: recipient.broadcast.name, text: `Respondió a la difusión «${recipient.broadcast.name}»` },
    },
  });
}

async function onStatus(event: Extract<DomainEvent, { type: "message.status" }>): Promise<void> {
  const recipient = await database.broadcastRecipient.findFirst({
    where: { messageId: event.messageId },
    select: { id: true, status: true },
  });
  if (!recipient) return;
  const next = recipientStatusFor(event.status, recipient.status);
  if (next) await database.broadcastRecipient.update({ where: { id: recipient.id }, data: { status: next } });
}

const globalForBroadcasts = globalThis as typeof globalThis & { crmBroadcastSubscriber?: () => void };

/** Envío escalonado de difusiones (módulo difusiones). */
export function registerBroadcastLoop(): void {
  globalForBroadcasts.crmBroadcastSubscriber?.();
  globalForBroadcasts.crmBroadcastSubscriber = subscribeToEvents((event) => {
    const task =
      event.type === "message.inbound"
        ? onInbound(event)
        : event.type === "message.status"
          ? onStatus(event)
          : null;
    task?.catch((error) => console.error(`Difusiones: falló el suscriptor de ${event.type}`, error));
  });

  registerLoop({ name: LOOP_NAME, intervalMs: INTERVAL_MS, run: tick });
}
