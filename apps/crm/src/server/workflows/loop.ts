import "server-only";

import { isWithinBusinessHours } from "@/lib/time";

import { registerLoop } from "../background/registry";
import { database } from "../database";
import { subscribeToEvents, type DomainEvent } from "../events/bus";
import { resumeRun, startRun, stopConversationRuns, type WorkflowRow } from "./executor";
import { triggerSchema, type TriggerKind, type WorkflowTrigger } from "./schema";
import { hourKey, matchesInbound, normalizeText } from "./triggers";

/**
 * Disparadores y esperas de los flujos (SPEC-060). Los eventos del dominio
 * arrancan y reanudan ejecuciones; el bucle de cinco segundos despierta las
 * que esperaban y evalúa los disparadores que dependen del reloj.
 */

const LOOP_NAME = "flujos";
const BATCH = 100;

function triggerOf(workflow: { trigger: unknown }): WorkflowTrigger | null {
  const parsed = triggerSchema.safeParse(workflow.trigger);
  return parsed.success ? parsed.data : null;
}

const WORKFLOW_FIELDS = { id: true, organizationId: true, name: true, version: true, priority: true, trigger: true, steps: true } as const;

/** Flujos activos de la empresa con ese disparador, el de mayor prioridad primero. */
async function activeWorkflows(organizationId: string, kind: TriggerKind): Promise<{ workflow: WorkflowRow; trigger: WorkflowTrigger }[]> {
  const rows = await database.workflow.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: WORKFLOW_FIELDS,
  });
  return rows
    .map((workflow) => ({ workflow, trigger: triggerOf(workflow) }))
    .filter((entry): entry is { workflow: WorkflowRow; trigger: WorkflowTrigger } => entry.trigger?.kind === kind);
}

async function openConversationFor(organizationId: string, contactId: string | null | undefined): Promise<string | null> {
  if (!contactId) return null;
  const conversation = await database.conversation.findFirst({
    where: { organizationId, contactId, status: "OPEN" },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true },
  });
  return conversation?.id ?? null;
}

async function businessHoursNow(organizationId: string, now: Date): Promise<boolean> {
  const organization = await database.organization.findUnique({ where: { id: organizationId }, select: { timezone: true, businessHours: true } });
  if (!organization) return true;
  const hours = organization.businessHours as { days: number[]; start: string; end: string } | null;
  return hours ? isWithinBusinessHours(now, hours, organization.timezone) : true;
}

// ───────────────────────── Disparadores por evento ─────────────────────────

async function onInbound(event: Extract<DomainEvent, { type: "message.inbound" }>) {
  const message = await database.message.findFirst({
    where: { id: event.messageId, organizationId: event.organizationId },
    select: { body: true },
  });

  // Primero se reanuda lo que esperaba respuesta en esa conversación.
  const waiting = await database.workflowRun.findMany({
    where: { organizationId: event.organizationId, conversationId: event.conversationId, status: "WAITING", waitingForReply: true },
    select: { id: true },
  });
  for (const run of waiting) await resumeRun(run.id, "reply", message?.body ?? undefined);

  const workflows = await activeWorkflows(event.organizationId, "INBOUND_MESSAGE");
  if (!workflows.length) return;
  const conversation = await database.conversation.findFirst({
    where: { id: event.conversationId, organizationId: event.organizationId },
    select: { id: true, contactId: true, originAdId: true },
  });
  if (!conversation) return;
  const facts = {
    isFirstInConversation: event.isFirstInConversation,
    fromAd: Boolean(conversation.originAdId),
    body: message?.body ?? "",
    withinBusinessHours: await businessHoursNow(event.organizationId, new Date()),
  };
  for (const { workflow, trigger } of workflows) {
    if (trigger.kind !== "INBOUND_MESSAGE" || !matchesInbound(trigger.filters, facts)) continue;
    await startRun({
      workflow,
      objectId: event.conversationId,
      eventKey: event.messageId,
      target: { conversationId: conversation.id, contactId: conversation.contactId },
      payload: { messageId: event.messageId },
    });
  }
}

async function onUnanswered(event: Extract<DomainEvent, { type: "conversation.unanswered" }>) {
  const workflows = await activeWorkflows(event.organizationId, "CONVERSATION_UNANSWERED");
  if (!workflows.length) return;
  const conversation = await database.conversation.findFirst({
    where: { id: event.conversationId, organizationId: event.organizationId },
    select: { id: true, contactId: true },
  });
  if (!conversation) return;
  for (const { workflow, trigger } of workflows) {
    if (trigger.kind !== "CONVERSATION_UNANSWERED" || event.minutes < trigger.filters.minutes) continue;
    await startRun({
      workflow,
      objectId: event.conversationId,
      eventKey: `${trigger.filters.minutes}`,
      target: { conversationId: conversation.id, contactId: conversation.contactId },
      payload: { minutes: event.minutes },
    });
  }
}

