import type { ToolDefinition } from "./provider";

/**
 * Catálogo cerrado de herramientas del agente (SPEC-058 BR-007 y BR-008).
 *
 * Módulo puro: aquí solo viven los nombres, la descripción que lee el modelo y
 * el esquema de entrada. Los ejecutores están en `tools.ts`, que sí toca la
 * base. La prueba `tools.test.ts` verifica que esta lista no contiene ninguna
 * de las capacidades prohibidas (pedidos, DNI pagado, cambiar asesor,
 * plantillas): la única forma de que el agente actúe es una de estas nueve.
 */

export const TOOL_NAMES = [
  "guardar_dato_lead",
  "consultar_planes",
  "consultar_cobertura",
  "consultar_horarios",
  "avanzar_oportunidad",
  "agendar_llamada",
  "pasar_a_asesor",
  "etiquetar",
  "registrar_baja",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export function isToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}

/**
 * Lo que el agente nunca puede hacer (BR-008). No son herramientas: es la
 * lista contra la que se comprueba que no aparezca ninguna equivalente.
 */
export const FORBIDDEN_CAPABILITIES = [
  "ingresar_pedido",
  "registrar_pedido",
  "crear_pedido",
  "consultar_dni",
  "validar_dni",
  "cambiar_asesor",
  "asignar_asesor",
  "enviar_plantilla",
  "enviar_plantilla_marketing",
  "borrar_datos",
  "eliminar_contacto",
] as const;

/** Texto para la pantalla: qué hace cada herramienta, sin jerga. */
export const TOOL_LABELS: Record<ToolName, { title: string; help: string }> = {
  guardar_dato_lead: {
    title: "Guardar datos del cliente",
    help: "Anota nombre, DNI, operador actual, distrito, cuántas líneas quiere y qué plan le interesa en la ficha y en la oportunidad abierta.",
  },
  consultar_planes: {
    title: "Consultar planes vigentes",
    help: "Lee el catálogo de planes con su cargo fijo, requisitos y promoción. Es la única forma de que diga un precio.",
  },
  consultar_cobertura: {
    title: "Consultar si llega la entrega",
    help: "Dice si el distrito está en la zona de reparto conocida. Siempre aclara que la dirección exacta la confirma el asesor.",
  },
  consultar_horarios: {
    title: "Consultar horarios con cupo",
    help: "Lee los horarios de llamada disponibles de los próximos días. Solo ofrece los que tienen cupo.",
  },
  avanzar_oportunidad: {
    title: "Avanzar la oportunidad",
    help: "Mueve la oportunidad a Calificado o a Propuesta. Nunca puede llevarla a En cierre ni a Ganada.",
  },
  agendar_llamada: {
    title: "Agendar la llamada",
    help: "Reserva un horario con cupo para que un asesor llame. Si el horario se llenó, ofrece otro.",
  },
  pasar_a_asesor: {
    title: "Pasar a un asesor",
    help: "Deja la conversación en la cola con un resumen de lo conversado. Siempre disponible, no se puede desactivar.",
  },
  etiquetar: {
    title: "Etiquetar al contacto",
    help: "Agrega una etiqueta de la lista permitida. Nunca borra etiquetas.",
  },
  registrar_baja: {
    title: "Registrar la baja de marketing",
    help: "Cuando la persona pide no recibir más mensajes, deja registrada la baja con su evidencia.",
  },
};

/** Herramientas activas por defecto en un agente nuevo. */
export const DEFAULT_TOOLS: ToolName[] = [
  "guardar_dato_lead",
  "consultar_planes",
  "consultar_cobertura",
  "consultar_horarios",
  "pasar_a_asesor",
];

/** Derivar siempre está disponible (BR-007): no se puede desactivar. */
export const ALWAYS_ON_TOOLS: ToolName[] = ["pasar_a_asesor"];

