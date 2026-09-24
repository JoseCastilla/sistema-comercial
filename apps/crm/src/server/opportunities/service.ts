import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ContactOrigin, NextActionKind, OpportunityStage } from "@/generated/prisma/enums";

import { database } from "../database";
import { publishEvent } from "../events/bus";
import {
  canTransition,
  customerRelation,
  isLostReason,
  OPEN_STAGES,
  staleAfterDays,
  STALE_LOST_REASON,
  type ActorKind,
} from "./rules";

/**
 * Servicio de oportunidades (SPEC-061). Toda función recibe `organizationId`
 * y lo comprueba antes de tocar nada. Los cambios dejan una fila en
 * `OpportunityEvent` (BR-020): nunca se edita el historial.
 */

const OPEN_STAGE_FILTER = { in: [...OPEN_STAGES] };

export class OpportunityError extends Error {}

async function requireOpportunity(organizationId: string, opportunityId: string) {
  const opportunity = await database.opportunity.findFirst({ where: { id: opportunityId, organizationId } });
  if (!opportunity) throw new OpportunityError("La oportunidad no existe o no pertenece a tu empresa.");
  return opportunity;
}

async function addEvent(input: { opportunityId: string; type: string; actorKind: ActorKind; actorUserId?: string | null; detail?: Prisma.InputJsonValue }) {
  await database.opportunityEvent.create({
    data: {
      opportunityId: input.opportunityId,
      type: input.type,
      actorKind: input.actorKind,
      actorUserId: input.actorUserId ?? null,
      detail: input.detail,
    },
  });
}

export function findOpenOpportunity(organizationId: string, contactId: string) {
  return database.opportunity.findFirst({
    where: { organizationId, contactId, stage: OPEN_STAGE_FILTER },
    orderBy: { createdAt: "desc" },
  });
}

/** Pedido entregado o activado antes de `before`, por contacto o por DNI (BR-006). */
export async function hadDeliveredOrderBefore(organizationId: string, contact: { id: string; documentNumber: string | null }, before: Date): Promise<boolean> {
  const count = await database.order.count({
    where: {
      organizationId,
      status: { in: ["ENTREGADO", "ACTIVADO"] },
      registeredAt: { lt: before },
      OR: [{ contactId: contact.id }, ...(contact.documentNumber ? [{ documentNumber: contact.documentNumber }] : [])],
    },
  });
  return count > 0;
}

/** Pedido ingresado, sin entregar ni cancelar, de los últimos 30 días (BR-002). */
export async function hasOrderInProgress(organizationId: string, contact: { id: string; documentNumber: string | null }, now = new Date()): Promise<boolean> {
  const count = await database.order.count({
    where: {
      organizationId,
      status: "INGRESADO",
      registeredAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
      OR: [{ contactId: contact.id }, ...(contact.documentNumber ? [{ documentNumber: contact.documentNumber }] : [])],
    },
  });
  return count > 0;
}

/**
 * Abre una oportunidad para el contacto. Idempotente: si ya hay una abierta la
 * devuelve y, si el origen nuevo difiere, registra un toque (BR-001). Fija
 * el origen inicial del contacto solo la primera vez (BR-005).
 */
