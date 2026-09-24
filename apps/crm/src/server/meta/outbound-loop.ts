import "server-only";

import { registerLoop } from "../background/registry";
import { database } from "../database";
import { decryptSecret } from "../crypto";
import { publishEvent } from "../events/bus";
import { templateBodyText } from "../templates/render";
import { classifyMetaError, describeMetaError, MetaApiError } from "./errors";
import {
  markAsRead,
  sendMessage,
  type MetaMessagePayload,
  type MetaTemplateComponent,
  type MetaTemplateParameter,
} from "./graph";
import { nextAttemptAt } from "./retry";

/**
 * Bucle de envío a Meta (SPEC-053). Toma los trabajos pendientes, arma el
 * payload de la Cloud API y guarda el resultado.
 *
 * Reintenta solo lo que puede salir bien más tarde (fallos de red, límites de
 * llamadas). Lo definitivo —ventana cerrada, número fuera de WhatsApp, token
 * vencido— falla enseguida con un mensaje que dice qué hacer.
 */
const BATCH_SIZE = 20;

interface ClaimedJob {
  id: string;
}

/**
 * Reclamo atómico: una sola sentencia marca los trabajos como SENDING y
 * devuelve cuáles. `FOR UPDATE SKIP LOCKED` evita que dos procesos tomen el
 * mismo trabajo cuando el CRM corra con varias réplicas.
 */
async function claimJobs(limit: number): Promise<string[]> {
  const rows = await database.$queryRaw<ClaimedJob[]>`
    UPDATE "outbound_jobs" AS job
    SET "status" = 'SENDING'::"OutboundJobStatus", "locked_at" = NOW(), "updated_at" = NOW()
    WHERE job."id" IN (
      SELECT candidate."id"
      FROM "outbound_jobs" AS candidate
      WHERE candidate."status" = 'PENDING'::"OutboundJobStatus"
        AND candidate."next_attempt_at" <= NOW()
      ORDER BY candidate."next_attempt_at" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING job."id"
  `;
  return rows.map((row) => row.id);
}

function textParameters(values: string[]): MetaTemplateParameter[] {
  return values.map((text) => ({ type: "text", text }));
}

/** ¿El encabezado de texto de la plantilla tiene variables? Entonces también lleva parámetros. */
function headerVariableCount(components: unknown): number {
  if (!Array.isArray(components)) return 0;
  const header = (components as { type?: string; format?: string; text?: string }[]).find(
    (component) => (component.type ?? "").toUpperCase() === "HEADER",
  );
  if (!header || (header.format ?? "TEXT").toUpperCase() !== "TEXT") return 0;
  return new Set([...(header.text ?? "").matchAll(/\{\{(\d+)\}\}/g)].map((match) => match[1])).size;
}

type JobMessage = Awaited<ReturnType<typeof loadJob>>;

function loadJob(jobId: string) {
  return database.outboundJob.findUnique({
    where: { id: jobId },
    include: {
      message: {
        include: {
          template: true,
          conversation: {
            include: {
              contact: { select: { id: true, phone: true, waUserId: true, displayName: true } },
              whatsappNumber: { select: { id: true, phoneNumberId: true, accessTokenCiphertext: true, status: true } },
            },
          },
        },
      },
    },
  });
}

