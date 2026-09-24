import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { OrganizationRole, WorkflowStatus } from "@/generated/prisma/enums";

import { audit } from "../audit";
import { database } from "../database";
import { EMPTY_DEFINITION, findPreset } from "./presets";
import { definitionSchema, describeIssue, type WorkflowDefinition } from "./schema";
import { blockingProblems, sendsMarketing, validateWorkflow, type TemplateFacts } from "./validate";

/**
 * Alta, edición y activación de flujos. Todo filtra por `organizationId` y
 * deja rastro en la auditoría. Guardar un flujo activo publica una versión
 * nueva; las ejecuciones en curso siguen con la suya (BR-008).
 */

export class WorkflowError extends Error {}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  version: number;
  priority: number;
  trigger: Prisma.JsonValue;
  steps: Prisma.JsonValue;
  updatedAt: Date;
  runs: { started: number; finished: number; stopped: number; waiting: number };
}

export async function listWorkflows(organizationId: string): Promise<WorkflowSummary[]> {
  const workflows = await database.workflow.findMany({
    where: { organizationId },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, description: true, status: true, version: true, priority: true, trigger: true, steps: true, updatedAt: true },
  });
  const counts = await database.workflowRun.groupBy({
    by: ["workflowId", "status"],
    where: { organizationId },
    _count: { _all: true },
  });
  return workflows.map((workflow) => {
    const own = counts.filter((count) => count.workflowId === workflow.id);
    const total = (status: string) => own.find((count) => count.status === status)?._count._all ?? 0;
    return {
      ...workflow,
      runs: {
        started: own.reduce((sum, count) => sum + count._count._all, 0),
        finished: total("DONE"),
        stopped: total("STOPPED") + total("FAILED"),
        waiting: total("RUNNING") + total("WAITING"),
      },
    };
  });
}

export async function getWorkflow(organizationId: string, workflowId: string) {
  const workflow = await database.workflow.findFirst({ where: { id: workflowId, organizationId } });
  if (!workflow) throw new WorkflowError("Ese flujo no existe o no es de tu empresa.");
  return workflow;
}

export interface TemplateVariableOption {
  index: number;
  label: string | null;
  source: string;
}

export interface TemplateOption extends TemplateFacts {
  /** Variables del cuerpo: las «manual» las completa el flujo. */
  variables: TemplateVariableOption[];
}

function readVariables(value: Prisma.JsonValue): TemplateVariableOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const index = typeof record.index === "number" ? record.index : Number(record.index);
    if (!Number.isFinite(index)) return [];
    return [{ index, label: typeof record.label === "string" ? record.label : null, source: typeof record.source === "string" ? record.source : "manual" }];
  });
}

/** Plantillas de la empresa con lo que necesita la validación y el editor. */
export async function templatesFor(organizationId: string): Promise<TemplateOption[]> {
  const templates = await database.messageTemplate.findMany({
    where: { organizationId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, status: true, category: true, variables: true },
  });
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    status: template.status,
    category: template.category,
    variables: readVariables(template.variables).sort((a, b) => a.index - b.index),
  }));
}

export async function advisorsFor(organizationId: string): Promise<{ id: string; name: string }[]> {
  const members = await database.organizationMember.findMany({
    where: { organizationId, role: { in: ["OWNER", "SUPERVISOR", "AGENT"] }, user: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    select: { userId: true, user: { select: { name: true } } },
  });
  return members.map((member) => ({ id: member.userId, name: member.user.name }));
}

/** Etiquetas que ya se usan en los contactos, para no inventar nombres nuevos. */
export async function tagsFor(organizationId: string): Promise<string[]> {
  const contacts = await database.contact.findMany({
    where: { organizationId, NOT: { tags: { isEmpty: true } } },
    take: 500,
    select: { tags: true },
  });
  return [...new Set(contacts.flatMap((contact) => contact.tags))].sort((a, b) => a.localeCompare(b, "es"));
}

export async function createWorkflow(input: { organizationId: string; userId: string; name: string; presetKey?: string | null }): Promise<string> {
  const name = input.name.trim();
  const preset = input.presetKey ? findPreset(input.presetKey) : undefined;
  if (input.presetKey && !preset) throw new WorkflowError("Ese flujo prearmado ya no está disponible.");
  const definition = preset?.definition ?? EMPTY_DEFINITION;
  const finalName = name || preset?.name || "";
  if (!finalName) throw new WorkflowError("Ponle un nombre al flujo.");

  const workflow = await database.workflow.create({
    data: {
      organizationId: input.organizationId,
      name: finalName.slice(0, 160),
      description: preset?.description ?? null,
      status: "DRAFT",
      trigger: definition.trigger as unknown as Prisma.InputJsonValue,
      steps: definition.steps as unknown as Prisma.InputJsonValue,
      createdByUserId: input.userId,
    },
    select: { id: true },
  });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: "workflow.created",
    targetKind: "workflow",
    targetId: workflow.id,
    detail: { name: finalName, preset: preset?.key ?? null },
  });
  return workflow.id;
}

