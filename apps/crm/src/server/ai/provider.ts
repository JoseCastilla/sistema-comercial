/**
 * Contrato del proveedor de modelo (SPEC-058, D-«adaptador interno mínimo»).
 *
 * Aquí no hay bucle de herramientas ni base de datos: el proveedor hace **una**
 * llamada y devuelve lo que el modelo respondió. El bucle vive en `runtime.ts`.
 * Módulo puro (sin `server-only`) para que las pruebas puedan importarlo y
 * sustituir el proveedor por uno falso.
 */

/** Bloque del `system`. El último lleva `cacheControl` para abaratar cada turno. */
export interface SystemBlock {
  type: "text";
  text: string;
  /** Marca de caché; solo el último bloque estable la lleva. */
  cacheControl?: boolean;
}

/**
 * Bloques de contenido del historial. `thinking` y `redactedThinking` se
 * devuelven tal cual al modelo en el siguiente paso del bucle de herramientas:
 * el razonamiento del turno en curso no se edita ni se descarta.
 */
export type ProviderContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string; isError?: boolean }
  | { type: "thinking"; thinking: string; signature: string }
  | { type: "redacted_thinking"; data: string };

export interface ProviderMessage {
  role: "user" | "assistant";
  content: ProviderContentBlock[];
}

/** Definición de una herramienta tal como la ve el modelo. */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema con `additionalProperties: false` y todas las claves en `required`. */
  inputSchema: Record<string, unknown>;
}

export type Effort = "low" | "medium" | "high";

export interface CompletionRequest {
  model: string;
  effort: Effort;
  maxTokens?: number;
  system: SystemBlock[];
  messages: ProviderMessage[];
  tools: ToolDefinition[];
}

export interface ToolCall {
  id: string;
  name: string;
  /** Siempre un objeto ya interpretado; nunca una cadena por comparar. */
  input: Record<string, unknown>;
}

export interface CompletionUsage {
  input: number;
  output: number;
  cacheRead: number;
}

export interface CompletionResult {
  text: string;
  toolCalls: ToolCall[];
  /** `end_turn`, `tool_use`, `max_tokens`, `refusal`… */
  stopReason: string;
  usage: CompletionUsage;
  costUsd: number;
  /**
   * El turno del asistente tal cual, para devolverlo al modelo en el siguiente
   * paso del bucle sin perder el razonamiento.
   */
  assistantContent: ProviderContentBlock[];
}

export interface ModelOption {
  id: string;
  label: string;
}

export interface LlmProvider {
  id: "ANTHROPIC";
  listModels(): Promise<ModelOption[]>;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

/** El proveedor no tiene credenciales configuradas: la pantalla lo explica. */
export class MissingProviderKeyError extends Error {
  constructor(message = "Falta la clave del proveedor de IA (ANTHROPIC_API_KEY): el asistente no puede responder.") {
    super(message);
    this.name = "MissingProviderKeyError";
  }
}

/** El proveedor falló (límite de uso, red, respuesta inválida). El mensaje ya viene en español. */
export class ProviderError extends Error {
  constructor(
    message: string,
    /** Si conviene reintentar más tarde (límite de uso o red). */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Modelos que se ofrecen cuando no hay clave para preguntarle al proveedor. */
export const FALLBACK_MODELS: ModelOption[] = [
  { id: "claude-opus-5", label: "Claude Opus 5" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
];

export const DEFAULT_MODEL_ID = "claude-opus-5";

/** Dólares por millón de tokens. Lectura de caché: 10 % de la entrada. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export const CACHE_READ_RATIO = 0.1;

/** Precio del modelo; si es desconocido se cobra como el más caro para no subestimar el gasto. */
export function priceOf(model: string): { input: number; output: number } {
  return PRICES[model] ?? { input: 5, output: 25 };
}

/** Costo en dólares de un turno. Pura y probada: alimenta `AiTurn.costUsd` y el tope mensual. */
export function estimateCostUsd(model: string, usage: CompletionUsage): number {
  const price = priceOf(model);
  const dollars =
    (usage.input * price.input + usage.cacheRead * price.input * CACHE_READ_RATIO + usage.output * price.output) / 1_000_000;
  // Seis decimales: el mismo detalle que guarda la columna `cost_usd`.
  return Math.round(dollars * 1_000_000) / 1_000_000;
}

export function emptyUsage(): CompletionUsage {
  return { input: 0, output: 0, cacheRead: 0 };
}

export function addUsage(a: CompletionUsage, b: CompletionUsage): CompletionUsage {
  return { input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead };
}