class SendRejected extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Arma el cuerpo exacto que espera la Cloud API para este mensaje. */
function buildPayload(job: NonNullable<JobMessage>, to: string): MetaMessagePayload {
  const { message } = job;
  if (message.type === "template") {
    const template = message.template;
    if (!template) throw new SendRejected("PLANTILLA_FALTA", "La plantilla que se iba a enviar ya no existe en la biblioteca.");
    if (template.status !== "APPROVED") {
      throw new SendRejected("PLANTILLA_NO_APROBADA", "Meta todavía no aprueba esta plantilla: no se puede enviar.");
    }
    const payload = (message.payload ?? {}) as { bodyParameters?: unknown };
    const bodyParameters = Array.isArray(payload.bodyParameters) ? payload.bodyParameters.map(String) : [];
    const headerCount = headerVariableCount(template.components);
    const components: MetaTemplateComponent[] = [];
    if (headerCount > 0) {
      // Meta numera las variables por componente: el encabezado usa las primeras.
      components.push({ type: "header", parameters: textParameters(bodyParameters.slice(0, headerCount)) });
    }
    const bodyValues = headerCount > 0 ? bodyParameters.slice(headerCount) : bodyParameters;
    if (bodyValues.length || templateBodyText(template.components).includes("{{")) {
      components.push({ type: "body", parameters: textParameters(bodyValues) });
    }
    return {
      type: "template",
      to,
      template: {
        name: template.name,
        language: { code: template.language },
        ...(components.length ? { components } : {}),
      },
    };
  }

  if (message.type === "interactive") {
    const payload = (message.payload ?? {}) as { buttons?: { id?: unknown; title?: unknown }[] };
    const buttons = (Array.isArray(payload.buttons) ? payload.buttons : []).slice(0, 3).map((button, index) => ({
      type: "reply" as const,
      reply: { id: String(button.id ?? `boton_${index + 1}`), title: String(button.title ?? "").slice(0, 20) },
    }));
    if (!buttons.length) throw new SendRejected("SIN_BOTONES", "El mensaje con botones se guardó sin botones.");
    return {
      type: "interactive",
      to,
      interactive: { type: "button", body: { text: message.body ?? "" }, action: { buttons } },
    };
  }

  if (!message.body?.trim()) throw new SendRejected("SIN_TEXTO", "El mensaje se guardó vacío.");
  return { type: "text", to, text: { body: message.body } };
}

/**
 * Doble check azul en lo que la persona escribió: cortesía, nunca bloquea el
 * envío. Basta con el último mensaje: Meta marca también los anteriores de esa
 * conversación.
 */
