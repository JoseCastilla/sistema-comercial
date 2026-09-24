import type { StepType, WorkflowDefinition, WorkflowStep } from "./schema";

/**
 * Validación en vivo del flujo (SPEC-060 BR-005). Es pura: la usa el editor en
 * el navegador mientras se arma el flujo y el servidor antes de activarlo.
 * Un problema `error` impide activar; un `aviso` solo advierte.
 */

export type ProblemLevel = "error" | "aviso";

export interface WorkflowProblem {
  level: ProblemLevel;
  message: string;
  stepId?: string;
}

export interface TemplateFacts {
  id: string;
  name: string;
  status: string;
  category: string;
}

export interface JumpField {
  key: string;
  label: string;
}

/** Saltos de cada tipo de paso, en el orden en que se muestran en el editor. */
export const JUMP_FIELDS: Record<StepType, readonly JumpField[]> = {
  send_text: [
    { key: "next", label: "Después de enviar" },
    { key: "onFail", label: "Si no se pudo enviar" },
  ],
  send_template: [
    { key: "next", label: "Después de enviar" },
    { key: "onFail", label: "Si no se pudo enviar" },
  ],
  send_buttons: [
    { key: "next", label: "Después de preguntar" },
    { key: "onFail", label: "Si no se pudo enviar" },
  ],
  wait_reply: [
    { key: "onReply", label: "Si responde" },
    { key: "onTimeout", label: "Si no responde" },
  ],
  wait: [{ key: "next", label: "Al terminar la espera" }],
  assign_advisor: [{ key: "next", label: "Después" }],
  hand_to_ai: [{ key: "next", label: "Después" }],
  require_advisor: [{ key: "next", label: "Después" }],
  add_tag: [{ key: "next", label: "Después" }],
  set_stage: [{ key: "next", label: "Después" }],
  condition: [
    { key: "onTrue", label: "Si se cumple" },
    { key: "onFalse", label: "Si no se cumple" },
  ],
  notify: [{ key: "next", label: "Después" }],
  end: [],
};

