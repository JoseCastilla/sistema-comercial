"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { zonedTimeToUtc } from "@/lib/time";
import { requireManager } from "@/server/auth/access";
import { checkbox, failure, list, optionalText, text, type ActionState } from "@/server/forms";
import {
  cancelBroadcast,
  createBroadcast,
  pauseBroadcast,
  resumeBroadcast,
  scheduleBroadcast,
  updateBroadcast,
  type Actor,
} from "@/server/broadcasts/service";
import { parseSegment, type Segment } from "@/server/broadcasts/segments";

/** Lee los filtros del segmento del formulario. Lo que viene vacío no filtra. */
function readSegment(formData: FormData): Segment {
  const open = text(formData, "hasOpenOpportunity");
  const tags = text(formData, "tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return parseSegment({
    ...(tags.length ? { tags } : {}),
    ...(list(formData, "stages").length ? { stages: list(formData, "stages") } : {}),
    ...(list(formData, "origins").length ? { origins: list(formData, "origins") } : {}),
    ...(optionalText(formData, "lastInboundAfter") ? { lastInboundAfter: text(formData, "lastInboundAfter") } : {}),
    ...(optionalText(formData, "lastInboundBefore") ? { lastInboundBefore: text(formData, "lastInboundBefore") } : {}),
    ...(optionalText(formData, "district") ? { district: text(formData, "district") } : {}),
    ...(open === "si" ? { hasOpenOpportunity: true } : open === "no" ? { hasOpenOpportunity: false } : {}),
    ...(checkbox(formData, "marketingOptInOnly") ? { marketingOptInOnly: true } : {}),
  });
}

function actorOf(access: { organizationId: string; userId: string; role: Actor["role"] }): Actor {
  return { organizationId: access.organizationId, userId: access.userId, role: access.role };
}

/** Paso 1: crea el borrador con el segmento y pasa al conteo. */
export async function createDraft(_state: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    const access = await requireManager();
    id = await createBroadcast(actorOf(access), { name: text(formData, "name"), segment: readSegment(formData) });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/broadcasts");
  redirect(`/broadcasts/new?id=${id}&paso=1`);
}

/** Paso 1: ajusta los filtros de un borrador y vuelve a contar. */
export async function saveSegmentStep(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    await updateBroadcast(actorOf(access), text(formData, "id"), {
      name: text(formData, "name"),
      segment: readSegment(formData),
    });
    revalidatePath("/broadcasts/new");
    return { ok: true, message: "Filtros guardados. Abajo está a cuántas personas llega hoy." };
  } catch (error) {
    return failure(error);
  }
}

/** Paso 2: plantilla y valores de las variables que se escriben a mano. */
export async function saveTemplateStep(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const values: Record<string, string> = {};
    for (const [key, raw] of formData.entries()) {
      if (!key.startsWith("var_") || typeof raw !== "string") continue;
      const value = raw.trim();
      if (value) values[key.slice(4)] = value;
    }
    await updateBroadcast(actorOf(access), text(formData, "id"), {
      templateId: text(formData, "templateId"),
      variableValues: values,
    });
    revalidatePath("/broadcasts/new");
    return { ok: true, message: "Plantilla guardada. Sigue con la programación." };
  } catch (error) {
    return failure(error);
  }
}

/** Paso 4: congela los destinatarios y deja la difusión lista para salir. */
export async function scheduleFromWizard(_state: ActionState, formData: FormData): Promise<ActionState> {
  let id: string;
  try {
    const access = await requireManager();
    id = text(formData, "id");
    const day = text(formData, "fecha");
    const time = text(formData, "hora");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) {
      throw new Error("Elige la fecha y la hora antes de programar.");
    }
    await scheduleBroadcast(actorOf(access), id, zonedTimeToUtc(day, time, access.timezone));
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/broadcasts");
  redirect(`/broadcasts/${id}`);
}

export async function pause(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const id = text(formData, "id");
    await pauseBroadcast(actorOf(access), id, text(formData, "reason"));
    revalidatePath("/broadcasts");
    revalidatePath(`/broadcasts/${id}`);
    return { ok: true, message: "Pausada. No sale nada más hasta que la reanudes." };
  } catch (error) {
    return failure(error);
  }
}

export async function resume(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const id = text(formData, "id");
    await resumeBroadcast(actorOf(access), id, text(formData, "reason"));
    revalidatePath("/broadcasts");
    revalidatePath(`/broadcasts/${id}`);
    return { ok: true, message: "Reanudada. Sigue por donde iba, sin repetir a nadie." };
  } catch (error) {
    return failure(error);
  }
}

export async function cancel(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const id = text(formData, "id");
    await cancelBroadcast(actorOf(access), id);
    revalidatePath("/broadcasts");
    revalidatePath(`/broadcasts/${id}`);
    return { ok: true, message: "Cancelada. A quien ya le llegó, le llegó." };
  } catch (error) {
    return failure(error);
  }
}
