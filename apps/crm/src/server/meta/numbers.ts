import "server-only";

import { randomInt } from "node:crypto";

import type { ConnectionMethod } from "@/generated/prisma/enums";

import { audit } from "../audit";
import { database } from "../database";
import { decryptSecret, encryptSecret } from "../crypto";
import { publishEvent } from "../events/bus";
import { describeMetaError } from "./errors";
import { getPhoneNumber, registerPhone, subscribeApp } from "./graph";
import { metaPhoneStatusToNumberStatus } from "./status-text";

/**
 * Alta, actualización y baja de números de WhatsApp (SPEC-053).
 * El token de Meta se guarda cifrado y nunca sale de aquí.
 */

/** PIN de verificación en dos pasos del número. Se muestra una sola vez. */
export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

interface ConnectInput {
  organizationId: string;
  actorUserId?: string | null;
  wabaId: string;
  phoneNumberId: string;
  token: string;
  connectionMethod: ConnectionMethod;
}

/**
 * Comprueba con Meta antes de guardar: si el token no sirve o la app no puede
 * suscribirse a la cuenta, no se guarda nada y se dice por qué.
 */
export async function connectNumber(input: ConnectInput) {
  const phone = await getPhoneNumber(input.token, input.phoneNumberId).catch((error: unknown) => {
    throw new Error(`No se pudo leer el número en Meta: ${describeMetaError(error)}`);
  });
  await subscribeApp(input.token, input.wabaId).catch((error: unknown) => {
    throw new Error(`No se pudo suscribir la app a esa cuenta de WhatsApp: ${describeMetaError(error)}`);
  });

  const existing = await database.whatsappNumber.findUnique({
    where: { phoneNumberId: input.phoneNumberId },
    select: { id: true, organizationId: true },
  });
  if (existing && existing.organizationId !== input.organizationId) {
    throw new Error("Ese número ya está conectado en otra empresa de este sistema.");
  }

  const data = {
    wabaId: input.wabaId,
    displayPhoneNumber: phone.display_phone_number ?? null,
    verifiedName: phone.verified_name ?? null,
    status: metaPhoneStatusToNumberStatus(phone.status),
    qualityRating: phone.quality_rating ?? null,
    messagingLimitTier: phone.messaging_limit_tier ?? null,
    connectionMethod: input.connectionMethod,
    accessTokenCiphertext: encryptSecret(input.token),
    lastError: null,
    connectedAt: new Date(),
  };
  const saved = existing
    ? await database.whatsappNumber.update({ where: { id: existing.id }, data })
    : await database.whatsappNumber.create({
        data: { organizationId: input.organizationId, phoneNumberId: input.phoneNumberId, ...data },
      });

  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: existing ? "whatsapp.number.reconnected" : "whatsapp.number.connected",
    targetKind: "whatsapp_number",
    targetId: saved.id,
    detail: { phoneNumberId: input.phoneNumberId, wabaId: input.wabaId, method: input.connectionMethod },
  });
  publishEvent({ type: "whatsapp.number.updated", organizationId: input.organizationId, numberId: saved.id });
  return saved;
}

/** Conexión por Embedded Signup: canjear el código ya se hizo en la ruta. */
export async function connectFromEmbeddedSignup(input: {
  organizationId: string;
  actorUserId?: string | null;
  wabaId: string;
  phoneNumberId: string;
  token: string;
}): Promise<{ number: Awaited<ReturnType<typeof connectNumber>>; pin: string | null; registerError: string | null }> {
  const pin = generatePin();
  let registerError: string | null = null;
  try {
    await registerPhone(input.token, input.phoneNumberId, pin);
  } catch (error) {
    // El número puede venir ya registrado desde el propio flujo de Meta.
    registerError = describeMetaError(error);
  }
  const number = await connectNumber({ ...input, connectionMethod: "EMBEDDED_SIGNUP" });
  if (registerError) {
    await database.whatsappNumber.update({ where: { id: number.id }, data: { lastError: `Al registrar el número: ${registerError}` } });
  }
  return { number, pin: registerError ? null : pin, registerError };
}

