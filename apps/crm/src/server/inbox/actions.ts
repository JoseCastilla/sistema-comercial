"use server";

import { revalidatePath } from "next/cache";

import { audit } from "../audit";
import { canRespond, requireAccess, type Access } from "../auth/access";
import { database } from "../database";
import { publishEvent } from "../events/bus";
import { checkbox, failure, optionalText, text, type ActionState } from "../forms";
import { assignConversation, setResponderState } from "../messaging/conversation-state";
import { enqueueOutboundMessage, OutboundRejectedError } from "../messaging/store";
import { sendTemplateToConversation } from "../templates/send";
import { conversationScopeWhere } from "./scope";

/**
 * Acciones de la bandeja (SPEC-054). Cada una: sesión → conversación dentro
 * del alcance → regla → rastro → revalidar. Los textos dicen la consecuencia.
 */

async function requireResponder(): Promise<Access> {
  const access = await requireAccess();
  if (!canRespond(access.role)) throw new Error("El back office puede leer las conversaciones, pero no responder ni moverlas.");
  return access;
}

async function loadScoped(access: Access, conversationId: string) {
  if (!conversationId) throw new Error("Falta la conversación.");
  const conversation = await database.conversation.findFirst({
    where: { id: conversationId, ...conversationScopeWhere(access) },
    select: { id: true, organizationId: true, contactId: true, status: true, responderState: true, assignedUserId: true, aiAgentId: true, isOrderInquiry: true },
  });
  if (!conversation) throw new Error("No encontramos esta conversación o no la puedes ver.");
  return conversation;
}

type Scoped = Awaited<ReturnType<typeof loadScoped>>;

/**
 * Responder es tomar control (BR-008b): si nadie humano estaba a cargo, pasa
 * a CONTROL_HUMANO y cancela lo automático pendiente; si no tenía dueño, se la
 * queda quien responde.
 */
async function claimBeforeReplying(access: Access, conversation: Scoped) {
  if (conversation.responderState !== "CONTROL_HUMANO") {
    await setResponderState({
      conversationId: conversation.id,
      state: "CONTROL_HUMANO",
      actorUserId: access.userId,
      reason: conversation.responderState === "IA_ACTIVA" ? "Respondió un asesor" : "Un asesor respondió",
      assignToUserId: conversation.assignedUserId ?? access.userId,
    });
  } else if (!conversation.assignedUserId) {
    await assignConversation({ conversationId: conversation.id, userId: access.userId, actorUserId: access.userId, reason: "Respondió desde la bandeja" });
  }
}

function done(message?: string): ActionState {
  revalidatePath("/inbox");
  return { ok: true, message: message ?? null };
}

export async function sendText(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireResponder();
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    const body = text(formData, "body");
    if (!body) throw new Error("Escribe algo antes de enviar.");
    if (body.length > 4096) throw new Error("WhatsApp acepta hasta 4096 caracteres por mensaje.");
    await claimBeforeReplying(access, conversation);
    await enqueueOutboundMessage({
      conversationId: conversation.id,
      originKind: "USER",
      senderUserId: access.userId,
      clientRequestId: optionalText(formData, "clientRequestId"),
      content: { kind: "text", body },
    });
    return done();
  } catch (error) {
    if (error instanceof OutboundRejectedError) return { ok: false, error: error.message };
    return failure(error, "No se pudo enviar el mensaje.");
  }
}

export async function sendTemplate(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireResponder();
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    const templateId = text(formData, "templateId");
    if (!templateId) throw new Error("Elige una plantilla.");
    const manualValues: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("var_")) manualValues[key.slice(4)] = String(value).trim();
    }
    await claimBeforeReplying(access, conversation);
    await sendTemplateToConversation({
      conversationId: conversation.id,
      templateId,
      manualValues,
      originKind: "USER",
      senderUserId: access.userId,
      clientRequestId: optionalText(formData, "clientRequestId"),
    });
    return done("Plantilla enviada. Cuando la persona responda podrás escribirle libremente.");
  } catch (error) {
    if (error instanceof OutboundRejectedError) return { ok: false, error: error.message };
    return failure(error, "No se pudo enviar la plantilla.");
  }
}

export async function addNote(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    const body = text(formData, "body");
    if (!body) throw new Error("La nota está vacía.");
    await database.conversationNote.create({ data: { conversationId: conversation.id, authorUserId: access.userId, body } });
    publishEvent({ type: "conversation.updated", organizationId: conversation.organizationId, conversationId: conversation.id, reason: "note" });
    return done();
  } catch (error) {
    return failure(error, "No se pudo guardar la nota.");
  }
}

