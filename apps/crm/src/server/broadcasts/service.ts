import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { BroadcastStatus, OrganizationRole, TemplateCategory } from "@/generated/prisma/enums";

import { audit } from "../audit";
import { database } from "../database";
import { renderTemplateBody, type TemplateVariable } from "../templates/render";
import {
  brakeDecision,
  dailyLimitForTier,
  dailyLimitIsAssumed,
  estimateCost,
  evaluateRecipient,
  exclusionText,
  splitByDailyLimit,
  withinSendWindow,
  type DayBucket,
  type ExclusionReason,
} from "./rules";
import { describeSegment, parseSegment, parseStoredSegment, resolveSegment, type Segment, type SegmentContact } from "./segments";

/**
 * Alta, previsualización, programación y resultados de las difusiones
 * (SPEC-059). Todo filtra por `organizationId`; las acciones sensibles quedan
 * en la auditoría.
 */

export class BroadcastError extends Error {}

export interface Actor {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

function requireManager(actor: Actor) {
  if (actor.role !== "OWNER" && actor.role !== "SUPERVISOR") {
    throw new BroadcastError("Solo el dueño y los supervisores manejan difusiones.");
  }
}

// ───────────────────────── Variables de la plantilla ─────────────────────────

function templateVariables(value: Prisma.JsonValue): TemplateVariable[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const index = Number(record.index);
    if (!Number.isFinite(index)) return [];
    return [{ index, source: String(record.source ?? "manual"), label: typeof record.label === "string" ? record.label : undefined }];
  }).sort((a, b) => a.index - b.index);
}

function manualValues(value: Prisma.JsonValue): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" && raw.trim()) out[key] = raw.trim();
  }
  return out;
}

interface RenderTarget {
  displayName: string | null;
  phone: string | null;
}

/**
 * Renderiza la plantilla para una persona. Devuelve null si le falta un dato
 * obligatorio: esa persona queda excluida con el motivo, nunca con la variable
 * vacía (BR-005).
 */
function renderForContact(
  variables: TemplateVariable[],
  components: Prisma.JsonValue,
  values: Record<string, string>,
  contact: RenderTarget,
): string | null {
  const context: Record<string, string> = {
    "contact.name": contact.displayName?.trim() ?? "",
    "contact.phone": contact.phone?.trim() ?? "",
    "advisor.name": values["advisor.name"] ?? "",
  };
  const parameters: string[] = [];
  for (const variable of variables) {
    const manual = values[String(variable.index)] ?? (variable.label ? values[variable.label] : undefined);
    const value = variable.source === "manual" ? manual : (context[variable.source] || manual);
    if (!value) return null;
    parameters.push(value);
  }
  return renderTemplateBody(components, parameters);
}

// ───────────────────────── Alta y edición ─────────────────────────

export interface BroadcastInput {
  name: string;
  segment: Segment;
  templateId?: string | null;
  variableValues?: Record<string, string>;
}

async function loadApprovedTemplate(organizationId: string, templateId: string) {
  const template = await database.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true, name: true, category: true, status: true, whatsappNumberId: true, components: true, variables: true },
  });
  if (!template) throw new BroadcastError("Esa plantilla no existe o no es de tu empresa.");
  if (template.status !== "APPROVED") {
    throw new BroadcastError("Esa plantilla todavía no está aprobada por Meta: no se puede enviar.");
  }
  return template;
}

/** Plantillas que se pueden usar hoy: aprobadas y de un número conectado. */
export async function usableTemplates(organizationId: string) {
  return database.messageTemplate.findMany({
    where: { organizationId, status: "APPROVED", whatsappNumber: { status: "CONNECTED" } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      components: true,
      variables: true,
      whatsappNumberId: true,
      whatsappNumber: { select: { id: true, displayPhoneNumber: true, verifiedName: true, messagingLimitTier: true } },
    },
  });
}

