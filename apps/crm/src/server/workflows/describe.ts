import type { StepType, TriggerKind, WorkflowStep, WorkflowTrigger } from "./schema";

/**
 * Textos en lenguaje directo para la interfaz (BR-006): qué dispara el flujo
 * y qué hace cada paso. Puro: lo usan el servidor y el editor en el navegador.
 */

export const TRIGGER_LABELS: Record<TriggerKind, string> = {
  INBOUND_MESSAGE: "Llega un mensaje",
  CONVERSATION_UNANSWERED: "El asesor no responde",
  CLIENT_SILENT: "El cliente deja de responder",
  OPPORTUNITY_STAGE: "La oportunidad cambia de etapa",
  APPOINTMENT_CREATED: "Se agenda una cita",
  APPOINTMENT_DUE: "Se acerca una cita",
  ORDER_STATUS: "Un pedido cambia de estado",
  CONTACT_TAGGED: "Se etiqueta a un contacto",
};

export const STEP_LABELS: Record<StepType, string> = {
  send_text: "Enviar mensaje libre",
  send_template: "Enviar plantilla",
  send_buttons: "Preguntar con botones",
  wait_reply: "Esperar la respuesta",
  wait: "Esperar un tiempo",
  assign_advisor: "Asignar a un asesor",
  hand_to_ai: "Pasar al asistente",
  require_advisor: "Pedir un asesor",
  add_tag: "Etiquetar al contacto",
  set_stage: "Cambiar la etapa",
  condition: "Si… / si no…",
  notify: "Dejar un aviso",
  end: "Terminar",
};

export const STAGE_LABELS: Record<string, string> = {
  NUEVO: "Nuevo",
  EN_CONTACTO: "En contacto",
  CALIFICADO: "Calificado",
  PROPUESTA: "Propuesta",
  EN_CIERRE: "En cierre",
  GANADA: "Ganada",
  PERDIDA: "Perdida",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  INGRESADO: "Ingresado",
  ENTREGADO: "Entregado",
  ACTIVADO: "Activado",
  CANCELADO: "Cancelado",
};

export const CONDITION_FIELD_LABELS: Record<string, string> = {
  "contact.tag": "El contacto tiene la etiqueta",
  "opportunity.stage": "La etapa de la oportunidad",
  "conversation.fromAd": "La conversación viene de un anuncio",
  "contact.hasDocument": "El contacto tiene DNI registrado",
  "contact.marketingOptIn": "El contacto aceptó marketing",
  businessHours: "Estamos en horario de atención",
};

export const BOOLEAN_CONDITION_FIELDS = ["conversation.fromAd", "contact.hasDocument", "contact.marketingOptIn", "businessHours"];

export const RUN_STATUS_LABELS: Record<string, string> = {
  RUNNING: "En curso",
  WAITING: "Esperando",
  DONE: "Terminada",
  STOPPED: "Detenida",
  FAILED: "Falló",
};

export const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  PAUSED: "Pausado",
};

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours >= 24 && hours % 24 === 0) return hours === 24 ? "1 día" : `${hours / 24} días`;
  return hours === 1 ? "1 hora" : `${hours} horas`;
}

export function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return formatHours(minutes / 60);
  return `${minutes} min`;
}

export function describeTrigger(trigger: WorkflowTrigger): string {
  switch (trigger.kind) {
    case "INBOUND_MESSAGE": {
      const parts: string[] = [];
      if (trigger.filters.firstMessageOnly) parts.push("es el primero de la conversación");
      if (trigger.filters.fromAd) parts.push("viene de un anuncio");
      if (trigger.filters.keyword) parts.push(`contiene «${trigger.filters.keyword}»`);
      if (trigger.filters.outsideBusinessHours) parts.push("llega fuera del horario de atención");
      return parts.length ? `Llega un mensaje que ${parts.join(" y ")}` : "Llega cualquier mensaje";
    }
    case "CONVERSATION_UNANSWERED":
      return `El asesor no responde en ${formatMinutes(trigger.filters.minutes)}`;
    case "CLIENT_SILENT":
      return `El cliente lleva ${formatHours(trigger.filters.hours)} sin responder`;
    case "OPPORTUNITY_STAGE":
      return `La oportunidad pasa a «${STAGE_LABELS[trigger.filters.stage] ?? trigger.filters.stage}»`;
    case "APPOINTMENT_CREATED":
      return "Se agenda una cita";
    case "APPOINTMENT_DUE":
      return `Faltan ${formatHours(trigger.filters.hoursBefore)} para una cita`;
    case "ORDER_STATUS":
      return `Un pedido pasa a «${ORDER_STATUS_LABELS[trigger.filters.status] ?? trigger.filters.status}»`;
    case "CONTACT_TAGGED":
      return `Se etiqueta a un contacto con «${trigger.filters.tag}»`;
  }
}

const preview = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}…` : text);

export function describeStep(step: WorkflowStep, lookup: { templateName?: (id: string) => string | undefined; userName?: (id: string) => string | undefined } = {}): string {
  switch (step.type) {
    case "send_text":
      return step.params.text ? `Envía «${preview(step.params.text)}» (solo si aún puedes escribirle libremente)` : "Envía un mensaje libre";
    case "send_template": {
      const name = step.params.templateId ? lookup.templateName?.(step.params.templateId) : undefined;
      return name ? `Envía la plantilla «${name}»` : "Envía una plantilla (elige cuál)";
    }
    case "send_buttons":
      return `Pregunta «${preview(step.params.text)}» con ${step.params.buttons.length} ${step.params.buttons.length === 1 ? "botón" : "botones"}`;
    case "wait_reply":
      return `Espera la respuesta hasta ${formatHours(step.params.hours)}; si no responde, sigue por la rama «no respondió»`;
    case "wait":
      return `Espera ${formatMinutes(step.params.minutes)} y sigue`;
    case "assign_advisor": {
      if (step.params.mode === "specific") {
        const name = step.params.userId ? lookup.userName?.(step.params.userId) : undefined;
        return name ? `Asigna la conversación a ${name}` : "Asigna la conversación a un asesor (elige quién)";
      }
      return "Reparte la conversación al asesor disponible con menos carga; si nadie está conectado, queda pendiente de asesor";
    }
    case "hand_to_ai":
      return "El asistente de IA responde desde aquí; si el número no tiene asistente, queda pendiente de asesor";
    case "require_advisor":
      return step.params.note ? `Pide un asesor con la nota «${preview(step.params.note)}»` : "Pide un asesor";
    case "add_tag":
      return `Etiqueta al contacto con «${step.params.tag}»`;
    case "set_stage":
      return `Pasa la oportunidad a «${STAGE_LABELS[step.params.stage] ?? step.params.stage}»`;
    case "condition": {
      const field = CONDITION_FIELD_LABELS[step.params.field] ?? step.params.field;
      if (BOOLEAN_CONDITION_FIELDS.includes(step.params.field)) return step.params.op === "neq" ? `Si NO: ${field.toLowerCase()}` : `Si: ${field.toLowerCase()}`;
      const op = step.params.op === "neq" ? "no es" : step.params.op === "has" ? "incluye" : "es";
      return `Si ${field.toLowerCase()} ${op} «${step.params.value ?? ""}»`;
    }
    case "notify":
      return `Deja el aviso «${preview(step.params.text)}» en la conversación`;
    case "end":
      return step.params.reason ? `Termina: ${step.params.reason}` : "Termina el flujo";
  }
}
