import "server-only";

import type { OrderStatus } from "@/generated/prisma/enums";

import { audit } from "../audit";
import { database } from "../database";
import { publishEvent } from "../events/bus";
import { normalizeDocument, orderLinkCandidates, phoneKey, type OrderLinkDecision } from "../opportunities/rules";
import { markOrderDropped, markWon, OpportunityError, recordOrderUnlinked } from "../opportunities/service";

/**
 * Pedido provisional del MVP (SPEC-062 M-06): en el acople lo reemplaza el
 * pedido DITO. Aquí solo se registra, se vincula a una oportunidad y se
 * cambia su estado operativo (BR-009). Nunca se escribe en sistemas externos.
 */

export class OrderError extends Error {}

/** Transiciones de estado operativo: INGRESADO → ENTREGADO → ACTIVADO; CANCELADO desde cualquiera. */
export function canChangeOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (to === "CANCELADO") return from !== "CANCELADO";
  if (from === "INGRESADO") return to === "ENTREGADO";
  if (from === "ENTREGADO") return to === "ACTIVADO";
  return false;
}

export function nextOrderStatuses(from: OrderStatus): OrderStatus[] {
  return (["ENTREGADO", "ACTIVADO", "CANCELADO"] as const).filter((to) => canChangeOrderStatus(from, to));
}

async function requireOrder(organizationId: string, orderId: string) {
  const order = await database.order.findFirst({ where: { id: orderId, organizationId } });
  if (!order) throw new OrderError("El pedido no existe o no pertenece a tu empresa.");
  return order;
}

/** Contacto de la empresa por DNI o por teléfono (últimos nueve dígitos). */
async function findContactFor(organizationId: string, documentNumber: string | null, phone: string | null) {
  const document = normalizeDocument(documentNumber);
  if (document) {
    const byDocument = await database.contact.findFirst({ where: { organizationId, documentNumber: document }, select: { id: true } });
    if (byDocument) return byDocument.id;
  }
  const key = phoneKey(phone);
  if (key) {
    const byPhone = await database.contact.findFirst({ where: { organizationId, phone: { endsWith: key } }, select: { id: true } });
    if (byPhone) return byPhone.id;
  }
  return null;
}

/** Candidatas de vínculo para un pedido (BR-011), calculadas con la regla pura. */
export async function candidatesForOrder(organizationId: string, order: { documentNumber: string | null; phone: string | null; contactId: string | null }) {
  const document = normalizeDocument(order.documentNumber);
  const key = phoneKey(order.phone);
  const opportunities = await database.opportunity.findMany({
    where: {
      organizationId,
      OR: [
        ...(order.contactId ? [{ contactId: order.contactId }] : []),
        ...(document ? [{ contact: { documentNumber: document } }] : []),
        ...(key ? [{ contact: { phone: { endsWith: key } } }] : []),
      ],
    },
    select: {
      id: true,
      stage: true,
      closedAt: true,
      contact: { select: { documentNumber: true, phone: true } },
    },
  });
  const decision = orderLinkCandidates({
    orderDocument: order.documentNumber,
    orderPhone: order.phone,
    opportunities: opportunities.map((opportunity) => ({
      id: opportunity.id,
      stage: opportunity.stage,
      documentNumber: opportunity.contact.documentNumber,
      phone: opportunity.contact.phone,
      closedAt: opportunity.closedAt,
    })),
  });
  return decision;
}

