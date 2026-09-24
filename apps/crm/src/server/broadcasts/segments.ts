import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { ContactOrigin, OpportunityStage } from "@/generated/prisma/enums";

import { database } from "../database";
import { ADVISOR_ACTIVITY_HOURS, MARKETING_COOLDOWN_DAYS, type RecipientFacts } from "./rules";

/**
 * Segmentos de difusión (SPEC-059 BR-002). Filtros sobre la ficha del contacto
 * y su conversación, resueltos al programar y no al crear.
 *
 * La base nacional de Campañas no vive en este CRM (BR-004): acá solo hay
 * contactos que escribieron al número o que alguien dio de alta a mano, así
 * que no hay nada que excluir por ese lado. La pantalla igual lo dice, para
 * que nadie intente subir una lista comprada.
 */

const STAGES = ["NUEVO", "EN_CONTACTO", "CALIFICADO", "PROPUESTA", "EN_CIERRE", "GANADA", "PERDIDA"] as const;
const ORIGINS = ["AD", "BROADCAST", "REFERRAL", "ADVISOR", "ORGANIC", "UNKNOWN"] as const;

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha va como 2026-09-12");

export const segmentSchema = z.object({
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
  stages: z.array(z.enum(STAGES)).max(STAGES.length).optional(),
  origins: z.array(z.enum(ORIGINS)).max(ORIGINS.length).optional(),
  /** Escribió después de esta fecha (inclusive), en hora de Lima. */
  lastInboundAfter: isoDay.optional(),
  /** Escribió antes de esta fecha (inclusive), en hora de Lima. */
  lastInboundBefore: isoDay.optional(),
  district: z.string().trim().min(1).max(120).optional(),
  hasOpenOpportunity: z.boolean().optional(),
  marketingOptInOnly: z.boolean().optional(),
});

export type Segment = z.infer<typeof segmentSchema>;

/**
 * Lo que se guarda en `Broadcast.segment`: los filtros más el reparto por día
 * que se congela al programar. No hay columna `BroadcastRecipient.scheduledFor`
 * en el esquema, así que el plan vive acá (ver informe del módulo).
 */
export const storedSegmentSchema = segmentSchema.extend({
  /** Día calendario en Lima → contactos que salen ese día. */
  schedulePlan: z.record(z.string(), z.array(z.string())).optional(),
});

export type StoredSegment = z.infer<typeof storedSegmentSchema>;

export function parseSegment(value: unknown): Segment {
  const parsed = segmentSchema.safeParse(value ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "El segmento no es válido.");
  }
  return parsed.data;
}