export async function openOpportunity(input: {
  organizationId: string;
  contactId: string;
  conversationId?: string | null;
  origin: ContactOrigin;
  originRef?: string | null;
  assignedUserId?: string | null;
  actorKind: ActorKind;
  actorUserId?: string | null;
}) {
  const contact = await database.contact.findFirst({
    where: { id: input.contactId, organizationId: input.organizationId },
    select: { id: true, documentNumber: true, initialOrigin: true },
  });
  if (!contact) throw new OpportunityError("El contacto no existe o no pertenece a tu empresa.");

  const existing = await findOpenOpportunity(input.organizationId, contact.id);
  if (existing) {
    if (input.origin !== "UNKNOWN" && (input.origin !== existing.origin || (input.originRef ?? null) !== existing.originRef)) {
      await addEvent({
        opportunityId: existing.id,
        type: "TOUCH",
        actorKind: input.actorKind,
        actorUserId: input.actorUserId,
        detail: { origin: input.origin, originRef: input.originRef ?? null, conversationId: input.conversationId ?? null },
      });
    }
    return { opportunity: existing, created: false as const };
  }

  const now = new Date();
  const relation = customerRelation({ hadDeliveredOrderBefore: await hadDeliveredOrderBefore(input.organizationId, contact, now) });
  const opportunity = await database.opportunity.create({
    data: {
      organizationId: input.organizationId,
      contactId: contact.id,
      conversationId: input.conversationId ?? null,
      origin: input.origin,
      originRef: input.originRef ?? null,
      customerRelation: relation,
      assignedUserId: input.assignedUserId ?? null,
      stageChangedAt: now,
      lastActivityAt: now,
    },
  });
  await addEvent({
    opportunityId: opportunity.id,
    type: "OPENED",
    actorKind: input.actorKind,
    actorUserId: input.actorUserId,
    detail: { origin: input.origin, originRef: input.originRef ?? null, relation, conversationId: input.conversationId ?? null },
  });
  if (contact.initialOrigin === "UNKNOWN" && input.origin !== "UNKNOWN") {
    await database.contact.update({ where: { id: contact.id }, data: { initialOrigin: input.origin, initialOriginRef: input.originRef ?? null } });
  }
  publishEvent({
    type: "opportunity.opened",
    organizationId: input.organizationId,
    opportunityId: opportunity.id,
    contactId: contact.id,
    conversationId: input.conversationId ?? undefined,
    origin: input.origin,
  });
  return { opportunity, created: true as const };
}

export async function setStage(input: {
  organizationId: string;
  opportunityId: string;
  stage: OpportunityStage;
  actorKind: ActorKind;
  actorUserId?: string | null;
  reason?: string | null;
  lostReason?: string | null;
  lostDetail?: string | null;
}) {
  const opportunity = await requireOpportunity(input.organizationId, input.opportunityId);
  const verdict = canTransition(opportunity.stage, input.stage, input.actorKind);
  if (!verdict.allowed) throw new OpportunityError(verdict.message);

  const reason = input.reason?.trim() || null;
  let lostReason: string | null = null;
  let lostDetail: string | null = null;
  if (input.stage === "PERDIDA") {
    const code = input.lostReason?.trim() ?? "";
    const isSystemStale = input.actorKind === "SYSTEM" && code === STALE_LOST_REASON;
    if (!isSystemStale && !isLostReason(code)) throw new OpportunityError("Elige el motivo de la pérdida de la lista.");
    lostDetail = input.lostDetail?.trim() || null;
    if (code === "OTRO" && !lostDetail) throw new OpportunityError("Con motivo «Otro» hay que escribir el detalle.");
    lostReason = code;
  } else if (verdict.requiresReason && !reason) {
    throw new OpportunityError(verdict.backwards ? "Retroceder de etapa pide un motivo." : "Reabrir pide un motivo.");
  }

  const now = new Date();
  const closing = input.stage === "PERDIDA";
  const reopening = opportunity.stage === "PERDIDA";
  const updated = await database.opportunity.update({
    where: { id: opportunity.id },
    data: {
      stage: input.stage,
      stageChangedAt: now,
      lastActivityAt: now,
      ...(closing ? { lostReason, lostDetail, closedAt: now } : {}),
      ...(reopening ? { lostReason: null, lostDetail: null, closedAt: null } : {}),
    },
  });
  await addEvent({
    opportunityId: opportunity.id,
    type: "STAGE_CHANGED",
    actorKind: input.actorKind,
    actorUserId: input.actorUserId,
    detail: { from: opportunity.stage, to: input.stage, reason, lostReason, lostDetail },
  });
  publishEvent({
    type: "opportunity.stage",
    organizationId: input.organizationId,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId,
    stage: input.stage,
    previousStage: opportunity.stage,
  });
  return updated;
}

export async function setNextAction(input: {
  organizationId: string;
  opportunityId: string;
  kind: NextActionKind | null;
  at: Date | null;
  actorUserId?: string | null;
  actorKind?: ActorKind;
}) {
  const opportunity = await requireOpportunity(input.organizationId, input.opportunityId);
  if (input.kind && !input.at) throw new OpportunityError("La siguiente acción necesita fecha y hora.");
  const now = new Date();
  await database.opportunity.update({
    where: { id: opportunity.id },
    data: { nextActionKind: input.kind, nextActionAt: input.kind ? input.at : null, lastActivityAt: now },
  });
  await addEvent({
    opportunityId: opportunity.id,
    type: "NEXT_ACTION",
    actorKind: input.actorKind ?? "USER",
    actorUserId: input.actorUserId,
    detail: { kind: input.kind, at: input.kind && input.at ? input.at.toISOString() : null },
  });
}