/** Datos de las oportunidades candidatas, para que la pantalla pueda elegir. */
export async function candidateSummaries(organizationId: string, opportunityIds: string[]) {
  if (opportunityIds.length === 0) return [];
  const rows = await database.opportunity.findMany({
    where: { organizationId, id: { in: opportunityIds } },
    orderBy: { lastActivityAt: "desc" },
    select: {
      id: true,
      stage: true,
      origin: true,
      lastActivityAt: true,
      contact: { select: { displayName: true, phone: true, documentNumber: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    stage: row.stage,
    origin: row.origin,
    lastActivityAt: row.lastActivityAt,
    contactName: row.contact.displayName ?? row.contact.phone ?? "Sin nombre",
    contactPhone: row.contact.phone,
    documentNumber: row.contact.documentNumber,
  }));
}

/** Lista de pedidos con su contacto y su oportunidad, para la pantalla de Pedidos. */
export async function listOrders(input: { organizationId: string; status?: OrderStatus | null; from?: Date | null; to?: Date | null }) {
  return database.order.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.from || input.to
        ? { registeredAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lt: input.to } : {}) } }
        : {}),
    },
    orderBy: { registeredAt: "desc" },
    take: 200,
    select: {
      id: true,
      externalRef: true,
      documentNumber: true,
      holderName: true,
      phone: true,
      planName: true,
      fixedCharge: true,
      status: true,
      registeredAt: true,
      linkConfidence: true,
      opportunityId: true,
      opportunity: { select: { id: true, contact: { select: { displayName: true, phone: true } } } },
    },
  });
}

export async function createOrder(input: {
  organizationId: string;
  actorUserId: string;
  externalRef: string;
  documentNumber: string | null;
  holderName: string | null;
  phone: string | null;
  planName: string | null;
  fixedCharge: number | null;
  registeredAt: Date | null;
}): Promise<{ orderId: string; decision: OrderLinkDecision }> {
  const externalRef = input.externalRef.trim();
  if (!externalRef) throw new OrderError("La referencia del pedido es obligatoria.");
  const duplicate = await database.order.findFirst({ where: { organizationId: input.organizationId, externalRef }, select: { id: true } });
  if (duplicate) throw new OrderError(`Ya existe un pedido con la referencia ${externalRef}.`);
  if (input.fixedCharge !== null && (!Number.isFinite(input.fixedCharge) || input.fixedCharge < 0)) throw new OrderError("El cargo fijo no es válido.");

  const documentNumber = normalizeDocument(input.documentNumber) || null;
  const phone = input.phone?.replace(/\D/g, "") || null;
  const contactId = await findContactFor(input.organizationId, documentNumber, phone);
  if (contactId && documentNumber) {
    // El DNI que llega con el pedido completa el contacto si no lo tenía (BR-006).
    await database.contact.updateMany({ where: { id: contactId, organizationId: input.organizationId, documentNumber: null }, data: { documentNumber } });
  }

  const order = await database.order.create({
    data: {
      organizationId: input.organizationId,
      contactId,
      externalRef,
      documentNumber,
      holderName: input.holderName,
      phone,
      planName: input.planName,
      fixedCharge: input.fixedCharge,
      status: "INGRESADO",
      registeredAt: input.registeredAt ?? new Date(),
      createdByUserId: input.actorUserId,
    },
  });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "order.created",
    targetKind: "order",
    targetId: order.id,
    detail: { externalRef, documentNumber, phone, planName: input.planName, fixedCharge: input.fixedCharge },
  });

  const decision = await candidatesForOrder(input.organizationId, { documentNumber, phone, contactId });
  if (decision.kind === "AUTO") {
    await linkOrder({ organizationId: input.organizationId, orderId: order.id, opportunityId: decision.opportunityId, actorUserId: input.actorUserId, automatic: true });
  }
  publishEvent({
    type: "order.status",
    organizationId: input.organizationId,
    orderId: order.id,
    opportunityId: decision.kind === "AUTO" ? decision.opportunityId : undefined,
    contactId: contactId ?? undefined,
    status: "INGRESADO",
  });
  return { orderId: order.id, decision };
}

