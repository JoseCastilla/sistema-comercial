import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { WebhookProcessingStatus } from "@/generated/prisma/enums";

import { database } from "../database";
import { decryptSecret } from "../crypto";
import { publishEvent } from "../events/bus";
import { applyDeliveryStatus, recordInboundMessage } from "../messaging/store";
import { describeMetaError } from "./errors";
import { downloadInboundMedia } from "./media";
import {
  extractChanges,
  externalIdsFor,
  isMarketingOptOut,
  limitTierFrom,
  parseInboundMessages,
  parseNumberUpdate,
  parseStatuses,
  parseTemplateUpdate,
  parseUserPreferences,
  phoneNumberIdOf,
  type WebhookChange,
} from "./parse";
import { metaTemplateStatusToLocal } from "./status-text";

/**
 * Recepción y proceso de los webhooks de Meta.
 *
 * La ruta HTTP solo verifica la firma, guarda un `WebhookEvent` por ítem
 * (idempotente) y responde 200. El proceso ocurre después: si algo falla, el
 * evento queda en `FAILED` con el motivo y la evidencia intacta.
 */

interface StoredPayload {
  field: string;
  entryId: string | null;
  externalId: string;
  value: Record<string, unknown>;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/** Número conectado al que apunta un cambio: por phone_number_id o por WABA. */
async function resolveNumber(change: Pick<WebhookChange, "value" | "entryId">) {
  const phoneNumberId = phoneNumberIdOf(change.value);
  if (phoneNumberId) {
    const byPhone = await database.whatsappNumber.findUnique({
      where: { phoneNumberId },
      select: { id: true, organizationId: true, wabaId: true, accessTokenCiphertext: true, displayPhoneNumber: true },
    });
    if (byPhone) return byPhone;
  }
  if (change.entryId) {
    return database.whatsappNumber.findFirst({
      where: { wabaId: change.entryId },
      select: { id: true, organizationId: true, wabaId: true, accessTokenCiphertext: true, displayPhoneNumber: true },
      orderBy: { createdAt: "asc" },
    });
  }
  return null;
}

/**
 * Guarda un evento por ítem del webhook. Devuelve los ids nuevos: los
 * repetidos se ignoran sin error (Meta reenvía el lote si no ve el 200).
 */
export async function ingestWebhook(body: unknown): Promise<string[]> {
  const created: string[] = [];
  for (const change of extractChanges(body)) {
    const number = await resolveNumber(change);
    for (const { externalId } of externalIdsFor(change)) {
      const payload: StoredPayload = { field: change.field, entryId: change.entryId, externalId, value: change.value };
      try {
        const event = await database.webhookEvent.create({
          data: {
            source: "META_WHATSAPP",
            externalId,
            organizationId: number?.organizationId ?? null,
            payload: payload as unknown as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
        created.push(event.id);
      } catch (error) {
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }
  }
  return created;
}

interface Outcome {
  status: WebhookProcessingStatus;
  organizationId?: string | null;
  /** Por qué se ignoró, para poder explicarlo después. */
  reason?: string | null;
  /** Datos normalizados que se agregan al payload guardado (precio, entrega…). */
  patch?: Record<string, unknown>;
}

/** Procesa un evento ya guardado. Nunca lanza: deja el motivo en el evento. */
export async function processWebhookEvent(eventId: string): Promise<void> {
  const event = await database.webhookEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === "PROCESSED") return;
  const payload = event.payload as unknown as StoredPayload | null;
  if (!payload?.field) {
    await database.webhookEvent.update({
      where: { id: eventId },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: "El evento se guardó sin contenido", processedAt: new Date() },
    });
    return;
  }
  try {
    const outcome = await handleChange(payload);
    await database.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: outcome.status,
        attempts: { increment: 1 },
        processedAt: new Date(),
        lastError: outcome.reason ?? null,
        ...(outcome.organizationId ? { organizationId: outcome.organizationId } : {}),
        ...(outcome.patch ? { payload: { ...payload, ...outcome.patch } as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Webhook de Meta ${payload.externalId} falló`, error);
    await database.webhookEvent.update({
      where: { id: eventId },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: message.slice(0, 1000), processedAt: new Date() },
    });
  }
}

/** Procesa en segundo plano lo que se acaba de guardar, sin bloquear la respuesta. */
export function processInBackground(eventIds: string[]): void {
  if (!eventIds.length) return;
  setImmediate(() => {
    void (async () => {
      for (const id of eventIds) {
        await processWebhookEvent(id);
      }
    })();
  });
}

async function handleChange(payload: StoredPayload): Promise<Outcome> {
  const { field, externalId, value } = payload;
  if (externalId.startsWith("msg:")) return handleInboundMessage(payload, externalId.slice(4));
  if (externalId.startsWith("status:")) return handleDeliveryStatus(payload, externalId.slice(7));
  if (field.includes("template")) return handleTemplateUpdate(payload);
  if (field === "phone_number_quality_update" || field === "account_update" || field === "phone_number_name_update") {
    return handleNumberUpdate(payload);
  }
  if (field === "user_preferences") return handleUserPreferences(payload);
  return { status: "IGNORED", reason: `Meta envió «${field}»: este sistema todavía no lo usa`, patch: { ignored: field, keys: Object.keys(value) } };
}

// ───────────────────────── Mensajes entrantes ─────────────────────────

async function handleInboundMessage(payload: StoredPayload, wamid: string): Promise<Outcome> {
  const parsed = parseInboundMessages(payload.value).find((message) => message.externalId === wamid);
  if (!parsed) return { status: "IGNORED", reason: "El webhook ya no trae ese mensaje" };

  const number = await database.whatsappNumber.findUnique({
    where: { phoneNumberId: parsed.phoneNumberId },
    select: { id: true, organizationId: true, accessTokenCiphertext: true },
  });
  if (!number) {
    return { status: "IGNORED", reason: `El número ${parsed.phoneNumberId} no está conectado en este sistema` };
  }

  let media: { path: string; mimeType: string; sizeBytes: number } | null = null;
  let mediaError: string | null = null;
  if (parsed.media) {
    try {
      media = await downloadInboundMedia({
        token: decryptSecret(number.accessTokenCiphertext),
        organizationId: number.organizationId,
        wamid,
        media: parsed.media,
      });
    } catch (error) {
      // El adjunto se pierde, pero el mensaje tiene que llegar a la bandeja.
      mediaError = describeMetaError(error);
    }
  }

  const messagePayload: Record<string, unknown> = { ...parsed.payload };
  if (parsed.media) {
    messagePayload.media = {
      mediaId: parsed.media.mediaId,
      filename: parsed.media.filename,
      mimeType: media?.mimeType ?? parsed.media.mimeType,
    };
  }
  if (mediaError) messagePayload.mediaError = mediaError;

  const result = await recordInboundMessage(
    {
      phoneNumberId: parsed.phoneNumberId,
      waUserId: parsed.waUserId,
      phone: parsed.phone,
      profileName: parsed.profileName,
    },
    {
      externalId: parsed.externalId,
      type: parsed.type,
      body: parsed.body,
      payload: messagePayload as Prisma.InputJsonValue,
      rawPayload: parsed.raw as Prisma.InputJsonValue,
      timestamp: parsed.timestamp,
      referral: (parsed.referral ?? undefined) as Prisma.InputJsonValue | undefined,
      media,
    },
  );

  return {
    status: "PROCESSED",
    organizationId: number.organizationId,
    reason: mediaError ? `No se pudo descargar el adjunto: ${mediaError}` : null,
    patch: result ? undefined : { duplicate: true },
  };
}

// ───────────────────────── Estados de entrega ─────────────────────────

async function handleDeliveryStatus(payload: StoredPayload, key: string): Promise<Outcome> {
  const [wamid, rawStatus] = [key.slice(0, key.lastIndexOf(":")), key.slice(key.lastIndexOf(":") + 1)];
  const parsed = parseStatuses(payload.value).find((item) => item.wamid === wamid && item.rawStatus === rawStatus);
  if (!parsed) return { status: "IGNORED", reason: "El webhook ya no trae ese estado" };

  const phoneNumberId = phoneNumberIdOf(payload.value);
  const number = phoneNumberId
    ? await database.whatsappNumber.findUnique({ where: { phoneNumberId }, select: { organizationId: true } })
    : null;
  if (!number) return { status: "IGNORED", reason: `El número ${phoneNumberId ?? "que informa Meta"} no está conectado` };

  const updated = await applyDeliveryStatus(number.organizationId, parsed.wamid, parsed.status, parsed.at, {
    code: parsed.errorCode ?? undefined,
    title: parsed.errorTitle ?? undefined,
  });

  // No hay columna para el precio: queda en el evento, que es evidencia.
  const patch: Record<string, unknown> = {};
  if (parsed.pricing) patch.pricing = parsed.pricing;
  if (parsed.conversation) patch.conversation = parsed.conversation;

  if (!updated) {
    return { status: "IGNORED", organizationId: number.organizationId, reason: "El mensaje no es de este sistema", patch };
  }
  return { status: "PROCESSED", organizationId: number.organizationId, patch: Object.keys(patch).length ? patch : undefined };
}

// ───────────────────────── Plantillas ─────────────────────────

async function handleTemplateUpdate(payload: StoredPayload): Promise<Outcome> {
  const update = parseTemplateUpdate(payload.field, payload.value);
  if (!update) return { status: "IGNORED", reason: "El aviso de plantilla llegó sin identificador ni nombre" };

  const numbers = payload.entryId
    ? await database.whatsappNumber.findMany({ where: { wabaId: payload.entryId }, select: { id: true, organizationId: true } })
    : [];
  const numberIds = numbers.map((number) => number.id);

  const template = update.externalId
    ? await database.messageTemplate.findFirst({
        where: { externalId: update.externalId, ...(numberIds.length ? { whatsappNumberId: { in: numberIds } } : {}) },
      })
    : update.name
      ? await database.messageTemplate.findFirst({
          where: {
            name: update.name,
            ...(update.language ? { language: update.language } : {}),
            ...(numberIds.length ? { whatsappNumberId: { in: numberIds } } : {}),
          },
        })
      : null;
  if (!template) {
    return { status: "IGNORED", reason: `La plantilla «${update.name ?? update.externalId}» no está en la biblioteca: sincronízala` };
  }

  const data: Prisma.MessageTemplateUpdateInput = { lastSyncedAt: new Date() };
  if (payload.field === "message_template_status_update" && update.event) {
    const status = metaTemplateStatusToLocal(update.event);
    data.status = status;
    data.rejectedReason = status === "REJECTED" ? update.rejectedReason ?? "Meta no dio el motivo" : null;
    data.pausedUntil = status === "PAUSED" ? update.pausedUntil : null;
  }
  const category = update.newCategory?.toUpperCase();
  if (category === "MARKETING" || category === "UTILITY" || category === "AUTHENTICATION") data.category = category;
  if (update.qualityScore) data.qualityScore = update.qualityScore.toUpperCase();
  if (update.externalId && !template.externalId) data.externalId = update.externalId;

  const saved = await database.messageTemplate.update({ where: { id: template.id }, data });
  publishEvent({ type: "template.updated", organizationId: saved.organizationId, templateId: saved.id, status: saved.status });
  return { status: "PROCESSED", organizationId: saved.organizationId };
}

// ───────────────────────── Número y cuenta ─────────────────────────

async function handleNumberUpdate(payload: StoredPayload): Promise<Outcome> {
  const update = parseNumberUpdate(payload.field, payload.value);
  const digits = update.displayPhoneNumber?.replace(/\D/g, "") ?? null;

  const candidates = await database.whatsappNumber.findMany({
    where: payload.entryId ? { wabaId: payload.entryId } : { phoneNumberId: phoneNumberIdOf(payload.value) ?? "" },
    select: { id: true, organizationId: true, displayPhoneNumber: true },
  });
  const targets = digits
    ? candidates.filter((number) => (number.displayPhoneNumber ?? "").replace(/\D/g, "") === digits)
    : candidates;
  if (!targets.length) {
    return { status: "IGNORED", reason: `Meta informó de ${update.displayPhoneNumber ?? "una cuenta"} que no está conectada aquí` };
  }

  const event = update.event?.toUpperCase() ?? null;
  const data: Prisma.WhatsappNumberUpdateInput = {};
  const tier = limitTierFrom(update.currentLimit);
  if (tier) data.messagingLimitTier = tier;
  // Meta no manda la calidad como tal en estos avisos: FLAGGED/UNFLAGGED es lo que hay.
  if (event === "FLAGGED") data.qualityRating = "RED";
  if (event === "UNFLAGGED") data.qualityRating = "GREEN";
  if (update.restricted) {
    data.status = "RESTRICTED";
    data.lastError = `Meta restringió la cuenta (${event ?? payload.field}): no puedes iniciar conversaciones nuevas hasta que lo levante.`;
  } else if (event === "UNFLAGGED" || event === "VERIFIED_ACCOUNT" || event === "APPROVED") {
    data.status = "CONNECTED";
    data.lastError = null;
  }
  if (!Object.keys(data).length) {
    return { status: "IGNORED", organizationId: targets[0]?.organizationId, reason: `Meta envió «${event ?? payload.field}»: no cambia nada aquí` };
  }

  for (const target of targets) {
    await database.whatsappNumber.update({ where: { id: target.id }, data });
    publishEvent({ type: "whatsapp.number.updated", organizationId: target.organizationId, numberId: target.id });
  }
  return { status: "PROCESSED", organizationId: targets[0]?.organizationId };
}

// ───────────────────────── Baja de marketing ─────────────────────────

async function handleUserPreferences(payload: StoredPayload): Promise<Outcome> {
  const number = await resolveNumber({ value: payload.value, entryId: payload.entryId });
  if (!number) return { status: "IGNORED", reason: "El número que informa Meta no está conectado" };

  const preferences = parseUserPreferences(payload.value).filter(isMarketingOptOut);
  if (!preferences.length) {
    return { status: "IGNORED", organizationId: number.organizationId, reason: "La persona volvió a aceptar marketing o no cambió nada" };
  }

  let applied = 0;
  for (const preference of preferences) {
    const phone = preference.waId.replace(/\D/g, "");
    const contact = await database.contact.findUnique({
      where: { organizationId_phone: { organizationId: number.organizationId, phone } },
      select: { id: true },
    });
    if (!contact) continue;
    await database.contact.update({
      where: { id: contact.id },
      data: { marketingOptIn: false, marketingOptOutAt: preference.at },
    });
    await database.contactConsent.create({
      data: {
        organizationId: number.organizationId,
        contactId: contact.id,
        category: "MARKETING",
        granted: false,
        source: "webhook user_preferences",
        evidenceText: preference.detail ?? "La persona pidió dejar de recibir marketing desde WhatsApp",
      },
    });
    applied += 1;
  }
  if (!applied) {
    return { status: "IGNORED", organizationId: number.organizationId, reason: "Esa persona todavía no es un contacto del sistema" };
  }
  return { status: "PROCESSED", organizationId: number.organizationId };
}