export async function connectedNumbers(organizationId: string) {
  return database.whatsappNumber.findMany({
    where: { organizationId, status: "CONNECTED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, displayPhoneNumber: true, verifiedName: true, messagingLimitTier: true },
  });
}

export async function createBroadcast(actor: Actor, input: BroadcastInput): Promise<string> {
  requireManager(actor);
  const name = input.name.trim();
  if (!name) throw new BroadcastError("Ponle un nombre a la difusión para reconocerla después.");

  // El esquema exige plantilla desde el inicio: se toma la primera aprobada y
  // el paso 2 la cambia. Sin plantillas aprobadas no hay difusión posible.
  let templateId = input.templateId?.trim() || null;
  if (!templateId) {
    const first = await database.messageTemplate.findFirst({
      where: { organizationId: actor.organizationId, status: "APPROVED", whatsappNumber: { status: "CONNECTED" } },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (!first) throw new BroadcastError("Todavía no tienes plantillas aprobadas por Meta: crea una antes de difundir.");
    templateId = first.id;
  }
  const template = await loadApprovedTemplate(actor.organizationId, templateId);

  const broadcast = await database.broadcast.create({
    data: {
      organizationId: actor.organizationId,
      whatsappNumberId: template.whatsappNumberId,
      templateId: template.id,
      name,
      segment: parseSegment(input.segment) as Prisma.InputJsonValue,
      variableValues: (input.variableValues ?? {}) as Prisma.InputJsonValue,
      status: "DRAFT",
      createdByUserId: actor.userId,
    },
    select: { id: true },
  });
  await audit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action: "broadcast.created",
    targetKind: "broadcast",
    targetId: broadcast.id,
    detail: { name, segment: describeSegment(input.segment) },
  });
  return broadcast.id;
}

export async function getBroadcast(organizationId: string, broadcastId: string) {
  const broadcast = await database.broadcast.findFirst({
    where: { id: broadcastId, organizationId },
    include: {
      template: { select: { id: true, name: true, category: true, components: true, variables: true, status: true } },
      whatsappNumber: { select: { id: true, displayPhoneNumber: true, verifiedName: true, messagingLimitTier: true, status: true } },
    },
  });
  if (!broadcast) throw new BroadcastError("Esa difusión no existe o no es de tu empresa.");
  return broadcast;
}

export async function updateBroadcast(
  actor: Actor,
  broadcastId: string,
  input: Partial<BroadcastInput>,
): Promise<void> {
  requireManager(actor);
  const broadcast = await getBroadcast(actor.organizationId, broadcastId);
  if (broadcast.status !== "DRAFT") {
    throw new BroadcastError("Ya está programada: cancélala y crea otra si necesitas cambiarla.");
  }

  const data: Prisma.BroadcastUpdateInput = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BroadcastError("Ponle un nombre a la difusión para reconocerla después.");
    data.name = name;
  }
  if (input.segment !== undefined) {
    // El plan de reparto se recalcula al programar: no sobrevive a un cambio de filtros.
    data.segment = parseSegment(input.segment) as Prisma.InputJsonValue;
  }
  if (input.templateId) {
    const template = await loadApprovedTemplate(actor.organizationId, input.templateId);
    data.template = { connect: { id: template.id } };
    data.whatsappNumber = { connect: { id: template.whatsappNumberId } };
  }
  if (input.variableValues !== undefined) {
    data.variableValues = input.variableValues as Prisma.InputJsonValue;
  }
  await database.broadcast.update({ where: { id: broadcast.id }, data });
}

// ───────────────────────── Previsualización (BR-007) ─────────────────────────

export interface ExcludedGroup {
  reason: ExclusionReason | string;
  reasonText: string;
  count: number;
  contactIds: string[];
}

export interface BroadcastPreview {
  broadcastId: string;
  templateName: string;
  category: TemplateCategory;
  segmentText: string;
  totalInSegment: number;
  recipients: number;
  excluded: ExcludedGroup[];
  days: DayBucket[];
  schedulePlan: Record<string, string[]>;
  dailyLimit: number | null;
  dailyLimitAssumed: boolean;
  estimatedCostPen: number;
  estimatedCostUsd: number;
  ratePerMessageUsd: number;
  sample: { contactId: string; name: string; body: string }[];
}