/** Lee un salto sin romper el tipado del paso. */
export function readJump(step: WorkflowStep, key: string): string | undefined {
  const value = (step as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : undefined;
}

/** Devuelve el paso con el salto cambiado (vacío = «el siguiente de la lista»). */
export function writeJump(step: WorkflowStep, key: string, value: string): WorkflowStep {
  const copy = { ...(step as unknown as Record<string, unknown>) };
  if (value) copy[key] = value;
  else delete copy[key];
  return copy as unknown as WorkflowStep;
}

const WINDOW_SAFE_TRIGGERS = ["INBOUND_MESSAGE", "CONVERSATION_UNANSWERED"];

/** Horas acumuladas sin que el cliente escriba al empezar el flujo; null = no se sabe. */
function initialSilentHours(definition: WorkflowDefinition): number | null {
  if (WINDOW_SAFE_TRIGGERS.includes(definition.trigger.kind)) return 0;
  if (definition.trigger.kind === "CLIENT_SILENT") return definition.trigger.filters.hours;
  return null;
}

function nextInList(definition: WorkflowDefinition, stepId: string): string | undefined {
  const index = definition.steps.findIndex((step) => step.id === stepId);
  return definition.steps[index + 1]?.id;
}

/** Destino real de un salto: el explícito o, si no hay, el siguiente de la lista. */
function target(definition: WorkflowDefinition, step: WorkflowStep, key: string): string | undefined {
  return readJump(step, key) ?? nextInList(definition, step.id);
}

interface Walk {
  stepId: string;
  /** Horas desde el último mensaje del cliente; null cuando no se puede saber. */
  silentHours: number | null;
}

const CAP_HOURS = 24;

/** Recorre el flujo desde el primer paso llevando cuánto puede llevar callado el cliente. */
function walk(definition: WorkflowDefinition): { reached: Set<string>; risk: Map<string, Set<string>> } {
  const reached = new Set<string>();
  const risk = new Map<string, Set<string>>();
  const first = definition.steps[0];
  if (!first) return { reached, risk };
  const seen = new Set<string>();
  const queue: Walk[] = [{ stepId: first.id, silentHours: initialSilentHours(definition) }];

  const push = (stepId: string | undefined, silentHours: number | null) => {
    if (!stepId) return;
    const capped = silentHours === null ? null : Math.min(silentHours, CAP_HOURS);
    const key = `${stepId}:${capped ?? "?"}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({ stepId, silentHours: capped });
  };

  while (queue.length) {
    const current = queue.shift()!;
    const step = definition.steps.find((candidate) => candidate.id === current.stepId);
    if (!step) continue;
    reached.add(step.id);
    const marks = risk.get(step.id) ?? new Set<string>();
    marks.add(current.silentHours === null ? "?" : String(current.silentHours));
    risk.set(step.id, marks);

    switch (step.type) {
      case "wait":
        push(target(definition, step, "next"), current.silentHours === null ? null : current.silentHours + step.params.minutes / 60);
        break;
      case "wait_reply":
        // Si responde, la ventana vuelve a abrirse; si no responde, siguió callado.
        push(target(definition, step, "onReply"), 0);
        push(target(definition, step, "onTimeout"), current.silentHours === null ? null : current.silentHours + step.params.hours);
        break;
      case "end":
        break;
      default:
        for (const jump of JUMP_FIELDS[step.type]) push(target(definition, step, jump.key), current.silentHours);
        break;
    }
  }
  return { reached, risk };
}

const WAIT_TYPES: StepType[] = ["wait", "wait_reply"];

/** Primer bucle sin ninguna espera: daría vueltas hasta el tope de 50 pasos. */
function loopWithoutWait(definition: WorkflowDefinition): string | null {
  const color = new Map<string, number>();
  const stack: string[] = [];
  let found: string | null = null;

  const visit = (stepId: string) => {
    if (found) return;
    const step = definition.steps.find((candidate) => candidate.id === stepId);
    if (!step) return;
    const state = color.get(stepId) ?? 0;
    if (state === 1) {
      const cycle = stack.slice(stack.indexOf(stepId));
      const hasWait = cycle.some((id) => {
        const inCycle = definition.steps.find((candidate) => candidate.id === id);
        return inCycle ? WAIT_TYPES.includes(inCycle.type) : false;
      });
      if (!hasWait) found = stepId;
      return;
    }
    if (state === 2) return;
    color.set(stepId, 1);
    stack.push(stepId);
    for (const jump of JUMP_FIELDS[step.type]) {
      const next = target(definition, step, jump.key);
      if (next) visit(next);
    }
    stack.pop();
    color.set(stepId, 2);
  };

  for (const step of definition.steps) visit(step.id);
  return found;
}

export function validateWorkflow(definition: WorkflowDefinition, templates: TemplateFacts[]): WorkflowProblem[] {
  const problems: WorkflowProblem[] = [];
  const steps = definition.steps;
  if (!steps.length) {
    return [{ level: "error", message: "El flujo todavía no hace nada: agrega al menos un paso." }];
  }

  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) problems.push({ level: "error", stepId: step.id, message: "Hay dos pasos con el mismo identificador." });
    ids.add(step.id);
  }

  for (const step of steps) {
    for (const jump of JUMP_FIELDS[step.type]) {
      const value = readJump(step, jump.key);
      if (value && !ids.has(value)) {
        problems.push({ level: "error", stepId: step.id, message: `«${jump.label}» apunta a un paso que ya no existe.` });
      }
    }
  }

  const { reached, risk } = walk(definition);
  for (const step of steps) {
    if (!reached.has(step.id)) {
      problems.push({ level: "error", stepId: step.id, message: "No se llega a este paso desde el inicio: conéctalo o quítalo." });
    }
  }

  const byId = new Map(templates.map((template) => [template.id, template]));
  for (const step of steps) {
    switch (step.type) {
      case "wait_reply": {
        if (!readJump(step, "onTimeout")) {
          problems.push({ level: "error", stepId: step.id, message: "Falta decir qué pasa si no responde: elige el paso de esa rama." });
        }
        break;
      }
      case "send_text":
      case "send_buttons": {
        if (!step.params.text.trim()) {
          problems.push({ level: "error", stepId: step.id, message: step.type === "send_text" ? "Escribe el mensaje que se envía." : "Escribe la pregunta que se envía." });
        }
        const marks = risk.get(step.id) ?? new Set<string>();
        if ([...marks].some((mark) => mark !== "?" && Number(mark) >= CAP_HOURS)) {
          problems.push({ level: "error", stepId: step.id, message: "Aquí ya pasaron 24 h desde el último mensaje del cliente: no se puede escribir libre, usa una plantilla." });
        } else if (marks.has("?")) {
          problems.push({ level: "aviso", stepId: step.id, message: "Este disparador no siempre ocurre con la ventana abierta: si está cerrada, el mensaje no sale." });
        }
        break;
      }
      case "send_template": {
        const template = step.params.templateId ? byId.get(step.params.templateId) : undefined;
        if (!step.params.templateId) {
          problems.push({ level: "error", stepId: step.id, message: "Elige la plantilla que se va a enviar." });
        } else if (!template || template.status !== "APPROVED") {
          problems.push({ level: "error", stepId: step.id, message: "Esa plantilla no está aprobada por Meta: elige una aprobada." });
        } else if (template.category === "MARKETING") {
          problems.push({ level: "aviso", stepId: step.id, message: "Es una plantilla de marketing: solo la activa el dueño y solo llega a quien aceptó recibirla." });
        }
        break;
      }
      case "assign_advisor": {
        if (step.params.mode === "specific" && !step.params.userId) {
          problems.push({ level: "error", stepId: step.id, message: "Elige a qué asesor se asigna." });
        }
        break;
      }
      case "condition": {
        const needsValue = step.params.field === "contact.tag" || step.params.field === "opportunity.stage";
        if (needsValue && !step.params.value) {
          problems.push({ level: "error", stepId: step.id, message: "Escribe con qué valor se compara." });
        }
        break;
      }
      case "notify": {
        if (!step.params.text.trim()) problems.push({ level: "error", stepId: step.id, message: "Escribe el aviso que queda en la conversación." });
        break;
      }
      case "add_tag": {
        if (!step.params.tag.trim()) problems.push({ level: "error", stepId: step.id, message: "Escribe la etiqueta que se le pone al contacto." });
        break;
      }
      default:
        break;
    }
  }

  const loop = loopWithoutWait(definition);
  if (loop) {
    problems.push({ level: "error", stepId: loop, message: "Este camino vuelve sobre sí mismo sin ninguna espera: el flujo daría vueltas hasta el tope de 50 pasos." });
  }

  return problems;
}

export function blockingProblems(problems: WorkflowProblem[]): WorkflowProblem[] {
  return problems.filter((problem) => problem.level === "error");
}

/** ¿El flujo envía alguna plantilla de marketing? Solo el dueño puede activarlo (BR-004). */
export function sendsMarketing(definition: WorkflowDefinition, templates: TemplateFacts[]): boolean {
  const marketing = new Set(templates.filter((template) => template.category === "MARKETING").map((template) => template.id));
  return definition.steps.some((step) => step.type === "send_template" && marketing.has(step.params.templateId));
}
