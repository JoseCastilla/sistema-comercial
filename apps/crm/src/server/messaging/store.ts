import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { ContactOrigin, MessageOriginKind } from "@/generated/prisma/enums";

import { database } from "../database";
import { publishEvent } from "../events/bus";
import { canWriteFreely } from "./windows";

/**
 * Persistencia de mensajes, común a webhook, bandeja, agente, flujos y
 * difusiones. Aquí no se habla con Meta: el transporte lo hace el módulo
 * `meta` (entrada) y el bucle de envío (salida).
 */

export interface InboundIdentity {
  phoneNumberId: string;
  waUserId?: string | null;
  phone?: string | null;
  profileName?: string | null;
}

export interface InboundMessageInput {
  externalId: string;
  type: string;
  body?: string | null;
  payload?: Prisma.InputJsonValue;
  rawPayload: Prisma.InputJsonValue;
  timestamp: Date;
  referral?: Prisma.InputJsonValue | null;
  media?: { path: string; mimeType: string; sizeBytes: number } | null;
}

function previewOf(type: string, body?: string | null): string {
  if (body && body.trim()) return body.trim().slice(0, 200);
  const labels: Record<string, string> = {
    image: "📷 Imagen",
    audio: "🎤 Audio",
    video: "🎬 Video",
    document: "📄 Documento",
    sticker: "Sticker",
    location: "📍 Ubicación",
    interactive: "Respuesta interactiva",
    button: "Botón",
    template: "Plantilla",
    reaction: "Reacción",
    contacts: "Contacto compartido",
  };
  return labels[type] ?? "Mensaje";
}

/**
 * Registra un mensaje entrante: busca o crea el contacto (por BSUID y teléfono),
 * abre o reutiliza la conversación y guarda el mensaje una sola vez.
 * Devuelve null si el wamid ya estaba registrado.
 */