async function onStage(event: Extract<DomainEvent, { type: "opportunity.stage" }>) {
  const workflows = await activeWorkflows(event.organizationId, "OPPORTUNITY_STAGE");
  if (!workflows.length) return;
  const opportunity = await database.opportunity.findFirst({
    where: { id: event.opportunityId, organizationId: event.organizationId },
    select: { id: true, contactId: true, conversationId: true },
  });
  if (!opportunity) return;
  const conversationId = opportunity.conversationId ?? (await openConversationFor(event.organizationId, opportunity.contactId));
  for (const { workflow, trigger } of workflows) {
    if (trigger.kind !== "OPPORTUNITY_STAGE" || trigger.filters.stage !== event.stage) continue;
    await startRun({
      workflow,
      objectId: event.opportunityId,
      eventKey: `${event.previousStage}-${event.stage}`,
      target: { conversationId, contactId: opportunity.contactId, opportunityId: opportunity.id },
      payload: { stage: event.stage, previousStage: event.previousStage },
    });
  }
}

async function onAppointmentCreated(event: Extract<DomainEvent, { type: "appointment.created" }>) {
  const workflows = await activeWorkflows(event.organizationId, "APPOINTMENT_CREATED");
  if (!workflows.length) return;
  const appointment = await database.appointment.findFirst({
    where: { id: event.appointmentId, organizationId: event.organizationId },
    select: { id: true, contactId: true, conversationId: true, opportunityId: true },
  });
  if (!appointment) return;
  const conversationId = appointment.conversationId ?? (await openConversationFor(event.organizationId, appointment.contactId));
  for (const { workflow } of workflows) {
    await startRun({
      workflow,
      objectId: appointment.id,
      eventKey: "creada",
      target: { conversationId, contactId: appointment.contactId, opportunityId: appointment.opportunityId },
      payload: { scheduledAt: event.scheduledAt },
    });
  }
}

async function onOrderStatus(event: Extract<DomainEvent, { type: "order.status" }>) {
  const workflows = await activeWorkflows(event.organizationId, "ORDER_STATUS");
  if (!workflows.length) return;
  const order = await database.order.findFirst({
    where: { id: event.orderId, organizationId: event.organizationId },
    select: { id: true, contactId: true, opportunityId: true, externalRef: true },
  });
  if (!order) return;
  const conversationId = await openConversationFor(event.organizationId, order.contactId);
  for (const { workflow, trigger } of workflows) {
    if (trigger.kind !== "ORDER_STATUS" || trigger.filters.status !== event.status) continue;
    await startRun({
      workflow,
      objectId: order.id,
      eventKey: event.status,
      target: { conversationId, contactId: order.contactId, opportunityId: order.opportunityId },
      payload: { status: event.status, externalRef: order.externalRef },
    });
  }
}

async function onTagged(event: Extract<DomainEvent, { type: "contact.tagged" }>) {
  const workflows = await activeWorkflows(event.organizationId, "CONTACT_TAGGED");
  if (!workflows.length) return;
  const conversationId = await openConversationFor(event.organizationId, event.contactId);
  for (const { workflow, trigger } of workflows) {
    if (trigger.kind !== "CONTACT_TAGGED" || normalizeText(trigger.filters.tag) !== normalizeText(event.tag)) continue;
    await startRun({
      workflow,
      objectId: event.contactId,
      eventKey: normalizeText(event.tag),
      target: { conversationId, contactId: event.contactId },
      payload: { tag: event.tag },
    });
  }
}

async function onResponder(event: Extract<DomainEvent, { type: "conversation.responder" }>) {
  if (event.state !== "CONTROL_HUMANO") return;
  await stopConversationRuns(event.organizationId, event.conversationId, "lo tomó un asesor");
}

async function handle(event: DomainEvent): Promise<void> {
  switch (event.type) {
    case "message.inbound":
      return onInbound(event);
    case "conversation.unanswered":
      return onUnanswered(event);
    case "conversation.responder":
      return onResponder(event);
    case "opportunity.stage":
      return onStage(event);
    case "appointment.created":
      return onAppointmentCreated(event);
    case "order.status":
      return onOrderStatus(event);
    case "contact.tagged":
      return onTagged(event);
    default:
      return;
  }
}