/** Propuesta con plan vigente del catálogo (BR-017, AC-011). */
export async function setProposal(input: {
  organizationId: string;
  opportunityId: string;
  planId: string | null;
  lines: number;
  fixedCharge: number;
  actorUserId?: string | null;
  actorKind?: ActorKind;
}) {
  const opportunity = await requireOpportunity(input.organizationId, input.opportunityId);
  if (!Number.isInteger(input.lines) || input.lines < 1) throw new OpportunityError("Indica cuántas líneas se ofrecen (al menos una).");
  if (!Number.isFinite(input.fixedCharge) || input.fixedCharge < 0) throw new OpportunityError("El cargo fijo total no es válido.");
  let planName: string | null = null;
  if (input.planId) {
    const plan = await database.planCatalogItem.findFirst({
      where: { id: input.planId, organizationId: input.organizationId, OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] },
      select: { name: true },
    });
    if (!plan) throw new OpportunityError("Ese plan ya no está vigente: elige uno del catálogo actual.");
    planName = plan.name;
  }
  const now = new Date();
  await database.opportunity.update({
    where: { id: opportunity.id },
    data: { proposalPlanId: input.planId, proposalLines: input.lines, proposalFixedCharge: input.fixedCharge, lastActivityAt: now },
  });
  await addEvent({
    opportunityId: opportunity.id,
    type: "PROPOSAL",
    actorKind: input.actorKind ?? "USER",
    actorUserId: input.actorUserId,
    detail: { planId: input.planId, planName, lines: input.lines, fixedCharge: input.fixedCharge },
  });
}

export async function assign(input: {
  organizationId: string;
  opportunityId: string;
  assignedUserId: string | null;
  actorUserId?: string | null;
  actorKind?: ActorKind;
  reason?: string | null;
}) {
  const opportunity = await requireOpportunity(input.organizationId, input.opportunityId);
  if (opportunity.assignedUserId === input.assignedUserId) return;
  if (input.assignedUserId) {
    const member = await database.organizationMember.findFirst({ where: { organizationId: input.organizationId, userId: input.assignedUserId } });
    if (!member) throw new OpportunityError("Ese usuario no pertenece a tu empresa.");
  }
  await database.opportunity.update({
    where: { id: opportunity.id },
    data: { assignedUserId: input.assignedUserId, lastActivityAt: new Date() },
  });
  await addEvent({
    opportunityId: opportunity.id,
    type: "ASSIGNED",
    actorKind: input.actorKind ?? "USER",
    actorUserId: input.actorUserId,
    detail: { from: opportunity.assignedUserId, to: input.assignedUserId, reason: input.reason ?? null },
  });
}

/** Interno: la oportunidad se gana al vincular un pedido ingresado (BR-008). */
export async function markWon(input: { organizationId: string; opportunityId: string; orderId: string; actorUserId?: string | null; actorKind?: ActorKind }) {
  const opportunity = await requireOpportunity(input.organizationId, input.opportunityId);
  const order = await database.order.findFirst({ where: { id: input.orderId, organizationId: input.organizationId }, select: { externalRef: true, status: true } });
  if (!order) throw new OpportunityError("El pedido no existe o no pertenece a tu empresa.");
  const now = new Date();
  const actorKind = input.actorKind ?? "SYSTEM";
  await addEvent({
    opportunityId: opportunity.id,
    type: "ORDER_LINKED",
    actorKind,
    actorUserId: input.actorUserId,
    detail: { orderId: input.orderId, externalRef: order.externalRef, status: order.status },
  });
  if (opportunity.stage === "GANADA") {
    await database.opportunity.update({ where: { id: opportunity.id }, data: { lastActivityAt: now } });
    return;
  }
  const verdict = canTransition(opportunity.stage, "GANADA", "SYSTEM");
  if (!verdict.allowed) throw new OpportunityError(verdict.message);
  await database.opportunity.update({
    where: { id: opportunity.id },
    data: { stage: "GANADA", stageChangedAt: now, wonAt: now, closedAt: now, lastActivityAt: now, lostReason: null, lostDetail: null },
  });
  await addEvent({
    opportunityId: opportunity.id,
    type: "STAGE_CHANGED",
    actorKind: "SYSTEM",
    actorUserId: null,
    detail: { from: opportunity.stage, to: "GANADA", reason: `pedido ${order.externalRef} vinculado`, lostReason: null, lostDetail: null },
  });
  publishEvent({
    type: "opportunity.stage",
    organizationId: input.organizationId,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId,
    stage: "GANADA",
    previousStage: opportunity.stage,
  });
}