/** Vuelve a preguntarle a Meta el estado del número. */
export async function refreshNumber(input: { organizationId: string; numberId: string; actorUserId?: string | null }) {
  const number = await database.whatsappNumber.findFirstOrThrow({
    where: { id: input.numberId, organizationId: input.organizationId },
    select: { id: true, phoneNumberId: true, wabaId: true, accessTokenCiphertext: true },
  });
  const token = decryptSecret(number.accessTokenCiphertext);
  try {
    const phone = await getPhoneNumber(token, number.phoneNumberId);
    await database.whatsappNumber.update({
      where: { id: number.id },
      data: {
        displayPhoneNumber: phone.display_phone_number ?? undefined,
        verifiedName: phone.verified_name ?? undefined,
        status: metaPhoneStatusToNumberStatus(phone.status),
        qualityRating: phone.quality_rating ?? null,
        messagingLimitTier: phone.messaging_limit_tier ?? null,
        lastError: null,
      },
    });
  } catch (error) {
    const message = describeMetaError(error);
    await database.whatsappNumber.update({ where: { id: number.id }, data: { lastError: message } });
    publishEvent({ type: "whatsapp.number.updated", organizationId: input.organizationId, numberId: number.id });
    throw new Error(message);
  }
  publishEvent({ type: "whatsapp.number.updated", organizationId: input.organizationId, numberId: number.id });
  return database.whatsappNumber.findUniqueOrThrow({ where: { id: number.id } });
}

export interface DisconnectResult {
  /** true si la fila se borró; false si se conservó por tener historial. */
  deleted: boolean;
  conversations: number;
  templates: number;
}

/**
 * Desconecta el número. Si ya hay conversaciones o plantillas, la fila se
 * conserva marcada como desconectada: borrarla se llevaría la evidencia de
 * los mensajes, que no se puede reconstruir.
 */
export async function disconnectNumber(input: {
  organizationId: string;
  numberId: string;
  actorUserId?: string | null;
}): Promise<DisconnectResult> {
  const number = await database.whatsappNumber.findFirstOrThrow({
    where: { id: input.numberId, organizationId: input.organizationId },
    select: { id: true, phoneNumberId: true },
  });
  const conversations = await database.conversation.count({ where: { whatsappNumberId: number.id } });
  const templates = await database.messageTemplate.count({ where: { whatsappNumberId: number.id } });

  if (conversations === 0 && templates === 0) {
    await database.whatsappNumber.delete({ where: { id: number.id } });
  } else {
    await database.whatsappNumber.update({
      where: { id: number.id },
      data: {
        status: "DISCONNECTED",
        // El token deja de servir para enviar: se reemplaza al reconectar.
        lastError: "Lo desconectaste: no recibe ni envía mensajes hasta que lo vuelvas a conectar.",
      },
    });
  }
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "whatsapp.number.disconnected",
    targetKind: "whatsapp_number",
    targetId: number.id,
    detail: { phoneNumberId: number.phoneNumberId, deleted: conversations === 0 && templates === 0 },
  });
  publishEvent({ type: "whatsapp.number.updated", organizationId: input.organizationId, numberId: number.id });
  return { deleted: conversations === 0 && templates === 0, conversations, templates };
}

/** Agente de IA que atiende por defecto en el número. */
export async function setDefaultAiAgent(input: {
  organizationId: string;
  numberId: string;
  aiAgentId: string | null;
  actorUserId?: string | null;
}) {
  if (input.aiAgentId) {
    await database.aiAgent.findFirstOrThrow({ where: { id: input.aiAgentId, organizationId: input.organizationId } });
  }
  await database.whatsappNumber.updateMany({
    where: { id: input.numberId, organizationId: input.organizationId },
    data: { defaultAiAgentId: input.aiAgentId },
  });
  publishEvent({ type: "whatsapp.number.updated", organizationId: input.organizationId, numberId: input.numberId });
}