/** Vincula el pedido a una sola oportunidad (BR-012) y la gana (BR-008). */
export async function linkOrder(input: { organizationId: string; orderId: string; opportunityId: string; actorUserId: string | null; automatic?: boolean }) {
  const order = await requireOrder(input.organizationId, input.orderId);
  if (order.opportunityId && order.opportunityId !== input.opportunityId) {
    throw new OrderError("El pedido ya está vinculado a otra oportunidad. Desvincúlalo primero.");
  }
  const opportunity = await database.opportunity.findFirst({
    where: { id: input.opportunityId, organizationId: input.organizationId },
    select: { id: true, contactId: true, stage: true },
  });
  if (!opportunity) throw new OpportunityError("La oportunidad no existe o no pertenece a tu empresa.");
  if (order.opportunityId === opportunity.id) return;

  await database.order.update({
    where: { id: order.id },
    data: { opportunityId: opportunity.id, contactId: order.contactId ?? opportunity.contactId, linkConfidence: "CONFIRMED" },
  });
  await markWon({ organizationId: input.organizationId, opportunityId: opportunity.id, orderId: order.id, actorUserId: input.actorUserId, actorKind: input.automatic ? "SYSTEM" : "USER" });
  if (order.status === "CANCELADO") {
    await markOrderDropped({ organizationId: input.organizationId, opportunityId: opportunity.id, orderId: order.id, actorUserId: input.actorUserId, actorKind: input.automatic ? "SYSTEM" : "USER" });
  }
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.automatic ? "order.linked.auto" : "order.linked",
    targetKind: "order",
    targetId: order.id,
    detail: { opportunityId: opportunity.id, externalRef: order.externalRef },
  });
}

export async function unlinkOrder(input: { organizationId: string; orderId: string; actorUserId: string; reason: string }) {
  const order = await requireOrder(input.organizationId, input.orderId);
  if (!order.opportunityId) throw new OrderError("El pedido no está vinculado a ninguna oportunidad.");
  const reason = input.reason.trim();
  if (!reason) throw new OrderError("Desvincular pide un motivo.");
  const opportunityId = order.opportunityId;
  await database.order.update({ where: { id: order.id }, data: { opportunityId: null, linkConfidence: null } });
  await recordOrderUnlinked({ organizationId: input.organizationId, opportunityId, orderId: order.id, externalRef: order.externalRef, reason, actorUserId: input.actorUserId });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "order.unlinked",
    targetKind: "order",
    targetId: order.id,
    detail: { opportunityId, externalRef: order.externalRef, reason },
  });
}

export async function setOrderStatus(input: { organizationId: string; orderId: string; status: OrderStatus; actorUserId: string }) {
  const order = await requireOrder(input.organizationId, input.orderId);
  if (!canChangeOrderStatus(order.status, input.status)) {
    throw new OrderError(`Un pedido ${order.status.toLowerCase()} no puede pasar a ${input.status.toLowerCase()}.`);
  }
  const now = new Date();
  await database.order.update({
    where: { id: order.id },
    data: {
      status: input.status,
      ...(input.status === "ENTREGADO" ? { deliveredAt: now } : {}),
      ...(input.status === "ACTIVADO" ? { activatedAt: now, deliveredAt: order.deliveredAt ?? now } : {}),
      ...(input.status === "CANCELADO" ? { cancelledAt: now } : {}),
    },
  });
  if (input.status === "CANCELADO" && order.opportunityId) {
    // BR-010: la oportunidad sigue ganada, con la marca de pedido caído.
    await markOrderDropped({ organizationId: input.organizationId, opportunityId: order.opportunityId, orderId: order.id, actorUserId: input.actorUserId, actorKind: "USER" });
  }
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: `order.status.${input.status.toLowerCase()}`,
    targetKind: "order",
    targetId: order.id,
    detail: { from: order.status, to: input.status, externalRef: order.externalRef },
  });
  publishEvent({
    type: "order.status",
    organizationId: input.organizationId,
    orderId: order.id,
    opportunityId: order.opportunityId ?? undefined,
    contactId: order.contactId ?? undefined,
    status: input.status,
  });
}
