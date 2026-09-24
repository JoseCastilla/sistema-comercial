import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ContactOrigin, CustomerRelation, OpportunityStage } from "@/generated/prisma/enums";

import type { Access } from "../auth/access";
import { database } from "../database";
import type { ResultOpportunity, ResultOrder } from "./results";
import { ALL_STAGES, daysInStage, OPEN_STAGES } from "./rules";

/**
 * Lecturas del embudo. El alcance por rol (SPEC-054 BR-001): el asesor ve
 * solo lo suyo; dueño, supervisor y back office ven toda la empresa.
 */

export interface PipelineFilters {
  assignedUserId?: string | null;
  origin?: ContactOrigin | null;
  /** Grupo de orígenes (campaña / base / desconocido) para los enlaces de Resultados. */
  origins?: ContactOrigin[] | null;
  relation?: CustomerRelation | null;
  stage?: OpportunityStage | null;
  includeClosed?: boolean;
  /** Solo las que llegaron a CALIFICADO o más, aunque hoy estén en otra etapa. */
  reachedQualified?: boolean;
  /** Cohorte por fecha de apertura (los resultados enlazan con este rango). */
  openedFrom?: Date | null;
  openedTo?: Date | null;
}

export function scopeWhere(access: Access): Prisma.OpportunityWhereInput {
  return access.role === "AGENT" ? { organizationId: access.organizationId, assignedUserId: access.userId } : { organizationId: access.organizationId };
}

const QUALIFIED_STAGES: OpportunityStage[] = ["CALIFICADO", "PROPUESTA", "EN_CIERRE", "GANADA"];

/**
 * «Llegó a calificado»: la etapa de hoy o cualquiera por la que pasó. Es la
 * misma cuenta que muestra Resultados, así que el enlace y la cifra coinciden.
 */
function reachedQualifiedWhere(): Prisma.OpportunityWhereInput {
  return {
    OR: [
      { stage: { in: QUALIFIED_STAGES } },
      ...QUALIFIED_STAGES.map((stage) => ({
        events: { some: { type: "STAGE_CHANGED", detail: { path: ["to"], equals: stage } } },
      })),
    ],
  };
}

/** Tarjeta del tablero: datos planos, listos para un componente de cliente. */
export interface PipelineCard {
  id: string;
  stage: OpportunityStage;
  stageChangedAt: string;
  origin: ContactOrigin;
  customerRelation: CustomerRelation;
  contactName: string;
  contactPhone: string | null;
  assignedName: string | null;
  nextActionKind: string | null;
  nextActionAt: string | null;
  /** Se calcula en el servidor para que la tarjeta no dependa del reloj del navegador. */
  nextActionOverdue: boolean;
  daysInStage: number;
  proposalFixedCharge: number | null;
  proposalLines: number | null;
  orderDropped: boolean;
  createdAt: string;
}