export async function recordInboundMessage(identity: InboundIdentity, input: InboundMessageInput) {
  const number = await database.whatsappNumber.findUnique({
    where: { phoneNumberId: identity.phoneNumberId },
    select: { id: true, organizationId: true, defaultAiAgentId: true },
  });
  if (!number) {
    throw new Error(`Número ${identity.phoneNumberId} no está conectado`);
  }
  const organizationId = number.organizationId;

  const duplicate = await database.message.findUnique({
    where: { organizationId_externalId: { organizationId, externalId: input.externalId } },
    select: { id: true },
  });
  if (duplicate) return null;

  const contact = await findOrCreateContact(organizationId, identity, input.referral ?? null);

  let conversation = await database.conversation.findFirst({
    where: { organizationId, contactId: contact.id, whatsappNumberId: number.id, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  let isFirstInConversation = false;
  if (!conversation) {
    isFirstInConversation = true;
    const referral = input.referral ?? null;
    const originAdId = extractAdId(referral);
    // Al reabrir, la regla de la organización decide si vuelve al asistente.
    const organization = await database.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { handBackToAgentOnClose: true },
    });
    const previousClosed = await database.conversation.findFirst({
      where: { organizationId, contactId: contact.id, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      select: { assignedUserId: true },
    });
    const aiAvailable = Boolean(number.defaultAiAgentId);
    conversation = await database.conversation.create({
      data: {
        organizationId,
        contactId: contact.id,
        whatsappNumberId: number.id,
        responderState: aiAvailable && (organization.handBackToAgentOnClose || !previousClosed) ? "IA_ACTIVA" : "REQUIERE_ASESOR",
        responderChangedAt: new Date(),
        aiAgentId: number.defaultAiAgentId,
        assignedUserId: previousClosed?.assignedUserId ?? null,
        originReferral: referral ?? undefined,
        originAdId,
        // 72 h gratis si viene de un anuncio; el negocio debe responder en 24 h.
        freeUntil: referral ? new Date(input.timestamp.getTime() + 72 * 3_600_000) : null,
      },
    });
    await database.conversationEvent.create({
      data: { conversationId: conversation.id, type: "OPENED", detail: { origin: originAdId ? "AD" : "ORGANIC" } },
    });
  }

  const message = await database.message.create({
    data: {
      organizationId,
      conversationId: conversation.id,
      direction: "INBOUND",
      externalId: input.externalId,
      type: input.type,
      body: input.body ?? null,
      payload: input.payload,
      rawPayload: input.rawPayload,
      mediaPath: input.media?.path ?? null,
      mediaMimeType: input.media?.mimeType ?? null,
      mediaSizeBytes: input.media?.sizeBytes ?? null,
      status: "RECEIVED",
      originKind: "CONTACT",
      createdAt: input.timestamp,
    },
  });

  await database.conversation.update({
    where: { id: conversation.id },
    data: {
      lastInboundAt: input.timestamp,
      lastMessageAt: input.timestamp,
      lastMessagePreview: previewOf(input.type, input.body),
      unreadCount: { increment: 1 },
      unattendedSince: conversation.responderState === "IA_ACTIVA" ? null : conversation.unattendedSince ?? input.timestamp,
    },
  });
  await database.contact.update({
    where: { id: contact.id },
    data: { lastInboundAt: input.timestamp, displayName: contact.displayName ?? identity.profileName ?? undefined },
  });

  // Escribir primero da consentimiento de servicio (SPEC-053 BR-019).
  if (isFirstInConversation) {
    await database.contactConsent.create({
      data: { organizationId, contactId: contact.id, category: "SERVICE", granted: true, source: "escribió primero" },
    });
  }
  await detectOptOut(organizationId, contact.id, input.body);

  publishEvent({
    type: "message.inbound",
    organizationId,
    conversationId: conversation.id,
    contactId: contact.id,
    messageId: message.id,
    isFirstInConversation,
  });
  publishEvent({ type: "conversation.updated", organizationId, conversationId: conversation.id, reason: "inbound" });

  return { message, conversation, contact, isFirstInConversation };
}

function extractAdId(referral: Prisma.InputJsonValue | null): string | null {
  if (!referral || typeof referral !== "object" || Array.isArray(referral)) return null;
  const sourceId = (referral as Record<string, unknown>).source_id;
  return typeof sourceId === "string" ? sourceId : null;
}

async function findOrCreateContact(organizationId: string, identity: InboundIdentity, referral: Prisma.InputJsonValue | null) {
  const waUserId = identity.waUserId?.trim() || null;
  const phone = identity.phone?.replace(/\D/g, "") || null;

  const byUser = waUserId
    ? await database.contact.findUnique({ where: { organizationId_waUserId: { organizationId, waUserId } } })
    : null;
  const byPhone = !byUser && phone
    ? await database.contact.findUnique({ where: { organizationId_phone: { organizationId, phone } } })
    : null;
  const existing = byUser ?? byPhone;

  if (existing) {
    const data: Prisma.ContactUpdateInput = {};
    if (!existing.waUserId && waUserId) data.waUserId = waUserId;
    if (!existing.phone && phone) data.phone = phone;
    if (!existing.displayName && identity.profileName) data.displayName = identity.profileName;
    return Object.keys(data).length ? database.contact.update({ where: { id: existing.id }, data }) : existing;
  }

  const adId = extractAdId(referral);
  const initialOrigin: ContactOrigin = adId ? "AD" : "ORGANIC";
  return database.contact.create({
    data: {
      organizationId,
      waUserId,
      phone,
      displayName: identity.profileName ?? null,
      initialOrigin,
      initialOriginRef: adId,
    },
  });
}

const OPT_OUT_WORDS = ["baja", "stop", "no molestar", "no me escriban", "no me escribas", "cancelar suscripcion", "cancelar suscripción"];

async function detectOptOut(organizationId: string, contactId: string, body?: string | null) {
  const text = body?.trim().toLowerCase();
  if (!text || !OPT_OUT_WORDS.includes(text)) return;
  await database.contact.update({ where: { id: contactId }, data: { marketingOptIn: false, marketingOptOutAt: new Date() } });
  await database.contactConsent.create({
    data: { organizationId, contactId, category: "MARKETING", granted: false, source: "palabra de baja", evidenceText: body },
  });
}

export interface OutboundTextInput {
  kind: "text";
  body: string;
}
export interface OutboundTemplateInput {
  kind: "template";
  templateId: string;
  /** Valores de las variables del cuerpo, en orden. */
  bodyParameters: string[];
  /** Vista previa ya renderizada para la bandeja. */
  renderedBody: string;
}
export interface OutboundInteractiveInput {
  kind: "interactive";
  body: string;
  /** Hasta 3 botones de respuesta rápida. */
  buttons: { id: string; title: string }[];
}
export type OutboundInput = OutboundTextInput | OutboundTemplateInput | OutboundInteractiveInput;

export class OutboundRejectedError extends Error {}

/**
 * Encola un mensaje saliente. Aplica la ventana de 24 h (solo plantillas si
 * está cerrada) y la idempotencia por `clientRequestId`. El bucle de envío se
 * encarga de hablar con Meta.
 */
export async function enqueueOutboundMessage(input: {
  conversationId: string;
  originKind: MessageOriginKind;
  originRef?: string | null;
  senderUserId?: string | null;
  clientRequestId?: string | null;
  content: OutboundInput;
}) {
  const conversation = await database.conversation.findUniqueOrThrow({
    where: { id: input.conversationId },
    select: { id: true, organizationId: true, lastInboundAt: true, status: true },
  });
  const clientRequestId = input.clientRequestId ?? randomUUID();
  const existing = await database.message.findUnique({
    where: { organizationId_clientRequestId: { organizationId: conversation.organizationId, clientRequestId } },
  });
  if (existing) return existing;

  const now = new Date();
  if (input.content.kind !== "template" && !canWriteFreely(conversation.lastInboundAt, now)) {
    throw new OutboundRejectedError("Ya no puedes escribirle libremente: usa una plantilla.");
  }

  const body =
    input.content.kind === "template" ? input.content.renderedBody : input.content.body;
  const payload: Prisma.InputJsonValue =
    input.content.kind === "template"
      ? { templateId: input.content.templateId, bodyParameters: input.content.bodyParameters }
      : input.content.kind === "interactive"
        ? { buttons: input.content.buttons }
        : {};

  const message = await database.message.create({
    data: {
      organizationId: conversation.organizationId,
      conversationId: conversation.id,
      direction: "OUTBOUND",
      type: input.content.kind,
      body,
      payload,
      status: "QUEUED",
      originKind: input.originKind,
      originRef: input.originRef ?? null,
      senderUserId: input.senderUserId ?? null,
      templateId: input.content.kind === "template" ? input.content.templateId : null,
      clientRequestId,
      outboundJob: { create: {} },
    },
  });

  await database.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: now,
      lastMessagePreview: previewOf(input.content.kind, body),
      status: "OPEN",
      closedAt: null,
      // Un asesor que responde deja de estar «sin atender».
      ...(input.originKind === "USER" ? { unattendedSince: null } : {}),
    },
  });
  if (input.originKind === "USER") {
    await database.conversation.updateMany({
      where: { id: conversation.id, firstResponseAt: null },
      data: { firstResponseAt: now },
    });
  }

  publishEvent({
    type: "message.outbound.queued",
    organizationId: conversation.organizationId,
    conversationId: conversation.id,
    messageId: message.id,
  });
  publishEvent({ type: "conversation.updated", organizationId: conversation.organizationId, conversationId: conversation.id, reason: "outbound" });
  return message;
}