interface EvaluationOutcome {
  eligible: SegmentContact[];
  excluded: Map<string, { reasonText: string; contactIds: string[] }>;
}

function evaluateAll(
  contacts: SegmentContact[],
  template: { category: TemplateCategory; components: Prisma.JsonValue; variables: Prisma.JsonValue },
  values: Record<string, string>,
  now: Date,
): EvaluationOutcome {
  const variables = templateVariables(template.variables);
  const eligible: SegmentContact[] = [];
  const excluded = new Map<string, { reasonText: string; contactIds: string[] }>();
  const push = (reason: string, reasonText: string, contactId: string) => {
    const bucket = excluded.get(reason) ?? { reasonText, contactIds: [] };
    bucket.contactIds.push(contactId);
    excluded.set(reason, bucket);
  };

  for (const contact of contacts) {
    const verdict = evaluateRecipient(contact, { now }, template);
    if (!verdict.eligible) {
      push(verdict.reason, verdict.reasonText, contact.id);
      continue;
    }
    // BR-005: quien no tiene el dato de una variable no recibe la variable vacía.
    if (renderForContact(variables, template.components, values, contact) === null) {
      push("FALTA_DATO", exclusionText("FALTA_DATO"), contact.id);
      continue;
    }
    eligible.push(contact);
  }
  return { eligible, excluded };
}

export async function previewBroadcast(
  organizationId: string,
  broadcastId: string,
  options: { startDate?: Date; now?: Date } = {},
): Promise<BroadcastPreview> {
  const broadcast = await getBroadcast(organizationId, broadcastId);
  const now = options.now ?? new Date();
  const segment = parseStoredSegment(broadcast.segment);
  const values = manualValues(broadcast.variableValues);

  const contacts = await resolveSegment(organizationId, segment, now);
  const { eligible, excluded } = evaluateAll(contacts, broadcast.template, values, now);

  const limit = dailyLimitForTier(broadcast.whatsappNumber.messagingLimitTier);
  const start = options.startDate ?? broadcast.scheduledAt ?? now;
  const plan = splitByDailyLimit(eligible.map((contact) => contact.id), limit, start);

  const cost = estimateCost(eligible.length, broadcast.template.category);
  const variables = templateVariables(broadcast.template.variables);
  const sample = eligible.slice(0, 3).map((contact) => ({
    contactId: contact.id,
    name: contact.displayName ?? contact.phone ?? "Sin nombre",
    body: renderForContact(variables, broadcast.template.components, values, contact) ?? "",
  }));

  return {
    broadcastId: broadcast.id,
    templateName: broadcast.template.name,
    category: broadcast.template.category,
    segmentText: describeSegment(segment),
    totalInSegment: contacts.length,
    recipients: eligible.length,
    excluded: [...excluded.entries()]
      .map(([reason, bucket]) => ({ reason, reasonText: bucket.reasonText, count: bucket.contactIds.length, contactIds: bucket.contactIds }))
      .sort((a, b) => b.count - a.count),
    days: plan.days,
    schedulePlan: plan.schedule,
    dailyLimit: limit,
    dailyLimitAssumed: dailyLimitIsAssumed(broadcast.whatsappNumber.messagingLimitTier),
    estimatedCostPen: cost.pen,
    estimatedCostUsd: cost.usd,
    ratePerMessageUsd: cost.ratePerMessageUsd,
    sample,
  };
}

/** Conteo rápido del segmento, sin renderizar ni repartir en días. */
export async function countSegment(organizationId: string, segment: Segment): Promise<number> {
  const contacts = await resolveSegment(organizationId, segment);
  return contacts.length;
}

// ───────────────────────── Programar (BR-001, BR-006) ─────────────────────────

