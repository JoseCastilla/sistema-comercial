import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  DEFAULT_MODEL_ID,
  estimateCostUsd,
  MissingProviderKeyError,
  ProviderError,
  type CompletionRequest,
  type CompletionResult,
  type LlmProvider,
  type ModelOption,
  type ProviderContentBlock,
} from "../provider";

/**
 * Implementación del proveedor con la API de Claude.
 *
 * Reglas que sigue esta clase y que no se cambian sin correr el conjunto de
 * pruebas del agente (SPEC-058 BR-017):
 * - pensamiento adaptativo (`thinking: { type: "adaptive" }`) y esfuerzo por
 *   `output_config.effort`; nunca un presupuesto fijo de razonamiento;
 * - sin `temperature` y sin prellenado del asistente (la API los rechaza);
 * - el bloque estable (instrucciones + conocimiento) va en `system` con marca
 *   de caché en el último bloque; el historial va en `messages`;
 * - herramientas estrictas: `additionalProperties: false` y todas las claves
 *   en `required`, para que el `input` llegue siempre validado.
 */

const MAX_TOKENS = 4_000;

function toSdkSystem(request: CompletionRequest): Anthropic.TextBlockParam[] {
  return request.system.map((block) => ({
    type: "text" as const,
    text: block.text,
    ...(block.cacheControl ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

function toSdkContent(block: ProviderContentBlock): Anthropic.ContentBlockParam {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "tool_use":
      return { type: "tool_use", id: block.id, name: block.name, input: block.input };
    case "tool_result":
      return { type: "tool_result", tool_use_id: block.toolUseId, content: block.content, is_error: block.isError ?? false };
    case "thinking":
      return { type: "thinking", thinking: block.thinking, signature: block.signature };
    case "redacted_thinking":
      return { type: "redacted_thinking", data: block.data };
  }
}

function fromSdkContent(blocks: Anthropic.ContentBlock[]): ProviderContentBlock[] {
  const result: ProviderContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "text") result.push({ type: "text", text: block.text });
    else if (block.type === "tool_use") result.push({ type: "tool_use", id: block.id, name: block.name, input: asObject(block.input) });
    else if (block.type === "thinking") result.push({ type: "thinking", thinking: block.thinking, signature: block.signature });
    else if (block.type === "redacted_thinking") result.push({ type: "redacted_thinking", data: block.data });
  }
  return result;
}

/** El `input` de una herramienta siempre se trata como objeto, nunca como texto. */
function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

/** Traduce los errores del SDK a mensajes que la interfaz puede mostrar. */
function translate(error: unknown): never {
  if (error instanceof Anthropic.AuthenticationError) {
    throw new MissingProviderKeyError("La clave del proveedor de IA no es válida: el asistente no puede responder.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    throw new ProviderError("El proveedor de IA está limitando las llamadas. Vuelve a intentar en unos minutos.", true);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    throw new ProviderError("No se pudo conectar con el proveedor de IA.", true);
  }
  if (error instanceof Anthropic.BadRequestError) {
    throw new ProviderError(`El proveedor rechazó la petición: ${error.message}`);
  }
  if (error instanceof Anthropic.APIError) {
    throw new ProviderError(`El proveedor de IA falló (${error.status ?? "sin código"}): ${error.message}`, (error.status ?? 0) >= 500);
  }
  throw new ProviderError(error instanceof Error ? error.message : "El proveedor de IA falló.");
}

export class AnthropicProvider implements LlmProvider {
  readonly id = "ANTHROPIC" as const;

  private client: Anthropic | null = null;

  private clientOrThrow(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) throw new MissingProviderKeyError();
    // `new Anthropic()` lee ANTHROPIC_API_KEY del entorno.
    this.client ??= new Anthropic();
    return this.client;
  }

  async listModels(): Promise<ModelOption[]> {
    const client = this.clientOrThrow();
    try {
      const page = await client.models.list({ limit: 50 });
      return page.data.map((model) => ({ id: model.id, label: model.display_name }));
    } catch (error) {
      translate(error);
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const client = this.clientOrThrow();
    const model = request.model || DEFAULT_MODEL_ID;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: request.maxTokens ?? MAX_TOKENS,
        system: toSdkSystem(request),
        messages: request.messages.map((message) => ({ role: message.role, content: message.content.map(toSdkContent) })),
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
          strict: true,
        })),
        thinking: { type: "adaptive" },
        output_config: { effort: request.effort },
      });

      const assistantContent = fromSdkContent(response.content);
      const usage = {
        input: response.usage.input_tokens ?? 0,
        output: response.usage.output_tokens ?? 0,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
      };
      return {
        text: assistantContent
          .filter((block): block is { type: "text"; text: string } => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim(),
        toolCalls: assistantContent
          .filter((block): block is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => block.type === "tool_use")
          .map((block) => ({ id: block.id, name: block.name, input: block.input })),
        stopReason: response.stop_reason ?? "end_turn",
        usage,
        costUsd: estimateCostUsd(model, usage),
        assistantContent,
      };
    } catch (error) {
      translate(error);
    }
  }
}

let shared: AnthropicProvider | null = null;

export function anthropicProvider(): AnthropicProvider {
  shared ??= new AnthropicProvider();
  return shared;
}

export function providerConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
