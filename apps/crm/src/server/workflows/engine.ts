import type { WorkflowDefinition, WorkflowStep } from "./schema";

/**
 * Runtime puro del motor de flujos (SPEC-060). No toca la base: recibe la
 * definición, el estado de la ejecución y el contexto del objeto, y devuelve
 * los efectos a aplicar más el nuevo estado. `executor.ts` aplica los efectos.
 */

export const MAX_STEPS = 50;
export const MAX_DAYS = 30;

export type RunStatus = "RUNNING" | "WAITING" | "DONE" | "STOPPED" | "FAILED";

export interface LogEntry {
  at: string;
  stepId: string;
  type: string;
  result: string;
  branch?: string;
}

export interface RunState {
  status: RunStatus;
  currentStepId: string | null;
  stepCount: number;
  waitingForReply: boolean;
  resumeAt: Date | null;
  startedAt: Date;
  log: LogEntry[];
  endReason: string | null;
}

export interface RunContext {
  contact: { name: string | null; phone: string | null; tags: string[]; hasDocument: boolean; marketingOptIn: boolean } | null;
  conversation: { fromAd: boolean; hasAiAgent: boolean; windowOpen: boolean; advisorName: string | null } | null;
  opportunity: { stage: string } | null;
  businessHoursNow: boolean;
  templates: Record<string, { name: string; status: string; category: string }>;
}

export type Effect =
  | { kind: "send_text"; stepId: string; stepIndex: number; text: string }
  | { kind: "send_template"; stepId: string; stepIndex: number; templateId: string; values: Record<string, string> }
  | { kind: "send_buttons"; stepId: string; stepIndex: number; text: string; buttons: { id: string; title: string }[] }
  | { kind: "assign_advisor"; stepId: string; stepIndex: number; mode: "round_robin" | "specific"; userId?: string }
  | { kind: "set_responder"; stepId: string; stepIndex: number; state: "IA_ACTIVA" | "REQUIERE_ASESOR"; note: string }
  | { kind: "add_tag"; stepId: string; stepIndex: number; tag: string }
  | { kind: "set_stage"; stepId: string; stepIndex: number; stage: string }
  | { kind: "notify"; stepId: string; stepIndex: number; text: string };

export interface AdvanceResult {
  effects: Effect[];
  nextRun: RunState;
}

export function findStep(definition: WorkflowDefinition, id: string | null | undefined): WorkflowStep | undefined {
  if (!id) return undefined;
  return definition.steps.find((step) => step.id === id);
}

/** Salto explícito si existe; si no, el siguiente de la lista; si no hay, fin. */
export function resolveJump(definition: WorkflowDefinition, step: WorkflowStep, explicit?: string): string | null {
  if (explicit) return explicit;
  const index = definition.steps.findIndex((candidate) => candidate.id === step.id);
  return definition.steps[index + 1]?.id ?? null;
}