function schema(properties: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const nullableString = (description: string) => ({ type: ["string", "null"], description });
const nullableInteger = (description: string) => ({ type: ["integer", "null"], description });

export const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {
  guardar_dato_lead: {
    name: "guardar_dato_lead",
    description:
      "Guarda en la ficha del cliente y en su oportunidad abierta los datos que ya te dio. Envía null en lo que todavía no sepas; nunca inventes un valor. Llámala apenas tengas un dato nuevo, sin esperar a tenerlos todos.",
    inputSchema: schema({
      nombre: nullableString("Nombre y apellido tal como lo dijo la persona."),
      dni: nullableString("DNI de 8 dígitos, solo números."),
      operador_actual: nullableString("Operador con el que está hoy (Claro, Movistar, Entel, Bitel u otro)."),
      distrito: nullableString("Distrito donde recibiría la entrega."),
      lineas: nullableInteger("Cuántas líneas quiere."),
      plan_interes: nullableString("Nombre del plan que le interesa, tal como lo nombró."),
    }),
  },
  consultar_planes: {
    name: "consultar_planes",
    description:
      "Devuelve el catálogo de planes vigente con su cargo fijo, requisitos y promoción. Es la ÚNICA fuente de precios: cualquier monto que digas tiene que venir de aquí, en esta conversación.",
    inputSchema: schema({}),
  },
  consultar_cobertura: {
    name: "consultar_cobertura",
    description:
      "Dice si un distrito está dentro de la zona de reparto conocida de Lima y Callao. No devuelve precios ni plazos. La dirección exacta siempre la confirma un asesor.",
    inputSchema: schema({
      distrito: { type: "string", description: "Distrito tal como lo escribió la persona." },
    }),
  },
  consultar_horarios: {
    name: "consultar_horarios",
    description:
      "Devuelve los horarios de llamada con cupo de los próximos días. Solo puedes ofrecer horarios que aparezcan aquí; nunca propongas uno de memoria.",
    inputSchema: schema({}),
  },
  avanzar_oportunidad: {
    name: "avanzar_oportunidad",
    description:
      "Mueve la oportunidad a CALIFICADO (ya tienes los datos mínimos) o a PROPUESTA (le ofreciste un plan del catálogo o ya tiene cita). No puedes llevarla más allá.",
    inputSchema: schema({
      etapa: { type: "string", enum: ["CALIFICADO", "PROPUESTA"], description: "Etapa a la que la mueves." },
      plan_id: nullableString("Identificador del plan del catálogo que le ofreciste, tal como lo devolvió consultar_planes."),
      lineas: nullableInteger("Cuántas líneas incluye la propuesta."),
      motivo: nullableString("En una frase, por qué la mueves."),
    }),
  },
  agendar_llamada: {
    name: "agendar_llamada",
    description:
      "Reserva un horario con cupo para que un asesor llame. Usa exactamente uno de los horarios que devolvió consultar_horarios. Si el horario se llenó mientras conversaban, la herramienta te lo dice y ofreces otro.",
    inputSchema: schema({
      horario_iso: { type: "string", description: "Inicio del horario en formato ISO, tal como lo devolvió consultar_horarios." },
    }),
  },
  pasar_a_asesor: {
    name: "pasar_a_asesor",
    description:
      "Deja la conversación en la cola del equipo con un resumen. Úsala cuando la persona lo pida, cuando ya reuniste los datos, cuando no puedas responder con lo que sabes, cuando haya molestia o cuando lleves tres turnos sin avanzar. Después de llamarla, despídete en un mensaje corto y no sigas preguntando.",
    inputSchema: schema({
      resumen: { type: "string", description: "Qué quiere la persona y qué datos ya diste por reunidos, en dos o tres frases." },
      motivo: {
        type: "string",
        enum: ["LO_PIDIO", "DATOS_COMPLETOS", "FUERA_DE_MI_ALCANCE", "MOLESTIA", "SIN_AVANCE", "ADJUNTO_NO_ENTENDIDO"],
        description: "Por qué derivas.",
      },
    }),
  },
  etiquetar: {
    name: "etiquetar",
    description: "Agrega una etiqueta de la lista permitida al contacto. Nunca borra etiquetas ni inventa una que no esté en la lista.",
    inputSchema: schema({
      etiqueta: { type: "string", description: "Etiqueta exactamente como aparece en la lista permitida." },
    }),
  },
  registrar_baja: {
    name: "registrar_baja",
    description:
      "Registra que la persona no quiere recibir más mensajes de marketing. Úsala solo cuando lo pida explícitamente. No cierra la conversación ni impide seguir atendiéndola.",
    inputSchema: schema({
      frase: { type: "string", description: "La frase con la que pidió la baja, tal cual la escribió." },
    }),
  },
};

/** Definiciones de las herramientas activas, en el orden fijo del catálogo (la caché depende de ese orden). */
export function toolDefinitionsFor(enabled: readonly string[]): ToolDefinition[] {
  const active = new Set<string>([...enabled, ...ALWAYS_ON_TOOLS]);
  return TOOL_NAMES.filter((name) => active.has(name)).map((name) => TOOL_DEFINITIONS[name]);
}