export async function takeControl(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireResponder();
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    if (conversation.status === "CLOSED") throw new Error("La conversación está cerrada. Reábrela primero.");
    const { cancelled } = await setResponderState({
      conversationId: conversation.id,
      state: "CONTROL_HUMANO",
      actorUserId: access.userId,
      reason: "Tomó el control desde la bandeja",
      assignToUserId: access.userId,
    });
    return done(cancelled ? `Ahora respondes tú. Se cancelaron ${cancelled} envío(s) automático(s) que aún no salían.` : "Ahora respondes tú.");
  } catch (error) {
    return failure(error);
  }
}

export async function handBackToAgent(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireResponder();
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    if (!conversation.aiAgentId) throw new Error("Este número no tiene asistente configurado.");
    if (conversation.status === "CLOSED") throw new Error("La conversación está cerrada. Reábrela primero.");
    await setResponderState({
      conversationId: conversation.id,
      state: "IA_ACTIVA",
      actorUserId: access.userId,
      reason: optionalText(formData, "reason") ?? "Devuelta al asistente desde la bandeja",
    });
    return done("El asistente vuelve a responder en esta conversación.");
  } catch (error) {
    return failure(error);
  }
}

export async function sendToQueue(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireResponder();
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    const reason = text(formData, "reason");
    if (!reason) throw new Error("Di por qué la devuelves: el equipo necesita saberlo para tomarla.");
    await assignConversation({ conversationId: conversation.id, userId: null, actorUserId: access.userId, reason, type: "RETURNED" });
    await setResponderState({ conversationId: conversation.id, state: "REQUIERE_ASESOR", actorUserId: access.userId, reason });
    return done("Volvió a la cola: cualquier asesor disponible puede tomarla.");
  } catch (error) {
    return failure(error);
  }
}

export async function transfer(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireResponder();
    if (access.role === "AGENT") throw new Error("Como asesor puedes pasarla a la cola; transferir a una persona lo hace el supervisor.");
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    const toUserId = text(formData, "toUserId");
    const reason = text(formData, "reason");
    if (!toUserId) throw new Error("Elige a quién transferir.");
    if (!reason) throw new Error("Di por qué la transfieres: queda en el historial.");
    if (toUserId === conversation.assignedUserId) throw new Error("Esa persona ya la tiene asignada.");
    const target = await database.organizationMember.findFirst({
      where: { organizationId: access.organizationId, userId: toUserId, role: { in: ["AGENT", "SUPERVISOR", "OWNER"] }, user: { status: "ACTIVE" } },
      select: { user: { select: { name: true } } },
    });
    if (!target) throw new Error("Esa persona no puede recibir conversaciones.");
    await assignConversation({ conversationId: conversation.id, userId: toUserId, actorUserId: access.userId, reason, type: "TRANSFERRED" });
    if (conversation.responderState === "REQUIERE_ASESOR") {
      await setResponderState({ conversationId: conversation.id, state: "CONTROL_HUMANO", actorUserId: access.userId, reason: `Transferida a ${target.user.name}`, assignToUserId: toUserId });
    }
    return done(`Ahora la atiende ${target.user.name}.`);
  } catch (error) {
    return failure(error);
  }
}

export async function closeConversation(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireResponder();
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    if (conversation.status === "CLOSED") return done("Ya estaba cerrada.");
    if (!conversation.isOrderInquiry) {
      const opportunity = await database.opportunity.findFirst({
        where: { organizationId: access.organizationId, contactId: conversation.contactId, stage: { notIn: ["GANADA", "PERDIDA"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, nextActionAt: true },
      });
      if (opportunity && !opportunity.nextActionAt) {
        throw new Error("Antes de cerrar define la siguiente acción en el embudo.");
      }
    }
    await database.conversation.update({ where: { id: conversation.id }, data: { status: "CLOSED", closedAt: new Date(), unattendedSince: null } });
    await database.conversationEvent.create({ data: { conversationId: conversation.id, type: "CLOSED", actorUserId: access.userId, detail: { reason: optionalText(formData, "reason") ?? undefined } } });
    await audit({ organizationId: access.organizationId, actorUserId: access.userId, action: "conversation.closed", targetKind: "conversation", targetId: conversation.id });
    publishEvent({ type: "conversation.updated", organizationId: conversation.organizationId, conversationId: conversation.id, reason: "closed" });
    return done("Cerrada. Si la persona vuelve a escribir, se reabre sola.");
  } catch (error) {
    return failure(error);
  }
}

export async function reopenConversation(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireResponder();
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    if (conversation.status === "OPEN") return done("Ya estaba abierta.");
    await database.conversation.update({ where: { id: conversation.id }, data: { status: "OPEN", closedAt: null } });
    await database.conversationEvent.create({ data: { conversationId: conversation.id, type: "REOPENED", actorUserId: access.userId, detail: { reason: "Reabierta desde la bandeja" } } });
    if (!conversation.assignedUserId) {
      await assignConversation({ conversationId: conversation.id, userId: access.userId, actorUserId: access.userId, reason: "Reabrió la conversación" });
    }
    await audit({ organizationId: access.organizationId, actorUserId: access.userId, action: "conversation.reopened", targetKind: "conversation", targetId: conversation.id });
    publishEvent({ type: "conversation.updated", organizationId: conversation.organizationId, conversationId: conversation.id, reason: "reopened" });
    return done("Reabierta.");
  } catch (error) {
    return failure(error);
  }
}

