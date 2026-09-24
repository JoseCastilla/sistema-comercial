import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { OpportunityStage } from "@/generated/prisma/enums";
import { isWithinBusinessHours } from "@/lib/time";

import { audit } from "../audit";
import { database } from "../database";
import { publishEvent } from "../events/bus";
import { assignConversation, pickAvailableAdvisor, setResponderState } from "../messaging/conversation-state";
import { enqueueOutboundMessage, OutboundRejectedError } from "../messaging/store";
import { canWriteFreely } from "../messaging/windows";
import { sendTemplateToConversation } from "../templates/send";
import {
  advance,
  findStep,
  newRunState,
  resume,
  stop,
  type Effect,
  type LogEntry,
  type ResumeBranch,
  type RunContext,
  type RunState,
  type RunStatus,
} from "./engine";
import { isConversational, MANUAL_STAGES, parseDefinition, type WorkflowDefinition } from "./schema";
import { idempotencyKey } from "./triggers";

/**
 * Ejecutor de flujos (SPEC-060). El motor puro decide; aquí se aplican los
 * efectos con Prisma y los servicios comunes de mensajería. Toda consulta
 * filtra por `organizationId` y toda ejecución guarda su rastro paso a paso.
 */

const OPEN_STAGES: OpportunityStage[] = ["NUEVO", "EN_CONTACTO", "CALIFICADO", "PROPUESTA", "EN_CIERRE"];
const TERMINAL: RunStatus[] = ["DONE", "STOPPED", "FAILED"];
/** Vueltas máximas entre efecto fallido y reintento por otra rama en una misma ejecución. */
const MAX_PASSES = 6;

export interface WorkflowRow {
  id: string;
  organizationId: string;
  name: string;
  version: number;
  priority: number;
  trigger: Prisma.JsonValue;
  steps: Prisma.JsonValue;
}

export interface RunTarget {
  conversationId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
}

interface Refs {
  conversationId: string | null;
  contactId: string | null;
  opportunityId: string | null;
}

type RunRow = Awaited<ReturnType<typeof loadRun>>;

function loadRun(runId: string) {
  return database.workflowRun.findUnique({
    where: { id: runId },
    include: { workflow: { select: { id: true, name: true, priority: true, trigger: true, steps: true } } },
  });
}

/** Definición con la que arrancó la ejecución (BR-008): el snapshot manda. */
export function definitionOf(row: NonNullable<RunRow>): WorkflowDefinition {
  const payload = row.triggerPayload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const snapshot = (payload as Record<string, unknown>).definition;
    if (snapshot && typeof snapshot === "object") {
      const parsed = snapshot as { trigger?: unknown; steps?: unknown };
      return parseDefinition(parsed.trigger, parsed.steps);
    }
  }
  return parseDefinition(row.workflow.trigger, row.workflow.steps);
}

function stateFromRow(row: NonNullable<RunRow>): RunState {
  return {
    status: row.status,
    currentStepId: row.currentStepId,
    stepCount: row.stepCount,
    waitingForReply: row.waitingForReply,
    resumeAt: row.resumeAt,
    startedAt: row.startedAt,
    log: Array.isArray(row.log) ? (row.log as unknown as LogEntry[]) : [],
    endReason: row.endReason,
  };
}

async function persist(runId: string, state: RunState): Promise<void> {
  const terminal = TERMINAL.includes(state.status);
  await database.workflowRun.update({
    where: { id: runId },
    data: {
      status: state.status,
      currentStepId: state.currentStepId,
      resumeAt: state.resumeAt,
      waitingForReply: state.waitingForReply,
      stepCount: state.stepCount,
      log: state.log as unknown as Prisma.InputJsonValue,
      endReason: state.endReason,
      endedAt: terminal ? new Date() : null,
    },
  });
}