export function parseStoredSegment(value: unknown): StoredSegment {
  const parsed = storedSegmentSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

/** Resumen del segmento en una línea, para la lista y la previsualización. */
export function describeSegment(segment: Segment): string {
  const parts: string[] = [];
  if (segment.tags?.length) parts.push(`etiquetas: ${segment.tags.join(", ")}`);
  if (segment.stages?.length) parts.push(`etapa: ${segment.stages.join(", ").toLowerCase().replace(/_/g, " ")}`);
  if (segment.origins?.length) parts.push(`origen: ${segment.origins.join(", ").toLowerCase()}`);
  if (segment.district) parts.push(`distrito: ${segment.district}`);
  if (segment.lastInboundAfter) parts.push(`escribió desde el ${segment.lastInboundAfter}`);
  if (segment.lastInboundBefore) parts.push(`escribió hasta el ${segment.lastInboundBefore}`);
  if (segment.hasOpenOpportunity === true) parts.push("con oportunidad abierta");
  if (segment.hasOpenOpportunity === false) parts.push("sin oportunidad abierta");
  if (segment.marketingOptInOnly) parts.push("solo quienes aceptaron promociones");
  return parts.length ? parts.join(" · ") : "todos los contactos de la empresa";
}

const OPEN_STAGES: OpportunityStage[] = ["NUEVO", "EN_CONTACTO", "CALIFICADO", "PROPUESTA", "EN_CIERRE"];

/**
 * Códigos de Meta que dejan a alguien fuera para siempre: el número no tiene
 * WhatsApp o la persona bloqueó al negocio. Un fallo así no se cura con
 * reintentar, por eso vale para difusiones futuras y no solo para esta.
 */
export const BLOCKING_ERROR_CODES = ["131026", "131047", "131050", "131051", "133010"];

/** Contacto del segmento con todo lo que necesitan las exclusiones y la vista previa. */
export interface SegmentContact extends RecipientFacts {
  displayName: string | null;
  district: string | null;
}

function dayBoundary(day: string, endOfDay = false): Date {
  // Lima es UTC-5 todo el año.
  return new Date(`${day}T${endOfDay ? "23:59:59" : "00:00:00"}-05:00`);
}

/**
 * Resuelve el segmento a contactos de la organización, con los datos que
 * necesita `evaluateRecipient`. Se recalcula cada vez: nunca se guarda una
 * lista de personas hasta que la difusión se programa.
 */
export async function resolveSegment(
  organizationId: string,
  segment: Segment,
  now = new Date(),
): Promise<SegmentContact[]> {
  const where: Prisma.ContactWhereInput = { organizationId };

  if (segment.tags?.length) where.tags = { hasSome: segment.tags };
  if (segment.district) where.district = { equals: segment.district, mode: "insensitive" };
  if (segment.marketingOptInOnly) where.marketingOptIn = true;

  if (segment.lastInboundAfter || segment.lastInboundBefore) {
    where.lastInboundAt = {
      ...(segment.lastInboundAfter ? { gte: dayBoundary(segment.lastInboundAfter) } : {}),
      ...(segment.lastInboundBefore ? { lte: dayBoundary(segment.lastInboundBefore, true) } : {}),
    };
  }

  if (segment.origins?.length) where.initialOrigin = { in: segment.origins as ContactOrigin[] };

  const opportunityFilters: Prisma.ContactWhereInput[] = [];
  if (segment.stages?.length) {
    opportunityFilters.push({ opportunities: { some: { organizationId, stage: { in: segment.stages as OpportunityStage[] } } } });
  }
  if (segment.hasOpenOpportunity === true) {
    opportunityFilters.push({ opportunities: { some: { organizationId, stage: { in: OPEN_STAGES } } } });
  }
  if (segment.hasOpenOpportunity === false) {
    opportunityFilters.push({ opportunities: { none: { organizationId, stage: { in: OPEN_STAGES } } } });
  }
  if (opportunityFilters.length) where.AND = opportunityFilters;

  const contacts = await database.contact.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      displayName: true,
      phone: true,
      district: true,
      tags: true,
      marketingOptIn: true,
      marketingOptOutAt: true,
      consents: {
        where: { category: "MARKETING" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { granted: true },
      },
    },
  });
  if (!contacts.length) return [];

  const ids = contacts.map((contact) => contact.id);
  const marketingSince = new Date(now.getTime() - MARKETING_COOLDOWN_DAYS * 86_400_000);
  const advisorSince = new Date(now.getTime() - ADVISOR_ACTIVITY_HOURS * 3_600_000);

  const [marketingSends, attended, failures] = await Promise.all([
    // Plantillas de marketing que ya salieron en la semana.
    database.message.findMany({
      where: {
        organizationId,
        direction: "OUTBOUND",
        status: { in: ["SENT", "DELIVERED", "READ"] },
        createdAt: { gte: marketingSince },
        template: { category: "MARKETING" },
        conversation: { contactId: { in: ids } },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, conversation: { select: { contactId: true } } },
    }),
    // Conversación abierta, con asesor y movimiento en las últimas 24 h.
    database.conversation.findMany({
      where: {
        organizationId,
        contactId: { in: ids },
        status: "OPEN",
        assignedUserId: { not: null },
        lastMessageAt: { gte: advisorSince },
      },
      orderBy: { lastMessageAt: "desc" },
      select: { contactId: true, lastMessageAt: true },
    }),
    // Fallos permanentes: número inexistente o bloqueo.
    database.message.findMany({
      where: {
        organizationId,
        direction: "OUTBOUND",
        status: "FAILED",
        errorCode: { in: BLOCKING_ERROR_CODES },
        conversation: { contactId: { in: ids } },
      },
      select: { conversation: { select: { contactId: true } } },
    }),
  ]);

  const lastMarketing = new Map<string, Date>();
  for (const message of marketingSends) {
    const contactId = message.conversation.contactId;
    if (!lastMarketing.has(contactId)) lastMarketing.set(contactId, message.createdAt);
  }
  const advisorActivity = new Map<string, Date>();
  for (const conversation of attended) {
    if (conversation.lastMessageAt && !advisorActivity.has(conversation.contactId)) {
      advisorActivity.set(conversation.contactId, conversation.lastMessageAt);
    }
  }
  const blocked = new Set(failures.map((message) => message.conversation.contactId));

  return contacts.map((contact) => ({
    id: contact.id,
    displayName: contact.displayName,
    phone: contact.phone,
    district: contact.district,
    tags: contact.tags,
    // El último consentimiento manda; si nunca hubo uno, vale la casilla de la ficha.
    marketingConsent: contact.consents[0]?.granted ?? (contact.marketingOptIn ? true : null),
    marketingOptOutAt: contact.marketingOptOutAt,
    lastMarketingSentAt: lastMarketing.get(contact.id) ?? null,
    advisorActivityAt: advisorActivity.get(contact.id) ?? null,
    sendingBlocked: blocked.has(contact.id),
  }));
}

/** Etiquetas que la empresa ya usa, para ofrecerlas en el filtro. */
export async function knownTags(organizationId: string): Promise<string[]> {
  const rows = await database.contact.findMany({
    where: { organizationId, NOT: { tags: { isEmpty: true } } },
    select: { tags: true },
    take: 2_000,
  });
  return [...new Set(rows.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b, "es"));
}

/** Distritos que la empresa ya tiene cargados. */
export async function knownDistricts(organizationId: string): Promise<string[]> {
  const rows = await database.contact.findMany({
    where: { organizationId, district: { not: null } },
    distinct: ["district"],
    select: { district: true },
    take: 300,
  });
  return rows.flatMap((row) => (row.district ? [row.district] : [])).sort((a, b) => a.localeCompare(b, "es"));
}