async function markConversationRead(input: { token: string; phoneNumberId: string; conversationId: string }) {
  const last = await database.message.findFirst({
    where: { conversationId: input.conversationId, direction: "INBOUND", externalId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { externalId: true },
  });
  if (!last?.externalId) return;
  try {
    await markAsRead(input.token, input.phoneNumberId, last.externalId);
  } catch (error) {
    // Que Meta no acepte el acuse no cambia nada para el asesor.
    console.warn("No se pudo marcar como leído en Meta", describeMetaError(error));
    return;
  }
  await database.conversation.update({ where: { id: input.conversationId }, data: { unreadCount: 0 } });
}

async function failJob(input: {
  jobId: string;
  messageId: string;
  organizationId: string;
  conversationId: string;
  code: string | null;
  title: string;
}) {
  await database.outboundJob.update({
    where: { id: input.jobId },
    data: { status: "FAILED", attempts: { increment: 1 }, lockedAt: null, lastError: input.title },
  });
  await database.message.update({
    where: { id: input.messageId },
    data: { status: "FAILED", errorCode: input.code, errorTitle: input.title },
  });
  publishEvent({
    type: "message.status",
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    status: "FAILED",
  });
  publishEvent({ type: "conversation.updated", organizationId: input.organizationId, conversationId: input.conversationId, reason: "envío fallido" });
}

async function sendJob(jobId: string): Promise<void> {
  const job = await loadJob(jobId);
  if (!job) return;
  if (job.status !== "SENDING") return;
  const { message } = job;
  const conversation = message.conversation;
  const number = conversation.whatsappNumber;
  const contact = conversation.contact;

  if (message.status === "CANCELLED") {
    await database.outboundJob.update({ where: { id: jobId }, data: { status: "CANCELLED", lockedAt: null } });
    return;
  }

  // Meta solo admite el teléfono en E.164 como destinatario de /messages; el
  // business-scoped user id sirve para identificar, no para enviar.
  const to = contact.phone;
  if (!to) {
    await failJob({
      jobId,
      messageId: message.id,
      organizationId: message.organizationId,
      conversationId: conversation.id,
      code: "SIN_TELEFONO",
      title: "No tenemos el teléfono de esta persona: WhatsApp solo entrega mensajes a un número.",
    });
    return;
  }
  if (number.status === "DISCONNECTED") {
    await failJob({
      jobId,
      messageId: message.id,
      organizationId: message.organizationId,
      conversationId: conversation.id,
      code: "NUMERO_DESCONECTADO",
      title: "El número de WhatsApp está desconectado: vuelve a conectarlo en Ajustes → WhatsApp.",
    });
    return;
  }

  let token: string;
  let payload: MetaMessagePayload;
  try {
    token = decryptSecret(number.accessTokenCiphertext);
    payload = buildPayload(job, to);
  } catch (error) {
    await failJob({
      jobId,
      messageId: message.id,
      organizationId: message.organizationId,
      conversationId: conversation.id,
      code: error instanceof SendRejected ? error.code : "CONFIGURACION",
      title: error instanceof Error ? error.message : "No se pudo preparar el envío.",
    });
    return;
  }

  try {
    const wamid = await sendMessage(token, number.phoneNumberId, payload);
    const now = new Date();
    await database.message.update({
      where: { id: message.id },
      data: { externalId: wamid, status: "SENT", sentAt: now, errorCode: null, errorTitle: null },
    });
    await database.outboundJob.update({
      where: { id: jobId },
      data: { status: "SENT", attempts: { increment: 1 }, lockedAt: null, lastError: null },
    });
    await database.conversation.update({ where: { id: conversation.id }, data: { lastOutboundAt: now, lastMessageAt: now } });
    publishEvent({
      type: "message.status",
      organizationId: message.organizationId,
      conversationId: conversation.id,
      messageId: message.id,
      status: "SENT",
    });
    await markConversationRead({ token, phoneNumberId: number.phoneNumberId, conversationId: conversation.id });
    return;
  } catch (error) {
    const classified = classifyMetaError(error);
    const code = classified.code !== null ? String(classified.code) : error instanceof MetaApiError ? "META" : "INESPERADO";
    const attemptsDone = job.attempts + 1;
    const retryAt = classified.kind === "RETRY" || classified.kind === "RATE_LIMIT" ? nextAttemptAt(attemptsDone, new Date()) : null;

    if (retryAt) {
      await database.outboundJob.update({
        where: { id: jobId },
        data: { status: "PENDING", attempts: attemptsDone, nextAttemptAt: retryAt, lockedAt: null, lastError: classified.userMessage },
      });
      return;
    }

    if (classified.kind === "AUTH") {
      // El token dejó de servir: el número entero queda avisado, no solo este envío.
      await database.whatsappNumber.update({
        where: { id: number.id },
        data: { lastError: describeMetaError(error) },
      });
      publishEvent({ type: "whatsapp.number.updated", organizationId: message.organizationId, numberId: number.id });
    }
    await failJob({
      jobId,
      messageId: message.id,
      organizationId: message.organizationId,
      conversationId: conversation.id,
      code,
      title: classified.userMessage,
    });
  }
}

export function registerOutboundLoop(): void {
  registerLoop({
    name: "envio-whatsapp",
    intervalMs: 2_000,
    run: async () => {
      const jobIds = await claimJobs(BATCH_SIZE);
      for (const jobId of jobIds) {
        try {
          await sendJob(jobId);
        } catch (error) {
          // Nunca dejar un trabajo atrapado en SENDING por un fallo nuestro.
          console.error("Envío a Meta falló fuera de la llamada", error);
          await database.outboundJob.updateMany({
            where: { id: jobId, status: "SENDING" },
            data: { status: "PENDING", lockedAt: null, lastError: error instanceof Error ? error.message : String(error) },
          });
        }
      }
    },
  });
}