async function loadContext(row: NonNullable<RunRow>, definition: WorkflowDefinition, now: Date): Promise<{ context: RunContext; refs: Refs }> {
  const organization = await database.organization.findUnique({
    where: { id: row.organizationId },
    select: { timezone: true, businessHours: true },
  });
  const conversation = row.conversationId
    ? await database.conversation.findFirst({
        where: { id: row.conversationId, organizationId: row.organizationId },
        select: { id: true, contactId: true, lastInboundAt: true, aiAgentId: true, originAdId: true, assignedUserId: true },
      })
    : null;
  const contactId = row.contactId ?? conversation?.contactId ?? null;
  const contact = contactId
    ? await database.contact.findFirst({
        where: { id: contactId, organizationId: row.organizationId },
        select: { id: true, displayName: true, phone: true, tags: true, documentNumber: true, marketingOptIn: true },
      })
    : null;
  const advisor = conversation?.assignedUserId
    ? await database.user.findUnique({ where: { id: conversation.assignedUserId }, select: { name: true } })
    : null;
  const opportunity = row.opportunityId
    ? await database.opportunity.findFirst({ where: { id: row.opportunityId, organizationId: row.organizationId }, select: { id: true, stage: true } })
    : contactId
      ? await database.opportunity.findFirst({
          where: { organizationId: row.organizationId, contactId, stage: { in: OPEN_STAGES } },
          orderBy: { createdAt: "desc" },
          select: { id: true, stage: true },
        })
      : null;

  const templateIds = definition.steps
    .filter((step) => step.type === "send_template")
    .map((step) => (step.type === "send_template" ? step.params.templateId : ""))
    .filter(Boolean);
  const templateRows = templateIds.length
    ? await database.messageTemplate.findMany({
        where: { organizationId: row.organizationId, id: { in: templateIds } },
        select: { id: true, name: true, status: true, category: true },
      })
    : [];

  const hours = (organization?.businessHours ?? null) as { days: number[]; start: string; end: string } | null;

  return {
    context: {
      contact: contact
        ? {
            name: contact.displayName,
            phone: contact.phone,
            tags: contact.tags,
            hasDocument: Boolean(contact.documentNumber),
            marketingOptIn: contact.marketingOptIn,
          }
        : null,
      conversation: conversation
        ? {
            fromAd: Boolean(conversation.originAdId),
            hasAiAgent: Boolean(conversation.aiAgentId),
            windowOpen: canWriteFreely(conversation.lastInboundAt, now),
            advisorName: advisor?.name ?? null,
          }
        : null,
      opportunity: opportunity ? { stage: opportunity.stage } : null,
      businessHoursNow: hours ? isWithinBusinessHours(now, hours, organization?.timezone ?? undefined) : true,
      templates: Object.fromEntries(templateRows.map((template) => [template.id, { name: template.name, status: template.status, category: template.category }])),
    },
    refs: {
      conversationId: conversation?.id ?? null,
      contactId,
      opportunityId: opportunity?.id ?? null,
    },
  };
}

const SEND_EFFECTS: Effect["kind"][] = ["send_text", "send_template", "send_buttons"];

interface EffectFailure {
  stepId: string;
  reason: string;
}