/** Lee el JSON del editor y lo valida contra el catálogo cerrado. */
export function parseDefinitionJson(raw: string): WorkflowDefinition {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new WorkflowError("No se pudo leer el flujo: vuelve a abrirlo y guárdalo de nuevo.");
  }
  const parsed = definitionSchema.safeParse(value);
  if (!parsed.success) throw new WorkflowError(describeIssue(parsed.error));
  return parsed.data;
}

export async function saveWorkflow(input: {
  organizationId: string;
  userId: string;
  workflowId: string;
  name: string;
  description: string | null;
  priority: number;
  definition: WorkflowDefinition;
}): Promise<{ version: number }> {
  const workflow = await getWorkflow(input.organizationId, input.workflowId);
  const name = input.name.trim();
  if (!name) throw new WorkflowError("Ponle un nombre al flujo.");
  // Un flujo activo que cambia publica versión nueva; lo en curso termina con la suya.
  const version = workflow.status === "ACTIVE" ? workflow.version + 1 : workflow.version;

  await database.workflow.update({
    where: { id: workflow.id },
    data: {
      name: name.slice(0, 160),
      description: input.description,
      priority: input.priority,
      version,
      trigger: input.definition.trigger as unknown as Prisma.InputJsonValue,
      steps: input.definition.steps as unknown as Prisma.InputJsonValue,
    },
  });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: "workflow.saved",
    targetKind: "workflow",
    targetId: workflow.id,
    detail: { version, steps: input.definition.steps.length, trigger: input.definition.trigger.kind },
  });
  return { version };
}

export async function setWorkflowStatus(input: {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  workflowId: string;
  status: WorkflowStatus;
}): Promise<string> {
  const workflow = await getWorkflow(input.organizationId, input.workflowId);
  if (workflow.status === input.status) return "Ya estaba así.";

  if (input.status === "ACTIVE") {
    const parsed = definitionSchema.safeParse({ trigger: workflow.trigger, steps: workflow.steps });
    if (!parsed.success) throw new WorkflowError(`Todavía no se puede activar: ${describeIssue(parsed.error)}`);
    const definition = parsed.data;
    const templates = await templatesFor(input.organizationId);
    const problems = blockingProblems(validateWorkflow(definition, templates));
    if (problems.length) throw new WorkflowError(`Todavía no se puede activar: ${problems[0]!.message}`);
    if (sendsMarketing(definition, templates) && input.role !== "OWNER") {
      throw new WorkflowError("Este flujo envía una plantilla de marketing: solo el dueño puede activarlo.");
    }
  }

  await database.workflow.update({ where: { id: workflow.id }, data: { status: input.status } });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    action: `workflow.${input.status.toLowerCase()}`,
    targetKind: "workflow",
    targetId: workflow.id,
    detail: { from: workflow.status, to: input.status, version: workflow.version },
  });
  return input.status === "ACTIVE"
    ? "Flujo activo: desde ahora se ejecuta solo."
    : input.status === "PAUSED"
      ? "Flujo pausado: no arranca en casos nuevos. Lo que ya estaba en curso sigue su camino."
      : "Flujo en borrador: no se ejecuta.";
}

export async function runsForWorkflow(organizationId: string, workflowId: string, take = 50) {
  return database.workflowRun.findMany({
    where: { organizationId, workflowId },
    orderBy: { startedAt: "desc" },
    take,
    select: {
      id: true,
      status: true,
      workflowVersion: true,
      conversationId: true,
      contactId: true,
      opportunityId: true,
      currentStepId: true,
      stepCount: true,
      resumeAt: true,
      log: true,
      endReason: true,
      startedAt: true,
      endedAt: true,
      contact: { select: { displayName: true, phone: true } },
    },
  });
}