/** BR-010: el pedido vinculado se canceló; la oportunidad sigue ganada con la marca. */
export async function markOrderDropped(input: { organizationId: string; opportunityId: string; orderId: string; actorUserId?: string | null; actorKind?: ActorKind }) {
  const opportunity = await requireOpportunity(input.organizationId, input.opportunityId);
  const order = await database.order.findFirst({ where: { id: input.orderId, organizationId: input.organizationId }, select: { externalRef: true } });
  await database.opportunity.update({ where: { id: opportunity.id }, data: { orderDropped: true, lastActivityAt: new Date() } });
  await addEvent({
    opportunityId: opportunity.id,
    type: "ORDER_DROPPED",
    actorKind: input.actorKind ?? "USER",
    actorUserId: input.actorUserId,
    detail: { orderId: input.orderId, externalRef: order?.externalRef ?? null },
  });
}

/** Quita el vínculo. Si era el único pedido de una ganada, vuelve a En cierre con el motivo. */
export async function recordOrderUnlinked(input: {
  organizationId: string;
  opportunityId: string;
  orderId: string;
  externalRef: string;
  reason: string;
  actorUserId?: string | null;
}) {
  const opportunity = await requireOpportunity(input.organizationId, input.opportunityId);
  await addEvent({
    opportunityId: opportunity.id,
    type: "ORDER_UNLINKED",
    actorKind: "USER",
    actorUserId: input.actorUserId,
    detail: { orderId: input.orderId, externalRef: input.externalRef, reason: input.reason },
  });
  const remaining = await database.order.count({ where: { organizationId: input.organizationId, opportunityId: opportunity.id } });
  if (opportunity.stage === "GANADA" && remaining === 0) {
    const now = new Date();
    await database.opportunity.update({
      where: { id: opportunity.id },
      data: { stage: "EN_CIERRE", stageChangedAt: now, wonAt: null, closedAt: null, orderDropped: false, lastActivityAt: now },
    });
    await addEvent({
      opportunityId: opportunity.id,
      type: "STAGE_CHANGED",
      actorKind: "SYSTEM",
      detail: { from: "GANADA", to: "EN_CIERRE", reason: `pedido ${input.externalRef} desvinculado: ${input.reason}`, lostReason: null, lostDetail: null },
    });
    publishEvent({
      type: "opportunity.stage",
      organizationId: input.organizationId,
      opportunityId: opportunity.id,
      contactId: opportunity.contactId,
      stage: "EN_CIERRE",
      previousStage: "GANADA",
    });
  } else {
    await database.opportunity.update({ where: { id: opportunity.id }, data: { lastActivityAt: new Date() } });
  }
}

/** BR-003: 30 días sin actividad → PERDIDA «sin actividad». Devuelve cuántas cerró. */
export async function closeStaleOpportunities(organizationId: string, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - staleAfterDays * 86_400_000);
  const stale = await database.opportunity.findMany({
    where: { organizationId, stage: OPEN_STAGE_FILTER, lastActivityAt: { lt: cutoff } },
    select: { id: true },
  });
  let closed = 0;
  for (const { id } of stale) {
    try {
      await setStage({ organizationId, opportunityId: id, stage: "PERDIDA", actorKind: "SYSTEM", lostReason: STALE_LOST_REASON, lostDetail: `Sin actividad desde hace ${staleAfterDays} días.` });
      closed += 1;
    } catch (error) {
      console.error(`No se pudo cerrar por inactividad la oportunidad ${id}`, error);
    }
  }
  return closed;
}

export async function touchActivity(opportunityId: string, at = new Date()): Promise<void> {
  await database.opportunity.updateMany({ where: { id: opportunityId }, data: { lastActivityAt: at } });
}
