import { z } from "zod";

/**
 * Contrato de datos de un flujo (SPEC-060, catálogo cerrado adaptado al MVP).
 * `Workflow.trigger` y `Workflow.steps` guardan estos JSON. Los saltos entre
 * pasos (`next`, `onReply`, `onTimeout`, `onFail`, `onTrue`, `onFalse`) van
 * siempre al nivel del paso; un salto omitido significa «el siguiente de la
 * lista» y, si no hay siguiente, el flujo termina.
 */

export const MANUAL_STAGES = ["NUEVO", "EN_CONTACTO", "CALIFICADO", "PROPUESTA", "EN_CIERRE", "PERDIDA"] as const;
export const ORDER_STATUSES = ["INGRESADO", "ENTREGADO", "ACTIVADO", "CANCELADO"] as const;

const stepId = z.string().trim().min(1, "El paso necesita un identificador").max(40);
const jump = stepId.optional();
const shortText = z.string().trim().max(1024);

export const triggerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("INBOUND_MESSAGE"),
    filters: z
      .object({
        firstMessageOnly: z.boolean().optional(),
        fromAd: z.boolean().optional(),
        keyword: z.string().trim().max(80).optional(),
        outsideBusinessHours: z.boolean().optional(),
      })
      .default({}),
  }),
  z.object({ kind: z.literal("CONVERSATION_UNANSWERED"), filters: z.object({ minutes: z.number().int().min(1).max(24 * 60) }) }),
  z.object({ kind: z.literal("CLIENT_SILENT"), filters: z.object({ hours: z.number().min(1).max(24 * 30) }) }),
  z.object({ kind: z.literal("OPPORTUNITY_STAGE"), filters: z.object({ stage: z.enum(MANUAL_STAGES) }) }),
  z.object({ kind: z.literal("APPOINTMENT_CREATED"), filters: z.object({}).default({}) }),
  z.object({ kind: z.literal("APPOINTMENT_DUE"), filters: z.object({ hoursBefore: z.number().min(0.25).max(24 * 7) }) }),
  z.object({ kind: z.literal("ORDER_STATUS"), filters: z.object({ status: z.enum(ORDER_STATUSES) }) }),
  z.object({ kind: z.literal("CONTACT_TAGGED"), filters: z.object({ tag: z.string().trim().min(1).max(60) }) }),
]);

export const CONDITION_FIELDS = ["contact.tag", "opportunity.stage", "conversation.fromAd", "contact.hasDocument", "contact.marketingOptIn", "businessHours"] as const;
export const CONDITION_OPS = ["eq", "neq", "has"] as const;

export const stepSchema = z.discriminatedUnion("type", [
  z.object({ id: stepId, type: z.literal("send_text"), params: z.object({ text: shortText.min(1, "Escribe el mensaje") }), next: jump, onFail: jump }),
  z.object({
    id: stepId,
    type: z.literal("send_template"),
    params: z.object({ templateId: z.string().trim(), values: z.record(z.string(), z.string()).default({}) }),
    next: jump,
    onFail: jump,
  }),
  z.object({
    id: stepId,
    type: z.literal("send_buttons"),
    params: z.object({
      text: shortText.min(1, "Escribe la pregunta"),
      buttons: z.array(z.object({ id: z.string().trim().min(1).max(40), title: z.string().trim().min(1).max(20) })).min(1).max(3),
    }),
    next: jump,
    onFail: jump,
  }),
  z.object({ id: stepId, type: z.literal("wait_reply"), params: z.object({ hours: z.number().min(0.25).max(24 * 30) }), onReply: jump, onTimeout: jump }),
  z.object({ id: stepId, type: z.literal("wait"), params: z.object({ minutes: z.number().int().min(1).max(60 * 24 * 30) }), next: jump }),
  z.object({
    id: stepId,
    type: z.literal("assign_advisor"),
    params: z.object({ mode: z.enum(["round_robin", "specific"]), userId: z.string().trim().optional() }),
    next: jump,
  }),
  z.object({ id: stepId, type: z.literal("hand_to_ai"), params: z.object({}).default({}), next: jump }),
  z.object({ id: stepId, type: z.literal("require_advisor"), params: z.object({ note: z.string().trim().max(300).default("") }), next: jump }),
  z.object({ id: stepId, type: z.literal("add_tag"), params: z.object({ tag: z.string().trim().min(1, "Escribe la etiqueta").max(60) }), next: jump }),
  z.object({ id: stepId, type: z.literal("set_stage"), params: z.object({ stage: z.enum(MANUAL_STAGES) }), next: jump }),
  z.object({
    id: stepId,
    type: z.literal("condition"),
    params: z.object({ field: z.enum(CONDITION_FIELDS), op: z.enum(CONDITION_OPS), value: z.string().trim().max(80).optional() }),
    onTrue: jump,
    onFalse: jump,
  }),
  z.object({ id: stepId, type: z.literal("notify"), params: z.object({ text: shortText.min(1, "Escribe el aviso") }), next: jump }),
  z.object({ id: stepId, type: z.literal("end"), params: z.object({ reason: z.string().trim().max(120).optional() }).default({}) }),
]);

export const stepsSchema = z.array(stepSchema).max(60);

export const definitionSchema = z.object({
  trigger: triggerSchema,
  steps: stepsSchema,
});

export type WorkflowTrigger = z.infer<typeof triggerSchema>;
export type TriggerKind = WorkflowTrigger["kind"];
export type WorkflowStep = z.infer<typeof stepSchema>;
export type StepType = WorkflowStep["type"];
export type WorkflowDefinition = z.infer<typeof definitionSchema>;
export type StepOfType<T extends StepType> = Extract<WorkflowStep, { type: T }>;

export const STEP_TYPES = stepSchema.options.map((option) => option.shape.type.value) as StepType[];
export const TRIGGER_KINDS = triggerSchema.options.map((option) => option.shape.kind.value) as TriggerKind[];

/** Pasos que hablan con el cliente: solo uno de estos flujos activo por conversación (BR-010). */
export const CONVERSATIONAL_STEP_TYPES: StepType[] = ["send_text", "send_template", "send_buttons", "wait_reply"];

export function isConversational(steps: WorkflowStep[]): boolean {
  return steps.some((step) => CONVERSATIONAL_STEP_TYPES.includes(step.type));
}

/** Convierte lo guardado en base (JSON) en una definición tipada. Lanza si está corrupto. */
export function parseDefinition(trigger: unknown, steps: unknown): WorkflowDefinition {
  return definitionSchema.parse({ trigger, steps });
}

/** Mensaje directo del primer problema de validación de Zod. */
export function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "La definición del flujo no es válida.";
  const path = issue.path.map(String).filter((segment) => segment !== "params").join(" › ");
  return path ? `${path}: ${issue.message}` : issue.message;
}
