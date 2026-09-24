import type { WorkflowDefinition } from "./schema";

/**
 * Flujos listos para la operación (SPEC-060 BR-017, adaptados al MVP). No se
 * siembran: se crean como borrador editable solo cuando alguien elige uno, y
 * quedan apagados hasta que se revisan y se activan.
 */

export interface WorkflowPreset {
  key: string;
  name: string;
  description: string;
  /** Qué queda por completar antes de poder activarlo. */
  pending: string;
  definition: WorkflowDefinition;
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    key: "lead-anuncio",
    name: "Recibir lead de anuncio y asignar",
    description: "El primer mensaje de alguien que viene de un anuncio se reparte a un asesor y lo atiende el asistente hasta que el asesor entre.",
    pending: "Nada: revísalo y actívalo.",
    definition: {
      trigger: { kind: "INBOUND_MESSAGE", filters: { firstMessageOnly: true, fromAd: true } },
      steps: [
        { id: "p1", type: "assign_advisor", params: { mode: "round_robin" } },
        { id: "p2", type: "hand_to_ai", params: {} },
        { id: "p3", type: "end", params: { reason: "lead recibido y asignado" } },
      ],
    },
  },
  {
    key: "lead-sin-respuesta",
    name: "Lead sin respuesta",
    description: "Si el cliente lleva 20 horas sin contestar, se le escribe una vez para retomar. Si responde, lo toma un asesor.",
    pending: "Revisa el texto de la retoma.",
    definition: {
      trigger: { kind: "CLIENT_SILENT", filters: { hours: 20 } },
      steps: [
        { id: "p1", type: "send_text", params: { text: "Hola {nombre}, ¿seguimos con tu trámite? Dime y lo vemos hoy mismo." } },
        { id: "p2", type: "wait_reply", params: { hours: 24 }, onReply: "p3", onTimeout: "p4" },
        { id: "p3", type: "require_advisor", params: { note: "Contestó a la retoma del flujo: atiéndelo." } },
        { id: "p4", type: "end", params: { reason: "no contestó la retoma" } },
      ],
    },
  },
  {
    key: "recordatorio-cita",
    name: "Recordatorio de cita",
    description: "Dos horas antes de la cita se envía el recordatorio al cliente.",
    pending: "Elige la plantilla aprobada del recordatorio.",
    definition: {
      trigger: { kind: "APPOINTMENT_DUE", filters: { hoursBefore: 2 } },
      steps: [
        { id: "p1", type: "send_template", params: { templateId: "", values: {} } },
        { id: "p2", type: "end", params: { reason: "recordatorio enviado" } },
      ],
    },
  },
  {
    key: "sin-atender",
    name: "Sin atender",
    description: "Cuando una conversación pasa el tiempo de respuesta, deja un aviso en el chat para que alguien la tome.",
    pending: "Revisa el texto del aviso.",
    definition: {
      trigger: { kind: "CONVERSATION_UNANSWERED", filters: { minutes: 15 } },
      steps: [
        { id: "p1", type: "notify", params: { text: "Esta conversación lleva rato sin respuesta: tómala o pásala a alguien." } },
        { id: "p2", type: "end", params: { reason: "aviso dejado" } },
      ],
    },
  },
  {
    key: "portabilidad",
    name: "Portabilidad",
    description: "Cuando alguien pregunta por portabilidad se le pregunta su operador actual, se etiqueta y pasa a un asesor.",
    pending: "Revisa la pregunta y los botones.",
    definition: {
      trigger: { kind: "INBOUND_MESSAGE", filters: { keyword: "porta" } },
      steps: [
        {
          id: "p1",
          type: "send_buttons",
          params: {
            text: "¿Eres de Claro, Entel, Bitel u otro?",
            buttons: [
              { id: "claro", title: "Claro" },
              { id: "entel", title: "Entel" },
              { id: "otro", title: "Bitel u otro" },
            ],
          },
        },
        { id: "p2", type: "wait_reply", params: { hours: 6 }, onReply: "p3", onTimeout: "p5" },
        { id: "p3", type: "add_tag", params: { tag: "portabilidad" } },
        { id: "p4", type: "require_advisor", params: { note: "Pregunta por portabilidad y ya dijo su operador." } },
        { id: "p5", type: "end", params: { reason: "no dijo su operador" } },
      ],
    },
  },
  {
    key: "pedido-entregado",
    name: "Pedido entregado",
    description: "Cuando el pedido pasa a entregado se avisa al cliente con una plantilla.",
    pending: "Elige la plantilla aprobada del aviso de entrega.",
    definition: {
      trigger: { kind: "ORDER_STATUS", filters: { status: "ENTREGADO" } },
      steps: [
        { id: "p1", type: "send_template", params: { templateId: "", values: {} } },
        { id: "p2", type: "end", params: { reason: "aviso de entrega enviado" } },
      ],
    },
  },
];

export function findPreset(key: string): WorkflowPreset | undefined {
  return WORKFLOW_PRESETS.find((preset) => preset.key === key);
}

/** Flujo en blanco: un disparador de mensaje entrante y un final. */
export const EMPTY_DEFINITION: WorkflowDefinition = {
  trigger: { kind: "INBOUND_MESSAGE", filters: {} },
  steps: [{ id: "p1", type: "end", params: {} }],
};
