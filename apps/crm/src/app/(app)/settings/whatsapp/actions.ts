"use server";

import { revalidatePath } from "next/cache";

import { requireManager, requireOwner } from "@/server/auth/access";
import { failure, optionalText, text, type ActionState } from "@/server/forms";
import { connectNumber, disconnectNumber, refreshNumber, setDefaultAiAgent } from "@/server/meta/numbers";

/**
 * Acciones de la pantalla de WhatsApp. Conectar y desconectar es cosa del
 * dueño; actualizar el estado y elegir el asistente lo puede hacer un
 * supervisor.
 */

export async function connectManually(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireOwner();
    const wabaId = text(formData, "wabaId");
    const phoneNumberId = text(formData, "phoneNumberId");
    const token = text(formData, "token");
    if (!wabaId || !phoneNumberId || !token) {
      return { ok: false, error: "Completa la cuenta de WhatsApp, el número y el token." };
    }
    const number = await connectNumber({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      wabaId,
      phoneNumberId,
      token,
      connectionMethod: "MANUAL",
    });
    revalidatePath("/settings/whatsapp");
    return {
      ok: true,
      message: `Conectado ${number.verifiedName ?? number.displayPhoneNumber ?? phoneNumberId}. Ya puedes recibir mensajes.`,
    };
  } catch (error) {
    return failure(error, "No se pudo conectar el número.");
  }
}

export async function refreshNumberStatus(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    await refreshNumber({ organizationId: access.organizationId, numberId: text(formData, "numberId"), actorUserId: access.userId });
    revalidatePath("/settings/whatsapp");
    return { ok: true, message: "Estado actualizado con lo que dice Meta ahora." };
  } catch (error) {
    return failure(error, "No se pudo consultar a Meta.");
  }
}

export async function disconnect(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireOwner();
    const result = await disconnectNumber({
      organizationId: access.organizationId,
      numberId: text(formData, "numberId"),
      actorUserId: access.userId,
    });
    revalidatePath("/settings/whatsapp");
    return {
      ok: true,
      message: result.deleted
        ? "Número desconectado y borrado."
        : `Número desconectado. Se conservan ${result.conversations} conversaciones y ${result.templates} plantillas: esa evidencia no se borra.`,
    };
  } catch (error) {
    return failure(error, "No se pudo desconectar el número.");
  }
}

export async function saveDefaultAgent(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    await setDefaultAiAgent({
      organizationId: access.organizationId,
      numberId: text(formData, "numberId"),
      aiAgentId: optionalText(formData, "aiAgentId"),
      actorUserId: access.userId,
    });
    revalidatePath("/settings/whatsapp");
    return { ok: true, message: "Guardado. Los mensajes nuevos los atiende ese asistente." };
  } catch (error) {
    return failure(error, "No se pudo guardar el asistente.");
  }
}