/** Sustituye {nombre}, {asesor} y {telefono} en un texto. */
export function fillVariables(text: string, context: RunContext): string {
  return text
    .replace(/\{nombre\}/gi, context.contact?.name ?? "")
    .replace(/\{asesor\}/gi, context.conversation?.advisorName ?? "")
    .replace(/\{telefono\}/gi, context.contact?.phone ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const normalize = (value: string) => value.trim().toLowerCase();

export function evaluateCondition(params: { field: string; op: string; value?: string }, context: RunContext): boolean {
  const expected = normalize(params.value ?? "");
  switch (params.field) {
    case "contact.tag": {
      const has = (context.contact?.tags ?? []).some((tag) => normalize(tag) === expected);
      return params.op === "neq" ? !has : has;
    }
    case "opportunity.stage": {
      const stage = normalize(context.opportunity?.stage ?? "");
      return params.op === "neq" ? stage !== expected : stage === expected;
    }
    case "conversation.fromAd":
      return booleanResult(Boolean(context.conversation?.fromAd), params.op);
    case "contact.hasDocument":
      return booleanResult(Boolean(context.contact?.hasDocument), params.op);
    case "contact.marketingOptIn":
      return booleanResult(Boolean(context.contact?.marketingOptIn), params.op);
    case "businessHours":
      return booleanResult(context.businessHoursNow, params.op);
    default:
      return false;
  }
}

function booleanResult(actual: boolean, op: string): boolean {
  return op === "neq" ? !actual : actual;
}

function cloneRun(run: RunState): RunState {
  return { ...run, log: [...run.log] };
}

function endRun(run: RunState, reason: string, status: RunStatus = "DONE") {
  run.status = status;
  run.endReason = reason.slice(0, 120);
  run.currentStepId = null;
  run.waitingForReply = false;
  run.resumeAt = null;
}

function exceededLifetime(run: RunState, now: Date): boolean {
  return now.getTime() - run.startedAt.getTime() > MAX_DAYS * 86_400_000;
}

/**
 * Ejecuta pasos desde `run.currentStepId` hasta que el flujo espera, termina
 * o supera los topes (BR-013). Mutaciones locales del contexto (etiqueta,
 * etapa) se reflejan para que una condición posterior las vea.
 */
export function advance(definition: WorkflowDefinition, input: RunState, contextInput: RunContext, now: Date): AdvanceResult {
  const run = cloneRun(input);
  const effects: Effect[] = [];
  if (run.status !== "RUNNING") return { effects, nextRun: run };
  const context: RunContext = {
    ...contextInput,
    contact: contextInput.contact ? { ...contextInput.contact, tags: [...contextInput.contact.tags] } : null,
    opportunity: contextInput.opportunity ? { ...contextInput.opportunity } : null,
  };
  const at = now.toISOString();
  const log = (step: WorkflowStep, result: string, branch?: string) => {
    run.log.push({ at, stepId: step.id, type: step.type, result, ...(branch ? { branch } : {}) });
  };
  const goTo = (step: WorkflowStep, explicit?: string) => {
    run.currentStepId = resolveJump(definition, step, explicit);
  };
  const failSend = (step: WorkflowStep & { onFail?: string }, reason: string) => {
    if (step.onFail) {
      log(step, reason, "onFail");
      run.currentStepId = step.onFail;
    } else {
      log(step, reason);
      endRun(run, reason);
    }
  };

  while (run.status === "RUNNING") {
    if (exceededLifetime(run, now)) {
      endRun(run, `superó los ${MAX_DAYS} días de vida`);
      break;
    }
    if (!run.currentStepId) {
      endRun(run, "flujo completado");
      break;
    }
    const step = findStep(definition, run.currentStepId);
    if (!step) {
      endRun(run, `el paso «${run.currentStepId}» ya no existe`, "FAILED");
      break;
    }
    if (run.stepCount >= MAX_STEPS) {
      endRun(run, `superó los ${MAX_STEPS} pasos`);
      break;
    }
    run.stepCount += 1;
    const stepIndex = run.stepCount;

    switch (step.type) {
      case "send_text": {
        if (!context.conversation) {
          failSend(step, "no se pudo enviar: sin conversación");
        } else if (!context.conversation.windowOpen) {
          failSend(step, "no se pudo enviar: ventana cerrada");
        } else {
          effects.push({ kind: "send_text", stepId: step.id, stepIndex, text: fillVariables(step.params.text, context) });
          log(step, "mensaje encolado");
          goTo(step, step.next);
        }
        break;
      }
      case "send_buttons": {
        if (!context.conversation) {
          failSend(step, "no se pudo enviar: sin conversación");
        } else if (!context.conversation.windowOpen) {
          failSend(step, "no se pudo enviar: ventana cerrada");
        } else {
          effects.push({ kind: "send_buttons", stepId: step.id, stepIndex, text: fillVariables(step.params.text, context), buttons: step.params.buttons });
          log(step, "pregunta con botones encolada");
          goTo(step, step.next);
        }
        break;
      }
      case "send_template": {
        const template = context.templates[step.params.templateId];
        if (!context.conversation) {
          failSend(step, "no se pudo enviar: sin conversación");
        } else if (!template || template.status !== "APPROVED") {
          failSend(step, "no se pudo enviar: plantilla no aprobada");
        } else if (template.category === "MARKETING" && !context.contact?.marketingOptIn) {
          failSend(step, "sin consentimiento de marketing");
        } else {
          const values = Object.fromEntries(Object.entries(step.params.values).map(([key, value]) => [key, fillVariables(value, context)]));
          effects.push({ kind: "send_template", stepId: step.id, stepIndex, templateId: step.params.templateId, values });
          log(step, `plantilla «${template.name}» encolada`);
          goTo(step, step.next);
        }
        break;
      }
      case "wait_reply": {
        run.status = "WAITING";
        run.waitingForReply = true;
        run.resumeAt = new Date(now.getTime() + step.params.hours * 3_600_000);
        run.currentStepId = step.id;
        log(step, `esperando respuesta hasta ${run.resumeAt.toISOString()}`);
        break;
      }
      case "wait": {
        run.status = "WAITING";
        run.waitingForReply = false;
        run.resumeAt = new Date(now.getTime() + step.params.minutes * 60_000);
        run.currentStepId = resolveJump(definition, step, step.next);
        log(step, `en pausa hasta ${run.resumeAt.toISOString()}`);
        break;
      }
      case "assign_advisor": {
        if (!context.conversation) {
          log(step, "sin conversación que asignar");
        } else if (step.params.mode === "specific" && step.params.userId) {
          effects.push({ kind: "assign_advisor", stepId: step.id, stepIndex, mode: "specific", userId: step.params.userId });
          log(step, "asignada al asesor elegido");
        } else {
          effects.push({ kind: "assign_advisor", stepId: step.id, stepIndex, mode: "round_robin" });
          log(step, "repartida al asesor disponible con menos carga");
        }
        goTo(step, step.next);
        break;
      }
      case "hand_to_ai": {
        if (!context.conversation) {
          log(step, "sin conversación");
        } else if (context.conversation.hasAiAgent) {
          effects.push({ kind: "set_responder", stepId: step.id, stepIndex, state: "IA_ACTIVA", note: "el flujo pasó la conversación al asistente" });
          log(step, "el asistente responde desde ahora");
        } else {
          effects.push({ kind: "set_responder", stepId: step.id, stepIndex, state: "REQUIERE_ASESOR", note: "el número no tiene asistente" });
          log(step, "sin asistente en el número: requiere asesor");
        }
        goTo(step, step.next);
        break;
      }
      case "require_advisor": {
        if (context.conversation) {
          effects.push({ kind: "set_responder", stepId: step.id, stepIndex, state: "REQUIERE_ASESOR", note: fillVariables(step.params.note, context) || "el flujo pidió un asesor" });
          log(step, "requiere asesor");
        } else {
          log(step, "sin conversación");
        }
        goTo(step, step.next);
        break;
      }
      case "add_tag": {
        const already = (context.contact?.tags ?? []).some((tag) => normalize(tag) === normalize(step.params.tag));
        if (!context.contact) {
          log(step, "sin contacto");
        } else if (already) {
          log(step, `ya tenía la etiqueta «${step.params.tag}»`);
        } else {
          context.contact.tags.push(step.params.tag);
          effects.push({ kind: "add_tag", stepId: step.id, stepIndex, tag: step.params.tag });
          log(step, `etiqueta «${step.params.tag}» agregada`);
        }
        goTo(step, step.next);
        break;
      }
      case "set_stage": {
        if (!context.opportunity) {
          log(step, "sin oportunidad abierta: no se cambió la etapa");
        } else if (context.opportunity.stage === step.params.stage) {
          log(step, `ya estaba en ${step.params.stage}`);
        } else {
          context.opportunity.stage = step.params.stage;
          effects.push({ kind: "set_stage", stepId: step.id, stepIndex, stage: step.params.stage });
          log(step, `etapa cambiada a ${step.params.stage}`);
        }
        goTo(step, step.next);
        break;
      }
      case "condition": {
        const result = evaluateCondition(step.params, context);
        log(step, result ? "se cumple" : "no se cumple", result ? "onTrue" : "onFalse");
        goTo(step, result ? step.onTrue : step.onFalse);
        break;
      }
      case "notify": {
        effects.push({ kind: "notify", stepId: step.id, stepIndex, text: fillVariables(step.params.text, context) });
        log(step, "aviso registrado");
        goTo(step, step.next);
        break;
      }
      case "end": {
        log(step, step.params.reason ?? "fin del flujo");
        endRun(run, step.params.reason ?? "flujo completado");
        break;
      }
    }
  }

  return { effects, nextRun: run };
}

export type ResumeBranch = "reply" | "timeout" | "wait";

/**
 * Reanuda una ejecución en espera: por respuesta del cliente, por vencer el
 * plazo, o por terminar una pausa. Devuelve el estado listo para `advance`.
 */
export function resume(definition: WorkflowDefinition, input: RunState, branch: ResumeBranch, now: Date, detail?: string): RunState {
  const run = cloneRun(input);
  if (run.status !== "WAITING") return run;
  const at = now.toISOString();
  if (exceededLifetime(run, now)) {
    endRun(run, `superó los ${MAX_DAYS} días de vida`);
    return run;
  }
  if (run.waitingForReply) {
    const step = findStep(definition, run.currentStepId);
    if (!step || step.type !== "wait_reply") {
      endRun(run, "la espera ya no existe en el flujo", "FAILED");
      return run;
    }
    if (branch === "reply") {
      run.log.push({ at, stepId: step.id, type: step.type, result: detail ? `respondió: ${detail.slice(0, 120)}` : "respondió", branch: "onReply" });
      run.currentStepId = resolveJump(definition, step, step.onReply);
    } else {
      run.log.push({ at, stepId: step.id, type: step.type, result: "no respondió a tiempo", branch: "onTimeout" });
      run.currentStepId = resolveJump(definition, step, step.onTimeout);
    }
  }
  run.status = "RUNNING";
  run.waitingForReply = false;
  run.resumeAt = null;
  return run;
}

/** Marca detenida una ejecución en curso (BR-011 u otra causa externa). */
export function stop(input: RunState, reason: string, now: Date): RunState {
  const run = cloneRun(input);
  if (run.status !== "RUNNING" && run.status !== "WAITING") return run;
  run.log.push({ at: now.toISOString(), stepId: run.currentStepId ?? "", type: "stop", result: reason });
  endRun(run, reason, "STOPPED");
  return run;
}

export function newRunState(startedAt: Date, firstStepId: string | null): RunState {
  return { status: "RUNNING", currentStepId: firstStepId, stepCount: 0, waitingForReply: false, resumeAt: null, startedAt, log: [], endReason: null };
}