// ───────────────────────── Disparadores de reloj ─────────────────────────

/** Conversación abierta cuyo último entrante ya tiene horas y donde el cliente no fue el último. */
async function evaluateClientSilent(workflow: WorkflowRow, hours: number, now: Date) {
  const cutoff = new Date(now.getTime() - hours * 3_600_000);
  const conversations = await database.conversation.findMany({
    where: { organizationId: workflow.organizationId, status: "OPEN", lastInboundAt: { not: null, lte: cutoff } },
    orderBy: { lastInboundAt: "desc" },
    take: BATCH,
    select: { id: true, contactId: true, lastInboundAt: true, lastMessageAt: true },
  });
  for (const conversation of conversations) {
    const lastInbound = conversation.lastInboundAt!;
    // Si el último mensaje es el del cliente, aún le toca responder al negocio.
    if (!conversation.lastMessageAt || conversation.lastMessageAt.getTime() <= lastInbound.getTime()) continue;
    await startRun({
      workflow,
      objectId: conversation.id,
      eventKey: `${hours}:${hourKey(lastInbound)}`,
      target: { conversationId: conversation.id, contactId: conversation.contactId },
      payload: { silentSince: lastInbound.toISOString() },
    });
  }
}

async function evaluateAppointmentDue(workflow: WorkflowRow, hoursBefore: number, now: Date) {
  const until = new Date(now.getTime() + hoursBefore * 3_600_000);
  const appointments = await database.appointment.findMany({
    where: { organizationId: workflow.organizationId, status: "PENDING", scheduledAt: { gt: now, lte: until } },
    orderBy: { scheduledAt: "asc" },
    take: BATCH,
    select: { id: true, contactId: true, conversationId: true, opportunityId: true, scheduledAt: true },
  });
  for (const appointment of appointments) {
    const conversationId = appointment.conversationId ?? (await openConversationFor(workflow.organizationId, appointment.contactId));
    await startRun({
      workflow,
      objectId: appointment.id,
      eventKey: `${hoursBefore}:${hourKey(appointment.scheduledAt)}`,
      target: { conversationId, contactId: appointment.contactId, opportunityId: appointment.opportunityId },
      payload: { scheduledAt: appointment.scheduledAt.toISOString() },
    });
  }
}

/** Los disparadores de reloj se revisan cada minuto; las esperas, cada vuelta. */
const TIME_SWEEP_MS = 60_000;
let lastTimeSweep = 0;

async function tick(): Promise<void> {
  const now = new Date();

  const due = await database.workflowRun.findMany({
    where: { status: "WAITING", resumeAt: { lte: now } },
    orderBy: { resumeAt: "asc" },
    take: BATCH,
    select: { id: true, waitingForReply: true },
  });
  for (const run of due) {
    try {
      await resumeRun(run.id, run.waitingForReply ? "timeout" : "wait");
    } catch (error) {
      console.error(`No se pudo reanudar la ejecución ${run.id}`, error);
    }
  }

  if (now.getTime() - lastTimeSweep < TIME_SWEEP_MS) return;
  lastTimeSweep = now.getTime();
  const workflows = await database.workflow.findMany({ where: { status: "ACTIVE" }, orderBy: { priority: "asc" }, select: WORKFLOW_FIELDS });
  for (const workflow of workflows) {
    const trigger = triggerOf(workflow);
    try {
      if (trigger?.kind === "CLIENT_SILENT") await evaluateClientSilent(workflow, trigger.filters.hours, now);
      if (trigger?.kind === "APPOINTMENT_DUE") await evaluateAppointmentDue(workflow, trigger.filters.hoursBefore, now);
    } catch (error) {
      console.error(`Flujo ${workflow.id}: falló la evaluación por tiempo`, error);
    }
  }
}

const globalForWorkflows = globalThis as typeof globalThis & { crmWorkflowSubscriber?: () => void };

/** Motor de flujos: disparadores y esperas (módulo flujos). */
export function registerWorkflowLoop(): void {
  globalForWorkflows.crmWorkflowSubscriber?.();
  globalForWorkflows.crmWorkflowSubscriber = subscribeToEvents((event) => {
    handle(event).catch((error) => console.error(`Flujos: falló el disparador de ${event.type}`, error));
  });

  registerLoop({ name: LOOP_NAME, intervalMs: 5_000, run: tick });
}