async function applyEffect(row: NonNullable<RunRow>, refs: Refs, effect: Effect): Promise<void> {
  const originRef = `${row.id}:${effect.stepId}`.slice(0, 120);
  const clientRequestId = `wf:${row.id}:${effect.stepIndex}`.slice(0, 80);
  switch (effect.kind) {
    case "send_text": {
      if (!refs.conversationId) return;
      await enqueueOutboundMessage({
        conversationId: refs.conversationId,
        originKind: "WORKFLOW",
        originRef,
        clientRequestId,
        content: { kind: "text", body: effect.text },
      });
      return;
    }
    case "send_buttons": {
      if (!refs.conversationId) return;
      await enqueueOutboundMessage({
        conversationId: refs.conversationId,
        originKind: "WORKFLOW",
        originRef,
        clientRequestId,
        content: { kind: "interactive", body: effect.text, buttons: effect.buttons },
      });
      return;
    }
    case "send_template": {
      if (!refs.conversationId) return;
      await sendTemplateToConversation({
        conversationId: refs.conversationId,
        templateId: effect.templateId,
        manualValues: effect.values,
        originKind: "WORKFLOW",
        originRef,
        clientRequestId,
      });
      return;
    }
    case "assign_advisor": {
      if (!refs.conversationId) return;
      const userId =
        effect.mode === "specific" && effect.userId
          ? (await database.organizationMember.findFirst({ where: { organizationId: row.organizationId, userId: effect.userId }, select: { userId: true } }))?.userId ?? null
          : await pickAvailableAdvisor(row.organizationId);
      if (!userId) {
        await setResponderState({
          conversationId: refs.conversationId,
          state: "REQUIERE_ASESOR",
          reason: `el flujo «${row.workflow.name}» no encontró asesor disponible`,
        });
        return;
      }
      await assignConversation({
        conversationId: refs.conversationId,
        userId,
        reason: `lo repartió el flujo «${row.workflow.name}»`,
      });
      return;
    }
    case "set_responder": {
      if (!refs.conversationId) return;
      await setResponderState({ conversationId: refs.conversationId, state: effect.state, reason: effect.note });
      return;
    }
    case "add_tag": {
      if (!refs.contactId) return;
      const contact = await database.contact.findFirst({ where: { id: refs.contactId, organizationId: row.organizationId }, select: { tags: true } });
      if (!contact || contact.tags.includes(effect.tag)) return;
      await database.contact.update({ where: { id: refs.contactId }, data: { tags: { push: effect.tag } } });
      publishEvent({ type: "contact.tagged", organizationId: row.organizationId, contactId: refs.contactId, tag: effect.tag });
      return;
    }
    case "set_stage": {
      await applyStage(row, refs, effect.stage);
      return;
    }
    case "notify": {
      if (refs.conversationId) {
        await database.conversationEvent.create({
          data: {
            conversationId: refs.conversationId,
            type: "WORKFLOW",
            detail: { text: effect.text, workflowId: row.workflowId, workflowName: row.workflow.name, runId: row.id, stepId: effect.stepId },
          },
        });
        publishEvent({ type: "conversation.updated", organizationId: row.organizationId, conversationId: refs.conversationId, reason: "workflow" });
      }
      await audit({
        organizationId: row.organizationId,
        action: "workflow.notify",
        targetKind: "workflow_run",
        targetId: row.id,
        detail: { text: effect.text, stepId: effect.stepId, workflowName: row.workflow.name },
      });
      return;
    }
  }
}

/** Etapas manuales solamente: un flujo nunca gana una venta (eso lo hace el pedido). */
async function applyStage(row: NonNullable<RunRow>, refs: Refs, stage: string): Promise<void> {
  if (!refs.opportunityId) return;
  if (!(MANUAL_STAGES as readonly string[]).includes(stage)) return;
  const opportunity = await database.opportunity.findFirst({
    where: { id: refs.opportunityId, organizationId: row.organizationId },
    select: { id: true, stage: true, contactId: true },
  });
  if (!opportunity || opportunity.stage === stage) return;
  if (opportunity.stage === "GANADA") return;
  const next = stage as OpportunityStage;
  const now = new Date();
  const lost = next === "PERDIDA";
  await database.opportunity.update({
    where: { id: opportunity.id },
    data: {
      stage: next,
      stageChangedAt: now,
      lastActivityAt: now,
      ...(lost
        ? { closedAt: now, lostReason: "OTRO", lostDetail: `La cerró el flujo «${row.workflow.name}».` }
        : opportunity.stage === "PERDIDA"
          ? { closedAt: null, lostReason: null, lostDetail: null }
          : {}),
    },
  });
  await database.opportunityEvent.create({
    data: {
      opportunityId: opportunity.id,
      type: "STAGE_CHANGED",
      actorKind: "WORKFLOW",
      detail: { from: opportunity.stage, to: next, reason: `flujo «${row.workflow.name}»`, runId: row.id },
    },
  });
  publishEvent({
    type: "opportunity.stage",
    organizationId: row.organizationId,
    opportunityId: opportunity.id,
    contactId: opportunity.contactId,
    stage: next,
    previousStage: opportunity.stage,
  });
}

