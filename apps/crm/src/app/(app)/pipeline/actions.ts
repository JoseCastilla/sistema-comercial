"use server";

import { revalidatePath } from "next/cache";

import type { NextActionKind, OpportunityStage } from "@/generated/prisma/enums";
import { audit } from "@/server/audit";
import { requireAccess, type Access } from "@/server/auth/access";
import { database } from "@/server/database";
import { decimal, failure, integer, optionalText, text, type ActionState } from "@/server/forms";
import { ALL_STAGES, STAGE_LABELS } from "@/server/opportunities/rules";
import { assign, setNextAction, setProposal, setStage } from "@/server/opportunities/service";
import { linkOrder, unlinkOrder } from "@/server/orders/service";
import { zonedTimeToUtc } from "@/lib/time";

/**
 * Permisos del embudo: el back office lee pero no mueve; el asesor solo
 * trabaja sus oportunidades; dueño y supervisor, todas.
 */
async function requireWorkableOpportunity(access: Access, opportunityId: string) {
  if (access.role === "BACKOFFICE") throw new Error("El back office consulta el embudo pero no mueve oportunidades.");
  const opportunity = await database.opportunity.findFirst({
    where: { id: opportunityId, organizationId: access.organizationId, ...(access.role === "AGENT" ? { assignedUserId: access.userId } : {}) },
    select: { id: true, stage: true, contactId: true },
  });
  if (!opportunity) throw new Error(access.role === "AGENT" ? "Solo puedes trabajar las oportunidades asignadas a ti." : "La oportunidad no existe.");
  return opportunity;
}

/** Vincular o desvincular pedidos lo hace cualquiera con acceso; el asesor, solo sobre las suyas. */
async function requireLinkableOpportunity(access: Access, opportunityId: string) {
  const opportunity = await database.opportunity.findFirst({
    where: { id: opportunityId, organizationId: access.organizationId, ...(access.role === "AGENT" ? { assignedUserId: access.userId } : {}) },
    select: { id: true },
  });
  if (!opportunity) throw new Error(access.role === "AGENT" ? "Solo puedes vincular pedidos a tus oportunidades." : "La oportunidad no existe.");
  return opportunity;
}

function revalidate(opportunityId: string) {
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${opportunityId}`);
  revalidatePath("/reports");
}

function parseStage(value: string): OpportunityStage {
  if (!(ALL_STAGES as string[]).includes(value)) throw new Error("Etapa desconocida.");
  return value as OpportunityStage;
}

export async function moveStage(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const id = text(formData, "id");
    const opportunity = await requireWorkableOpportunity(access, id);
    const stage = parseStage(text(formData, "stage"));
    await setStage({
      organizationId: access.organizationId,
      opportunityId: opportunity.id,
      stage,
      actorKind: "USER",
      actorUserId: access.userId,
      reason: optionalText(formData, "reason"),
      lostReason: optionalText(formData, "lostReason"),
      lostDetail: optionalText(formData, "lostDetail"),
    });
    await audit({ organizationId: access.organizationId, actorUserId: access.userId, action: "opportunity.stage", targetKind: "opportunity", targetId: opportunity.id, detail: { from: opportunity.stage, to: stage } });
    revalidate(opportunity.id);
    return { ok: true, message: `Movida a ${STAGE_LABELS[stage]}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function saveNextAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const opportunity = await requireWorkableOpportunity(access, text(formData, "id"));
    const kindValue = text(formData, "kind");
    const kind = kindValue ? (kindValue as NextActionKind) : null;
    if (kind && !["LLAMAR", "CITA", "ESPERAR_RESPUESTA", "COMPLETAR_DATOS"].includes(kind)) throw new Error("Tipo de acción desconocido.");
    const date = text(formData, "date");
    const time = text(formData, "time") || "09:00";
    const at = kind && date ? zonedTimeToUtc(date, time, access.timezone) : null;
    await setNextAction({ organizationId: access.organizationId, opportunityId: opportunity.id, kind, at, actorUserId: access.userId });
    revalidate(opportunity.id);
    return { ok: true, message: kind ? "Siguiente acción guardada." : "Siguiente acción quitada." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveProposal(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const opportunity = await requireWorkableOpportunity(access, text(formData, "id"));
    const fixedCharge = decimal(formData, "fixedCharge");
    if (fixedCharge === null) throw new Error("Indica el cargo fijo total.");
    await setProposal({
      organizationId: access.organizationId,
      opportunityId: opportunity.id,
      planId: optionalText(formData, "planId"),
      lines: integer(formData, "lines", 1),
      fixedCharge,
      actorUserId: access.userId,
    });
    if (opportunity.stage === "NUEVO" || opportunity.stage === "EN_CONTACTO" || opportunity.stage === "CALIFICADO") {
      // Registrar una propuesta es entrar en Propuesta (BR-007).
      await setStage({ organizationId: access.organizationId, opportunityId: opportunity.id, stage: "PROPUESTA", actorKind: "USER", actorUserId: access.userId, reason: "propuesta registrada" });
    }
    revalidate(opportunity.id);
    return { ok: true, message: "Propuesta guardada." };
  } catch (error) {
    return failure(error);
  }
}

export async function assignOpportunity(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    if (access.role !== "OWNER" && access.role !== "SUPERVISOR") throw new Error("Solo el dueño o un supervisor cambian el responsable.");
    const opportunity = await requireWorkableOpportunity(access, text(formData, "id"));
    await assign({ organizationId: access.organizationId, opportunityId: opportunity.id, assignedUserId: optionalText(formData, "userId"), actorUserId: access.userId });
    revalidate(opportunity.id);
    return { ok: true, message: "Responsable actualizado." };
  } catch (error) {
    return failure(error);
  }
}

export async function unlinkOrderFromOpportunity(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const opportunity = await requireLinkableOpportunity(access, text(formData, "id"));
    await unlinkOrder({ organizationId: access.organizationId, orderId: text(formData, "orderId"), actorUserId: access.userId, reason: text(formData, "reason") });
    revalidate(opportunity.id);
    revalidatePath("/orders");
    return { ok: true, message: "Pedido desvinculado." };
  } catch (error) {
    return failure(error);
  }
}

export async function linkOrderByReference(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const opportunity = await requireLinkableOpportunity(access, text(formData, "id"));
    const externalRef = text(formData, "externalRef");
    if (!externalRef) throw new Error("Escribe la referencia del pedido.");
    const order = await database.order.findFirst({ where: { organizationId: access.organizationId, externalRef }, select: { id: true } });
    if (!order) throw new Error(`No hay ningún pedido con la referencia ${externalRef}. Regístralo primero en Pedidos.`);
    await linkOrder({ organizationId: access.organizationId, orderId: order.id, opportunityId: opportunity.id, actorUserId: access.userId });
    revalidate(opportunity.id);
    revalidatePath("/orders");
    return { ok: true, message: "Pedido vinculado: la oportunidad queda ganada." };
  } catch (error) {
    return failure(error);
  }
}