export async function listPipeline(access: Access, filters: PipelineFilters): Promise<PipelineCard[]> {
  const stages = filters.stage ? [filters.stage] : filters.includeClosed ? [...ALL_STAGES] : [...OPEN_STAGES];
  const rows = await database.opportunity.findMany({
    where: {
      ...scopeWhere(access),
      stage: { in: stages },
      ...(filters.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}),
      ...(filters.origin ? { origin: filters.origin } : filters.origins?.length ? { origin: { in: filters.origins } } : {}),
      ...(filters.relation ? { customerRelation: filters.relation } : {}),
      ...(filters.openedFrom || filters.openedTo
        ? { createdAt: { ...(filters.openedFrom ? { gte: filters.openedFrom } : {}), ...(filters.openedTo ? { lt: filters.openedTo } : {}) } }
        : {}),
      ...(filters.reachedQualified ? reachedQualifiedWhere() : {}),
    },
    orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }, { lastActivityAt: "desc" }],
    select: {
      id: true,
      stage: true,
      stageChangedAt: true,
      origin: true,
      customerRelation: true,
      assignedUserId: true,
      nextActionKind: true,
      nextActionAt: true,
      proposalFixedCharge: true,
      proposalLines: true,
      orderDropped: true,
      createdAt: true,
      contact: { select: { displayName: true, phone: true } },
    },
  });
  const users = await memberNames(access.organizationId);
  const now = new Date();
  return rows.map((row) => ({
    id: row.id,
    stage: row.stage,
    stageChangedAt: row.stageChangedAt.toISOString(),
    origin: row.origin,
    customerRelation: row.customerRelation,
    contactName: row.contact.displayName ?? row.contact.phone ?? "Sin nombre",
    contactPhone: row.contact.phone,
    assignedName: row.assignedUserId ? (users.get(row.assignedUserId) ?? null) : null,
    nextActionKind: row.nextActionKind,
    nextActionAt: row.nextActionAt?.toISOString() ?? null,
    nextActionOverdue: row.nextActionAt !== null && row.nextActionAt.getTime() < now.getTime(),
    daysInStage: daysInStage(row.stageChangedAt, now),
    proposalFixedCharge: row.proposalFixedCharge === null ? null : Number(row.proposalFixedCharge),
    proposalLines: row.proposalLines,
    orderDropped: row.orderDropped,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Nombre por id de usuario de la empresa. */
export async function memberNames(organizationId: string): Promise<Map<string, string>> {
  const members = await database.organizationMember.findMany({
    where: { organizationId },
    select: { userId: true, user: { select: { name: true } } },
  });
  return new Map(members.map((member) => [member.userId, member.user.name]));
}

/** Asesores asignables (todos menos back office), con nombre. */
export async function assignableMembers(organizationId: string) {
  const members = await database.organizationMember.findMany({
    where: { organizationId, role: { in: ["OWNER", "SUPERVISOR", "AGENT"] }, user: { status: "ACTIVE" } },
    select: { userId: true, role: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return members.map((member) => ({ userId: member.userId, name: member.user.name, role: member.role }));
}

export async function getOpportunityDetail(access: Access, opportunityId: string) {
  return database.opportunity.findFirst({
    where: { id: opportunityId, ...scopeWhere(access) },
    include: {
      contact: true,
      conversation: { select: { id: true, status: true, assignedUserId: true } },
      proposalPlan: { select: { id: true, name: true, fixedCharge: true, validUntil: true } },
      orders: { orderBy: { registeredAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function activePlans(organizationId: string) {
  const plans = await database.planCatalogItem.findMany({
    where: { organizationId, OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true, fixedCharge: true },
  });
  return plans.map((plan) => ({ id: plan.id, name: plan.name, kind: plan.kind, fixedCharge: Number(plan.fixedCharge) }));
}

/** Cohorte del período por fecha de apertura, con sus pedidos, más los pedidos sin oportunidad registrados en el período. */
export async function loadResultsInput(organizationId: string, from: Date, to: Date): Promise<{ opportunities: ResultOpportunity[]; unlinkedOrders: ResultOrder[] }> {
  const opportunities = await database.opportunity.findMany({
    where: { organizationId, createdAt: { gte: from, lt: to } },
    select: {
      origin: true,
      customerRelation: true,
      stage: true,
      orders: { select: { status: true, fixedCharge: true } },
      events: { where: { type: "STAGE_CHANGED" }, select: { detail: true } },
    },
  });
  const unlinked = await database.order.findMany({
    where: { organizationId, opportunityId: null, registeredAt: { gte: from, lt: to } },
    select: { status: true, fixedCharge: true },
  });
  return {
    opportunities: opportunities.map((row) => ({
      origin: row.origin,
      relation: row.customerRelation,
      stage: row.stage,
      stagesVisited: row.events
        .map((event) => (event.detail && typeof event.detail === "object" && !Array.isArray(event.detail) ? (event.detail as { to?: unknown }).to : null))
        .filter((stage): stage is OpportunityStage => typeof stage === "string" && (ALL_STAGES as string[]).includes(stage)),
      orders: row.orders.map((order) => ({ status: order.status, fixedCharge: order.fixedCharge === null ? null : Number(order.fixedCharge) })),
    })),
    unlinkedOrders: unlinked.map((order) => ({ status: order.status, fixedCharge: order.fixedCharge === null ? null : Number(order.fixedCharge) })),
  };
}
