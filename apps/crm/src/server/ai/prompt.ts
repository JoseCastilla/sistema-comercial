import { z } from "zod";

import type { SystemBlock } from "./provider";

/**
 * Armado del bloque estable del agente (SPEC-058 BR-002, BR-003, BR-005).
 *
 * Módulo puro: recibe la configuración, los artículos y los ejemplos ya
 * cargados y devuelve los bloques de `system`. Lo usan el runtime, el
 * simulador y las pruebas. Nada de base de datos aquí.
 */

// ───────────────────────── Configuración del agente ─────────────────────────

const line = z.string().trim().max(400);
const lines = z.array(line).max(30).default([]);

export const agentConfigSchema = z.object({
  displayName: z.string().trim().max(120).default("Asistente virtual"),
  objective: z.string().trim().max(600).default(""),
  tone: z.string().trim().max(300).default(""),
  /** Lo que debe hacer, en orden. */
  must: lines,
  /** Lo que nunca debe hacer. */
  never: lines,
  /** Datos a reunir, en el orden en que se piden. */
  dataToCollect: lines,
  /** Lista permitida para la herramienta `etiquetar`. */
  allowedTags: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  /** Mensaje de despedida al derivar; si está vacío el agente lo redacta. */
  handoffMessage: z.string().trim().max(400).default(""),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;

export function parseAgentConfig(value: unknown): AgentConfig {
  const parsed = agentConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : agentConfigSchema.parse({});
}

export const scheduleModes = ["ALWAYS", "OUTSIDE_BUSINESS_HOURS", "WHEN_NO_ADVISOR"] as const;
export type ScheduleMode = (typeof scheduleModes)[number];

export const scheduleSchema = z.object({ mode: z.enum(scheduleModes).default("WHEN_NO_ADVISOR") });

export function parseSchedule(value: unknown): { mode: ScheduleMode } {
  const parsed = scheduleSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { mode: "WHEN_NO_ADVISOR" };
}

export const SCHEDULE_LABELS: Record<ScheduleMode, string> = {
  ALWAYS: "Siempre",
  OUTSIDE_BUSINESS_HOURS: "Solo fuera del horario de atención",
  WHEN_NO_ADVISOR: "Solo cuando no hay ningún asesor conectado",
};

export const SCHEDULE_HINTS: Record<ScheduleMode, string> = {
  ALWAYS: "Contesta el primero siempre, también en horario. Los asesores toman control cuando quieren.",
  OUTSIDE_BUSINESS_HOURS: "En horario contestan las personas; fuera de horario contesta el asistente.",
  WHEN_NO_ADVISOR: "Contesta solo si en ese momento nadie del equipo está conectado.",
};

// ───────────────────────── Conocimiento y ejemplos ─────────────────────────

export interface KnowledgeArticleInput {
  id: string;
  title: string;
  content: string;
  validFrom: Date | string;
  validUntil: Date | string | null;
}

export interface ExampleTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ExampleInput {
  id: string;
  /** GOOD | BAD */
  kind: string;
  turns: ExampleTurn[];
  note?: string | null;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Artículos vigentes: `validFrom <= ahora < validUntil` (o sin fin).
 * Un artículo vencido deja de usarse solo, sin publicar una versión nueva
 * (SPEC-058 AC-008).
 */
export function articlesInForce<T extends { validFrom: Date | string; validUntil: Date | string | null }>(
  articles: readonly T[],
  now: Date,
): T[] {
  const at = now.getTime();
  return articles.filter((article) => {
    const from = asDate(article.validFrom).getTime();
    if (Number.isNaN(from) || from > at) return false;
    if (article.validUntil === null || article.validUntil === undefined) return true;
    const until = asDate(article.validUntil).getTime();
    return Number.isNaN(until) ? true : at < until;
  });
}

// ───────────────────────── Política obligatoria ─────────────────────────

/**
 * Reglas que no dependen de la configuración y que ninguna organización puede
 * quitar (SPEC-058 §3 y BR-004). Van primero para que el resto del texto no
 * las contradiga.
 */
export const MANDATORY_POLICY = [
  "Eres un asistente virtual de este negocio, no una persona. Si te preguntan si eres humano, dilo claro: eres un asistente virtual.",
  "En tu primer mensaje de la conversación preséntate como asistente virtual del negocio.",
  "Ofrece siempre la opción de hablar con una persona. Si te la piden, usa la herramienta `pasar_a_asesor` en ese mismo turno y no sigas preguntando.",
  "Solo hablas de los servicios de este negocio. Ante cualquier tema ajeno (tareas, política, salud, recetas, programación) responde con amabilidad que no puedes ayudar con eso y vuelve al servicio.",
  "Nunca inventes ni estimes precios, cargos fijos, descuentos, promociones, plazos de entrega, cobertura ni horarios. Solo puedes decir lo que te devolvió una herramienta en esta conversación. Si no lo tienes, di que un asesor lo confirma y deriva.",
  "Nunca pidas números de tarjeta, códigos de verificación, claves ni contraseñas. Si la persona los escribe, pídele que no los comparta por este medio.",
  "Nunca prometas ingresar un pedido, consultar un documento en un servicio externo ni cambiar de asesor: eso lo hace una persona.",
  "Escribe como en WhatsApp: mensajes cortos, en español peruano, trato de «tú», sin listas largas ni formato de documento. Una idea por mensaje y como mucho una pregunta por turno.",
  "Si te mandan un audio, una imagen o un documento que no puedes interpretar con seguridad, no adivines: deriva a un asesor.",
  "Si la persona se molesta o reclama, no discutas: deriva a un asesor con un resumen.",
  "Si llevas tres turnos seguidos sin avanzar, deriva a un asesor.",
] as const;

// ───────────────────────── Armado del `system` ─────────────────────────

function bullets(items: readonly string[]): string {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");
}

function numbered(items: readonly string[]): string {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

export interface BuildSystemInput {
  config: AgentConfig;
  articles: readonly KnowledgeArticleInput[];
  examples: readonly ExampleInput[];
  now: Date;
  /** Nombre de la empresa, para que el agente sepa a quién representa. */
  organizationName?: string;
}

export interface BuiltSystem {
  blocks: SystemBlock[];
  /** Ids de los artículos que entraron en el bloque, para guardarlos en `AiTurn.articlesUsed`. */
  articleIds: string[];
}

/**
 * Bloques de `system`: identidad y reglas, luego conocimiento vigente, luego
 * ejemplos. Solo el último bloque lleva marca de caché: todo lo anterior se
 * reutiliza turno a turno mientras no cambie.
 */
export function buildSystem(input: BuildSystemInput): BuiltSystem {
  const { config } = input;
  const inForce = articlesInForce(input.articles, input.now);

  const identity: string[] = [
    `Te llamas ${config.displayName || "Asistente virtual"} y atiendes por WhatsApp a quienes escriben a ${input.organizationName ?? "este negocio"}.`,
  ];
  if (config.objective) identity.push(`Tu objetivo: ${config.objective}`);
  if (config.tone) identity.push(`Tono: ${config.tone}`);

  const sections: string[] = [identity.join("\n")];
  sections.push(`# Reglas que no puedes romper\n${bullets(MANDATORY_POLICY)}`);
  if (config.must.length) sections.push(`# Lo que debes hacer\n${bullets(config.must)}`);
  if (config.never.length) sections.push(`# Lo que nunca debes hacer\n${bullets(config.never)}`);
  if (config.dataToCollect.length) {
    sections.push(
      `# Datos que debes reunir, en este orden\n${numbered(config.dataToCollect)}\nPide un dato por mensaje y guárdalo con \`guardar_dato_lead\` apenas lo tengas. No repitas un dato que la persona ya te dio.`,
    );
  }
  if (config.allowedTags.length) {
    sections.push(`# Etiquetas permitidas\nSolo puedes usar estas con \`etiquetar\`: ${config.allowedTags.join(", ")}.`);
  }
  if (config.handoffMessage) {
    sections.push(`# Al derivar\nDespídete con este sentido: «${config.handoffMessage}»`);
  }

  const knowledge = inForce.length
    ? `# Lo que sabes del negocio\nResponde solo con esto. Si la pregunta no está aquí ni te la resuelve una herramienta, di que lo confirma un asesor y deriva.\n\n${inForce
        .map((article) => `## ${article.title}\n${article.content.trim()}`)
        .join("\n\n")}`
    : "# Lo que sabes del negocio\nNo hay artículos vigentes. Para cualquier pregunta de contenido, di que lo confirma un asesor y deriva.";

  const good = input.examples.filter((example) => example.kind === "GOOD");
  const bad = input.examples.filter((example) => example.kind !== "GOOD");
  const exampleSections: string[] = [];
  if (good.length) exampleSections.push(`# Así sí\n${good.map(renderExample).join("\n\n")}`);
  if (bad.length) exampleSections.push(`# Así no\n${bad.map(renderExample).join("\n\n")}`);

  const blocks: SystemBlock[] = [
    { type: "text", text: sections.join("\n\n") },
    { type: "text", text: knowledge },
  ];
  if (exampleSections.length) blocks.push({ type: "text", text: exampleSections.join("\n\n") });
  // Solo el último bloque marca la caché: cubre todo lo estable de antes.
  const last = blocks[blocks.length - 1];
  if (last) last.cacheControl = true;

  return { blocks, articleIds: inForce.map((article) => article.id) };
}

function renderExample(example: ExampleInput): string {
  const body = example.turns
    .map((turn) => `${turn.role === "user" ? "Cliente" : "Asistente"}: ${turn.text.trim()}`)
    .join("\n");
  return example.note ? `${body}\n(Nota del supervisor: ${example.note.trim()})` : body;
}