async function applyEffects(row: NonNullable<RunRow>, refs: Refs, effects: Effect[]): Promise<EffectFailure | null> {
  for (const effect of effects) {
    try {
      await applyEffect(row, refs, effect);
    } catch (error) {
      if (SEND_EFFECTS.includes(effect.kind)) {
        const reason =
          error instanceof OutboundRejectedError
            ? "no se pudo enviar: ventana cerrada"
            : `no se pudo enviar: ${error instanceof Error ? error.message : "error al enviar"}`;
        return { stepId: effect.stepId, reason };
      }
      // Un efecto interno que falla no tumba la ejecución: queda en el registro del proceso.
      console.error(`Flujo ${row.workflowId}: falló el efecto ${effect.kind} del paso ${effect.stepId}`, error);
    }
  }
  return null;
}

/** Reescribe el estado hasta el paso que falló y toma la rama «no se pudo enviar». */
function afterFailure(definition: WorkflowDefinition, computed: RunState, failure: EffectFailure, now: Date): RunState {
  const step = findStep(definition, failure.stepId);
  const index = computed.log.findIndex((entry) => entry.stepId === failure.stepId);
  const log = index >= 0 ? computed.log.slice(0, index) : [...computed.log];
  const onFail = step ? (step as { onFail?: string }).onFail : undefined;
  log.push({ at: now.toISOString(), stepId: failure.stepId, type: step?.type ?? "send", result: failure.reason, ...(onFail ? { branch: "onFail" } : {}) });
  if (onFail) {
    return { ...computed, status: "RUNNING", currentStepId: onFail, waitingForReply: false, resumeAt: null, endReason: null, log };
  }
  return { ...computed, status: "DONE", currentStepId: null, waitingForReply: false, resumeAt: null, endReason: failure.reason.slice(0, 120), log };
}

/** Avanza la ejecución hasta que espera o termina, y aplica sus efectos. */
export async function executeRun(runId: string): Promise<void> {
  const row = await loadRun(runId);
  if (!row || row.status !== "RUNNING") return;
  let definition: WorkflowDefinition;
  try {
    definition = definitionOf(row);
  } catch (error) {
    console.error(`Flujo ${row.workflowId}: definición ilegible`, error);
    await persist(row.id, { ...stateFromRow(row), status: "FAILED", currentStepId: null, resumeAt: null, waitingForReply: false, endReason: "la definición del flujo no se puede leer" });
    return;
  }

  let state = stateFromRow(row);
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const now = new Date();
    const { context, refs } = await loadContext(row, definition, now);
    if ((refs.contactId && !row.contactId) || (refs.opportunityId && !row.opportunityId)) {
      await database.workflowRun.update({
        where: { id: row.id },
        data: { contactId: refs.contactId ?? undefined, opportunityId: refs.opportunityId ?? undefined },
      });
    }
    const { effects, nextRun } = advance(definition, state, context, now);
    const failure = await applyEffects(row, refs, effects);
    if (!failure) {
      state = nextRun;
      break;
    }
    state = afterFailure(definition, nextRun, failure, now);
    if (state.status !== "RUNNING") break;
  }
  await persist(row.id, state);
}

/** Reanuda una ejecución en espera: respondió, venció el plazo o terminó la pausa. */
export async function resumeRun(runId: string, branch: ResumeBranch, detail?: string): Promise<void> {
  const row = await loadRun(runId);
  if (!row || row.status !== "WAITING") return;
  let definition: WorkflowDefinition;
  try {
    definition = definitionOf(row);
  } catch {
    await persist(row.id, { ...stateFromRow(row), status: "FAILED", currentStepId: null, resumeAt: null, waitingForReply: false, endReason: "la definición del flujo no se puede leer" });
    return;
  }
  const state = resume(definition, stateFromRow(row), branch, new Date(), detail);
  await persist(row.id, state);
  if (state.status === "RUNNING") await executeRun(row.id);
}