export async function scheduleBroadcast(actor: Actor, broadcastId: string, scheduledAt: Date): Promise<BroadcastPreview> {
  requireManager(actor);
  const broadcast = await getBroadcast(actor.organizationId, broadcastId);
  if (broadcast.status !== "DRAFT") throw new BroadcastError("Esta difusión ya se programó.");
  if (broadcast.template.status !== "APPROVED") {
    throw new BroadcastError("La plantilla ya no está aprobada por Meta: elige otra.");
  }
  if (broadcast.whatsappNumber.status !== "CONNECTED") {
    throw new BroadcastError("El número de WhatsApp no está conectado: nadie recibiría el mensaje.");
  }
  if (Number.isNaN(scheduledAt.getTime())) throw new BroadcastError("La fecha y hora no son válidas.");
  if (!withinSendWindow(scheduledAt)) {
    throw new BroadcastError("Solo se envía de lunes a sábado entre las 9:00 y las 20:00 de Lima. Elige otra hora.");
  }
  // BR-001: marketing lo lanza el dueño; utilidad la puede lanzar un supervisor.
  if (broadcast.template.category === "MARKETING" && actor.role !== "OWNER") {
    throw new BroadcastError("Una difusión de promociones la lanza el dueño del negocio, no un supervisor.");
  }

  const preview = await previewBroadcast(actor.organizationId, broadcast.id, { startDate: scheduledAt });
  if (preview.recipients === 0) {
    throw new BroadcastError("Con estos filtros no queda nadie a quien escribirle. Revisa los excluidos.");
  }

  const rows: Prisma.BroadcastRecipientCreateManyInput[] = [
    ...preview.excluded.flatMap((group) =>
      group.contactIds.map((contactId) => ({
        broadcastId: broadcast.id,
        contactId,
        status: "EXCLUDED",
        exclusionReason: group.reason.slice(0, 120),
      })),
    ),
    ...Object.values(preview.schedulePlan).flatMap((contactIds) =>
      contactIds.map((contactId) => ({ broadcastId: broadcast.id, contactId, status: "PENDING" })),
    ),
  ];

  const storedSegment = { ...parseStoredSegment(broadcast.segment), schedulePlan: preview.schedulePlan };

  await database.$transaction([
    database.broadcastRecipient.deleteMany({ where: { broadcastId: broadcast.id } }),
    database.broadcastRecipient.createMany({ data: rows, skipDuplicates: true }),
    database.broadcast.update({
      where: { id: broadcast.id },
      data: {
        status: "SCHEDULED",
        scheduledAt,
        pauseReason: null,
        segment: storedSegment as Prisma.InputJsonValue,
        approvedByUserId: actor.userId,
      },
    }),
  ]);

  await audit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action: "broadcast.scheduled",
    targetKind: "broadcast",
    targetId: broadcast.id,
    detail: {
      scheduledAt: scheduledAt.toISOString(),
      recipients: preview.recipients,
      excluded: preview.excluded.map((group) => ({ reason: group.reason, count: group.count })),
      days: preview.days.map((bucket) => ({ day: bucket.day, count: bucket.count })),
      estimatedCostPen: preview.estimatedCostPen,
      category: broadcast.template.category,
    },
  });
  return preview;
}

// ───────────────────────── Pausar, reanudar, cancelar ─────────────────────────

export async function pauseBroadcast(actor: Actor, broadcastId: string, reason: string): Promise<void> {
  requireManager(actor);
  const broadcast = await getBroadcast(actor.organizationId, broadcastId);
  if (broadcast.status !== "SENDING" && broadcast.status !== "SCHEDULED") {
    throw new BroadcastError("Solo se puede pausar una difusión programada o en curso.");
  }
  await database.broadcast.update({
    where: { id: broadcast.id },
    data: { status: "PAUSED", pauseReason: reason.trim() || "La pausó una persona." },
  });
  await audit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action: "broadcast.paused",
    targetKind: "broadcast",
    targetId: broadcast.id,
    detail: { reason },
  });
}