/** Cancela lo que aún no salió (tomar control, cerrar flujo). Devuelve cuántos. */
export async function cancelPendingOutbound(conversationId: string, originKinds: MessageOriginKind[] = ["AGENT_AI", "WORKFLOW", "BROADCAST"]) {
  const pending = await database.message.findMany({
    where: { conversationId, direction: "OUTBOUND", status: "QUEUED", originKind: { in: originKinds } },
    select: { id: true, organizationId: true },
  });
  if (!pending.length) return 0;
  const ids = pending.map((m) => m.id);
  await database.outboundJob.updateMany({ where: { messageId: { in: ids }, status: { in: ["PENDING", "SENDING"] } }, data: { status: "CANCELLED" } });
  await database.message.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED" } });
  for (const m of pending) {
    publishEvent({ type: "message.status", organizationId: m.organizationId, conversationId, messageId: m.id, status: "CANCELLED" });
  }
  return ids.length;
}

/** Actualiza el estado de un mensaje enviado según el webhook `statuses`. Solo avanza. */
const STATUS_ORDER: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 9, CANCELLED: 9 };

export async function applyDeliveryStatus(organizationId: string, externalId: string, status: "SENT" | "DELIVERED" | "READ" | "FAILED", at: Date, error?: { code?: string; title?: string }) {
  const message = await database.message.findUnique({
    where: { organizationId_externalId: { organizationId, externalId } },
    select: { id: true, status: true, conversationId: true },
  });
  if (!message) return null;
  if ((STATUS_ORDER[status] ?? 0) <= (STATUS_ORDER[message.status] ?? 0) && status !== "FAILED") return message;
  const updated = await database.message.update({
    where: { id: message.id },
    data: {
      status,
      ...(status === "SENT" ? { sentAt: at } : {}),
      ...(status === "DELIVERED" ? { deliveredAt: at } : {}),
      ...(status === "READ" ? { readAt: at } : {}),
      ...(status === "FAILED" ? { errorCode: error?.code ?? null, errorTitle: error?.title ?? null } : {}),
    },
  });
  publishEvent({ type: "message.status", organizationId, conversationId: message.conversationId, messageId: message.id, status });
  return updated;
}