export async function markRead(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const conversation = await loadScoped(access, text(formData, "conversationId"));
    const result = await database.conversation.updateMany({ where: { id: conversation.id, unreadCount: { gt: 0 } }, data: { unreadCount: 0 } });
    if (result.count > 0) {
      publishEvent({ type: "conversation.updated", organizationId: conversation.organizationId, conversationId: conversation.id, reason: "read" });
      revalidatePath("/inbox");
    }
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

const TAG_LIMIT = 20;

export async function updateContact(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const contactId = text(formData, "contactId");
    const contact = await database.contact.findFirst({ where: { id: contactId, organizationId: access.organizationId }, select: { id: true, tags: true } });
    if (!contact) throw new Error("No encontramos este contacto.");
    const documentNumber = optionalText(formData, "documentNumber");
    if (documentNumber && !/^[0-9A-Za-z-]{6,20}$/.test(documentNumber)) throw new Error("El documento debe tener entre 6 y 20 caracteres.");
    const email = optionalText(formData, "email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no tiene un formato válido.");
    const tags = [...new Set(text(formData, "tags").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, TAG_LIMIT);
    await database.contact.update({
      where: { id: contact.id },
      data: {
        displayName: optionalText(formData, "displayName"),
        documentNumber,
        district: optionalText(formData, "district"),
        currentCarrier: optionalText(formData, "currentCarrier"),
        email,
        tags,
      },
    });
    for (const tag of tags.filter((tag) => !contact.tags.includes(tag))) {
      publishEvent({ type: "contact.tagged", organizationId: access.organizationId, contactId: contact.id, tag });
    }
    await audit({ organizationId: access.organizationId, actorUserId: access.userId, action: "contact.updated", targetKind: "contact", targetId: contact.id });
    return done("Datos guardados.");
  } catch (error) {
    return failure(error);
  }
}

export async function setMarketingConsent(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const contactId = text(formData, "contactId");
    const contact = await database.contact.findFirst({ where: { id: contactId, organizationId: access.organizationId }, select: { id: true } });
    if (!contact) throw new Error("No encontramos este contacto.");
    const granted = checkbox(formData, "granted");
    const evidenceText = text(formData, "evidenceText");
    if (!evidenceText) throw new Error("Anota la evidencia: qué dijo o dónde aceptó (o rechazó) recibir promociones.");
    await database.contactConsent.create({
      data: { organizationId: access.organizationId, contactId: contact.id, category: "MARKETING", granted, source: "registrado por asesor", evidenceText, recordedByUserId: access.userId },
    });
    await database.contact.update({ where: { id: contact.id }, data: { marketingOptIn: granted, marketingOptOutAt: granted ? null : new Date() } });
    await audit({ organizationId: access.organizationId, actorUserId: access.userId, action: "contact.consent.marketing", targetKind: "contact", targetId: contact.id, detail: { granted } });
    return done(granted ? "Registrado: acepta recibir promociones." : "Registrado: no recibirá promociones.");
  } catch (error) {
    return failure(error);
  }
}

export async function setAvailability(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const available = checkbox(formData, "available");
    await database.organizationMember.update({ where: { id: access.memberId }, data: { available, lastSeenAt: new Date() } });
    return done(available ? "Disponible: recibirás conversaciones nuevas." : "No disponible: no te llegarán conversaciones nuevas.");
  } catch (error) {
    return failure(error);
  }
}