/** Pausa del freno automático: la aplica el bucle, sin persona detrás. */
export async function pauseByBrake(broadcastId: string, reason: string): Promise<void> {
  const broadcast = await database.broadcast.findUnique({ where: { id: broadcastId }, select: { id: true, organizationId: true, status: true } });
  if (!broadcast || broadcast.status !== "SENDING") return;
  await database.broadcast.update({ where: { id: broadcast.id }, data: { status: "PAUSED", pauseReason: reason } });
  await audit({
    organizationId: broadcast.organizationId,
    action: "broadcast.paused.brake",
    targetKind: "broadcast",
    targetId: broadcast.id,
    detail: { reason },
  });
}

export async function resumeBroadcast(actor: Actor, broadcastId: string, reason: string): Promise<void> {
  requireManager(actor);
  const broadcast = await getBroadcast(actor.organizationId, broadcastId);
  if (broadcast.status !== "PAUSED") throw new BroadcastError("Esta difusión no está pausada.");
  // BR-009: si la frenó el sistema, la reanuda el dueño y deja dicho por qué.
  if (broadcast.pauseReason && actor.role !== "OWNER") {
    throw new BroadcastError("Se frenó sola por rechazos o fallos: solo el dueño puede reanudarla.");
  }
  if (broadcast.pauseReason && !reason.trim()) {
    throw new BroadcastError("Escribe por qué la reanudas: queda en el registro.");
  }
  const pending = await database.broadcastRecipient.count({ where: { broadcastId: broadcast.id, status: { in: ["PENDING", "QUEUED"] } } });
  // Si la pausaron antes de que llegara su hora, vuelve a esperar esa hora.
  const notYetDue = Boolean(broadcast.scheduledAt && broadcast.scheduledAt > new Date());
  const status: BroadcastStatus = !pending ? "DONE" : notYetDue ? "SCHEDULED" : "SENDING";
  await database.broadcast.update({
    where: { id: broadcast.id },
    data: { status, pauseReason: null, finishedAt: status === "DONE" ? new Date() : null },
  });
  await audit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action: "broadcast.resumed",
    targetKind: "broadcast",
    targetId: broadcast.id,
    detail: { reason: reason.trim() || null, previousPauseReason: broadcast.pauseReason },
  });
}

export async function cancelBroadcast(actor: Actor, broadcastId: string): Promise<void> {
  requireManager(actor);
  const broadcast = await getBroadcast(actor.organizationId, broadcastId);
  if (broadcast.status === "DONE" || broadcast.status === "CANCELLED") {
    throw new BroadcastError("Esta difusión ya terminó.");
  }
  await database.$transaction([
    database.broadcastRecipient.updateMany({ where: { broadcastId: broadcast.id, status: "PENDING" }, data: { status: "CANCELLED" } }),
    database.broadcast.update({ where: { id: broadcast.id }, data: { status: "CANCELLED", finishedAt: new Date(), pauseReason: null } }),
  ]);
  await audit({
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action: "broadcast.cancelled",
    targetKind: "broadcast",
    targetId: broadcast.id,
  });
}

// ───────────────────────── Lista ─────────────────────────

export interface BroadcastRow {
  id: string;
  name: string;
  status: BroadcastStatus;
  category: TemplateCategory;
  templateName: string;
  scheduledAt: Date | null;
  pauseReason: string | null;
  updatedAt: Date;
  recipients: number;
  sent: number;
  delivered: number;
  replied: number;
  failed: number;
  excluded: number;
}

const SENT_LIKE = ["QUEUED", "SENT", "DELIVERED", "READ", "REPLIED", "FAILED"];
const DELIVERED_LIKE = ["DELIVERED", "READ", "REPLIED"];