export async function stopRun(runId: string, reason: string): Promise<void> {
  const row = await loadRun(runId);
  if (!row || TERMINAL.includes(row.status)) return;
  await persist(row.id, stop(stateFromRow(row), reason, new Date()));
}

/** BR-011: un asesor tomó la conversación; lo que le hablaba al cliente se detiene. */
export async function stopConversationRuns(organizationId: string, conversationId: string, reason: string): Promise<number> {
  const runs = await activeConversationalRuns(organizationId, conversationId);
  for (const run of runs) await stopRun(run.id, reason);
  return runs.length;
}

/** Ejecuciones conversacionales vivas de una conversación, con la prioridad de su flujo. */
async function activeConversationalRuns(organizationId: string, conversationId: string) {
  const runs = await database.workflowRun.findMany({
    where: { organizationId, conversationId, status: { in: ["RUNNING", "WAITING"] } },
    include: { workflow: { select: { id: true, name: true, priority: true, trigger: true, steps: true } } },
  });
  return runs.filter((run) => {
    try {
      return isConversational(definitionOf(run).steps);
    } catch {
      return true;
    }
  });
}

/**
 * Arranca una ejecución si toca (BR-010 y BR-014). Devuelve el id, o null si
 * no se creó: repetida, sin pasos, o la conversación ya estaba en otro flujo.
 */
export async function startRun(input: {
  workflow: WorkflowRow;
  objectId: string;
  eventKey: string;
  target: RunTarget;
  payload?: Record<string, unknown>;
}): Promise<string | null> {
  const { workflow } = input;
  let definition: WorkflowDefinition;
  try {
    definition = parseDefinition(workflow.trigger, workflow.steps);
  } catch (error) {
    console.error(`Flujo ${workflow.id}: definición inválida, no se ejecuta`, error);
    return null;
  }
  const first = definition.steps[0];
  if (!first) return null;

  const key = idempotencyKey(definition.trigger.kind, input.objectId, input.eventKey);
  const repeated = await database.workflowRun.findUnique({
    where: { workflowId_idempotencyKey: { workflowId: workflow.id, idempotencyKey: key } },
    select: { id: true },
  });
  if (repeated) return null;

  const conversationId = input.target.conversationId ?? null;
  if (conversationId && isConversational(definition.steps)) {
    const active = await activeConversationalRuns(workflow.organizationId, conversationId);
    const blocking = active.filter((run) => run.workflow.priority <= workflow.priority);
    if (blocking.length) {
      const other = blocking[0]!;
      await audit({
        organizationId: workflow.organizationId,
        action: "workflow.skipped",
        targetKind: "workflow",
        targetId: workflow.id,
        detail: {
          reason: `no se ejecutó: la conversación ya estaba en el flujo «${other.workflow.name}»`,
          conversationId,
          runId: other.id,
        },
      });
      return null;
    }
    for (const run of active) {
      await stopRun(run.id, `lo reemplazó el flujo «${workflow.name}», de mayor prioridad`);
    }
  }

  const startedAt = new Date();
  const state = newRunState(startedAt, first.id);
  const payload: Prisma.InputJsonValue = {
    ...(input.payload ?? {}),
    objectId: input.objectId,
    eventKey: input.eventKey,
    definition: { trigger: definition.trigger, steps: definition.steps } as unknown as Prisma.InputJsonValue,
  };

  let runId: string;
  try {
    const created = await database.workflowRun.create({
      data: {
        organizationId: workflow.organizationId,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        conversationId,
        contactId: input.target.contactId ?? null,
        opportunityId: input.target.opportunityId ?? null,
        status: "RUNNING",
        currentStepId: state.currentStepId,
        idempotencyKey: key,
        triggerPayload: payload,
        log: [] as unknown as Prisma.InputJsonValue,
        startedAt,
      },
      select: { id: true },
    });
    runId = created.id;
  } catch (error) {
    // Carrera con otro proceso sobre la misma clave: la primera ejecución vale.
    console.error(`Flujo ${workflow.id}: no se creó la ejecución (${key})`, error);
    return null;
  }

  await executeRun(runId);
  return runId;
}