export async function listBroadcasts(organizationId: string): Promise<BroadcastRow[]> {
  const broadcasts = await database.broadcast.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      scheduledAt: true,
      pauseReason: true,
      updatedAt: true,
      template: { select: { name: true, category: true } },
    },
  });
  if (!broadcasts.length) return [];

  const counts = await database.broadcastRecipient.groupBy({
    by: ["broadcastId", "status"],
    where: { broadcastId: { in: broadcasts.map((broadcast) => broadcast.id) } },
    _count: { _all: true },
  });
  const totalOf = (id: string, statuses: string[]) =>
    counts
      .filter((row) => row.broadcastId === id && statuses.includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);

  return broadcasts.map((broadcast) => ({
    id: broadcast.id,
    name: broadcast.name,
    status: broadcast.status,
    category: broadcast.template.category,
    templateName: broadcast.template.name,
    scheduledAt: broadcast.scheduledAt,
    pauseReason: broadcast.pauseReason,
    updatedAt: broadcast.updatedAt,
    recipients: totalOf(broadcast.id, ["PENDING", ...SENT_LIKE]),
    sent: totalOf(broadcast.id, SENT_LIKE),
    delivered: totalOf(broadcast.id, DELIVERED_LIKE),
    replied: totalOf(broadcast.id, ["REPLIED"]),
    failed: totalOf(broadcast.id, ["FAILED"]),
    excluded: totalOf(broadcast.id, ["EXCLUDED"]),
  }));
}

// ───────────────────────── Resultados (BR-011) ─────────────────────────

export interface BroadcastResults {
  id: string;
  name: string;
  status: BroadcastStatus;
  category: TemplateCategory;
  templateName: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  pauseReason: string | null;
  recipients: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  excluded: number;
  optOuts: number;
  failuresByReason: { reason: string; count: number }[];
  excludedByReason: { reason: string; reasonText: string; count: number }[];
  approximateCostPen: number;
  qualifiedOpportunities: number;
  ordersEntered: number;
  ordersDelivered: number;
  brake: { pause: boolean; reason?: string };
}

/** Ventana de atribución: lo que pasó en los 7 días siguientes al envío. */
const ATTRIBUTION_DAYS = 7;
const QUALIFIED_STAGES = ["CALIFICADO", "PROPUESTA", "EN_CIERRE", "GANADA"] as const;

export async function broadcastResults(organizationId: string, broadcastId: string): Promise<BroadcastResults> {
  const broadcast = await getBroadcast(organizationId, broadcastId);
  const recipients = await database.broadcastRecipient.findMany({
    where: { broadcastId: broadcast.id },
    select: {
      contactId: true,
      status: true,
      exclusionReason: true,
      repliedAt: true,
      message: { select: { status: true, errorCode: true, errorTitle: true, createdAt: true, sentAt: true } },
    },
  });

  const count = (statuses: string[]) => recipients.filter((row) => statuses.includes(row.status)).length;
  const sentRows = recipients.filter((row) => SENT_LIKE.includes(row.status));

  const failuresByReason = new Map<string, number>();
  for (const row of recipients) {
    if (row.status !== "FAILED") continue;
    const reason = row.message?.errorTitle?.trim() || (row.message?.errorCode ? `Meta lo rechazó (código ${row.message.errorCode})` : "Meta no explicó el motivo");
    failuresByReason.set(reason, (failuresByReason.get(reason) ?? 0) + 1);
  }

  const excludedByReason = new Map<string, number>();
  for (const row of recipients) {
    if (row.status !== "EXCLUDED") continue;
    const reason = row.exclusionReason ?? "SIN_MOTIVO";
    excludedByReason.set(reason, (excludedByReason.get(reason) ?? 0) + 1);
  }

  // Atribución: por cada persona, qué pasó en los 7 días siguientes a su envío.
  const windows = new Map<string, { from: Date; to: Date }>();
  for (const row of sentRows) {
    const from = row.message?.sentAt ?? row.message?.createdAt;
    if (!from) continue;
    windows.set(row.contactId, { from, to: new Date(from.getTime() + ATTRIBUTION_DAYS * 86_400_000) });
  }
  const contactIds = [...windows.keys()];

  let optOuts = 0;
  let qualifiedOpportunities = 0;
  let ordersEntered = 0;
  let ordersDelivered = 0;

  if (contactIds.length) {
    const [contacts, opportunities, orders] = await Promise.all([
      database.contact.findMany({
        where: { organizationId, id: { in: contactIds }, marketingOptOutAt: { not: null } },
        select: { id: true, marketingOptOutAt: true },
      }),
      database.opportunity.findMany({
        where: { organizationId, contactId: { in: contactIds }, stage: { in: [...QUALIFIED_STAGES] } },
        select: { contactId: true, stageChangedAt: true },
      }),
      database.order.findMany({
        where: { organizationId, contactId: { in: contactIds } },
        select: { contactId: true, registeredAt: true, deliveredAt: true },
      }),
    ]);

    const inWindow = (contactId: string | null, date: Date | null | undefined) => {
      if (!contactId || !date) return false;
      const window = windows.get(contactId);
      return Boolean(window && date >= window.from && date <= window.to);
    };

    optOuts = contacts.filter((contact) => inWindow(contact.id, contact.marketingOptOutAt)).length;
    qualifiedOpportunities = opportunities.filter((row) => inWindow(row.contactId, row.stageChangedAt)).length;
    ordersEntered = orders.filter((row) => inWindow(row.contactId, row.registeredAt)).length;
    ordersDelivered = orders.filter((row) => inWindow(row.contactId, row.deliveredAt)).length;
  }

  const delivered = count(DELIVERED_LIKE);
  const failed = count(["FAILED"]);
  const sent = sentRows.length;
  // Meta cobra lo que salió, no lo que sigue en cola ni lo que rebotó.
  const cost = estimateCost(count(["SENT", ...DELIVERED_LIKE]), broadcast.template.category);

  return {
    id: broadcast.id,
    name: broadcast.name,
    status: broadcast.status,
    category: broadcast.template.category,
    templateName: broadcast.template.name,
    scheduledAt: broadcast.scheduledAt,
    startedAt: broadcast.startedAt,
    finishedAt: broadcast.finishedAt,
    pauseReason: broadcast.pauseReason,
    recipients: count(["PENDING", ...SENT_LIKE]),
    pending: count(["PENDING", "QUEUED"]),
    sent,
    delivered,
    read: count(["READ", "REPLIED"]),
    replied: count(["REPLIED"]),
    failed,
    excluded: count(["EXCLUDED"]),
    optOuts,
    failuresByReason: [...failuresByReason.entries()].map(([reason, value]) => ({ reason, count: value })).sort((a, b) => b.count - a.count),
    excludedByReason: [...excludedByReason.entries()]
      .map(([reason, value]) => ({ reason, reasonText: exclusionText(reason), count: value }))
      .sort((a, b) => b.count - a.count),
    approximateCostPen: cost.pen,
    qualifiedOpportunities,
    ordersEntered,
    ordersDelivered,
    brake: brakeDecision({ delivered, failed, optOuts, blocked: 0, sent }),
  };
}

/** Nombre y teléfono de unos contactos, para mostrar las listas de excluidos. */
export async function contactLabels(organizationId: string, contactIds: string[]) {
  if (!contactIds.length) return new Map<string, string>();
  const contacts = await database.contact.findMany({
    where: { organizationId, id: { in: contactIds.slice(0, 300) } },
    select: { id: true, displayName: true, phone: true },
  });
  return new Map(contacts.map((contact) => [contact.id, contact.displayName ?? contact.phone ?? "Sin nombre"]));
}

/** Personas de la difusión en un estado, para las listas que cuelgan de cada cifra. */
export async function listRecipients(organizationId: string, broadcastId: string, statuses: string[]) {
  await getBroadcast(organizationId, broadcastId);
  return database.broadcastRecipient.findMany({
    where: { broadcastId, ...(statuses.length ? { status: { in: statuses } } : {}) },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 500,
    select: {
      contactId: true,
      status: true,
      exclusionReason: true,
      repliedAt: true,
      contact: { select: { id: true, displayName: true, phone: true, district: true } },
      message: { select: { errorTitle: true, errorCode: true, sentAt: true, createdAt: true } },
    },
  });
}
