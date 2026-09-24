import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { database } from "../database";
import { setResponderState } from "../messaging/conversation-state";

import { budgetVerdict, BUDGET_EXHAUSTED_REASON, monthStartUtc, usdToPenRate, type BudgetVerdict } from "./budget";
import { articlesInForce, buildSystem, parseAgentConfig, type AgentConfig, type ExampleInput, type KnowledgeArticleInput } from "./prompt";
import {
  addUsage,
  emptyUsage,
  DEFAULT_MODEL_ID,
  type CompletionUsage,
  type LlmProvider,
  type ProviderContentBlock,
  type ProviderMessage,
} from "./provider";
import { anthropicProvider } from "./providers/anthropic";
import { toolDefinitionsFor } from "./tool-definitions";
import { emptySandboxState, type SandboxState } from "./sandbox";
import { liveToolExecutor, sandboxToolExecutor, type ToolExecutor, type ToolOutcome } from "./tools";

/**
 * Un turno del agente (SPEC-058 BR-009 a BR-013).
 *
 * Arma el historial, llama al proveedor, ejecuta las herramientas que pida el
 * modelo y vuelve a llamarlo hasta que responda (máximo seis vueltas). Guarda
 * un `AiTurn` inmutable con modo, modelo, tokens, costo, herramientas,
 * artículos consultados y motivo de parada.
 *
 * En `LIVE` las herramientas tocan datos reales; en `SIMULATOR` y `TEST`
 * operan sobre un contexto ficticio en memoria (salvo consultar planes y
 * horarios, que sí leen). Nunca se envía nada a WhatsApp desde aquí: eso lo
 * hace el suscriptor con `enqueueOutboundMessage`.
 */

export type AgentMode = "LIVE" | "SIMULATOR" | "TEST";

/** Vueltas máximas del bucle de herramientas: pasado eso, el turno se cierra. */
export const MAX_TOOL_ITERATIONS = 6;

/** Mensajes previos de la conversación que se le muestran al modelo en LIVE. */
export const LIVE_HISTORY_MESSAGES = 30;

export interface SimulationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface RunAgentTurnInput {
  organizationId: string;
  agentId: string;
  /** Versión publicada con la que responder. Sin ella y con `draft`, se usa el borrador. */
  versionId?: string | null;
  draft?: boolean;
  conversationId?: string | null;
  /** Historial en memoria para simulador y pruebas. */
  simulation?: { history: SimulationTurn[]; state?: SandboxState };
  incomingText: string;
  mode: AgentMode;
  /** Ejecutor propio; si no viene, se arma según el modo. */
  toolExecutor?: ToolExecutor;
  /** Proveedor propio; en las pruebas se inyecta uno falso. */
  provider?: LlmProvider;
  now?: Date;
}

export interface ExecutedToolCall {
  name: string;
  input: Record<string, unknown>;
  result: string;
  isError: boolean;
}

export interface AgentTurnResult {
  text: string;
  toolCalls: ExecutedToolCall[];
  handoff: boolean;
  handoffReason: string | null;
  /** El tope mensual impidió responder. */
  blocked: boolean;
  costUsd: number;
  usage: CompletionUsage;
  stopReason: string;
  modelId: string;
  versionId: string | null;
  articlesUsed: string[];
  turnId: string | null;
  budget: BudgetVerdict;
}

export class AgentRuntimeError extends Error {}

// ───────────────────────── Origen de la configuración ─────────────────────────

interface ResolvedSource {
  versionId: string | null;
  modelId: string;
  effort: "low" | "medium" | "high";
  config: AgentConfig;
  tools: string[];
  articles: KnowledgeArticleInput[];
  examples: ExampleInput[];
}

function normalizeEffort(value: string): "low" | "medium" | "high" {
  return value === "medium" || value === "high" ? value : "low";
}

function parseSnapshot(value: unknown): { articles: KnowledgeArticleInput[]; examples: ExampleInput[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { articles: [], examples: [] };
  const raw = value as { articles?: unknown; examples?: unknown };
  const articles = Array.isArray(raw.articles)
    ? raw.articles.flatMap((item): KnowledgeArticleInput[] => {
        if (!item || typeof item !== "object") return [];
        const article = item as Record<string, unknown>;
        if (typeof article.id !== "string" || typeof article.title !== "string" || typeof article.content !== "string") return [];
        return [
          {
            id: article.id,
            title: article.title,
            content: article.content,
            validFrom: typeof article.validFrom === "string" ? article.validFrom : new Date(0).toISOString(),
            validUntil: typeof article.validUntil === "string" ? article.validUntil : null,
          },
        ];
      })
    : [];
  const examples = Array.isArray(raw.examples)
    ? raw.examples.flatMap((item): ExampleInput[] => {
        if (!item || typeof item !== "object") return [];
        const example = item as Record<string, unknown>;
        if (typeof example.id !== "string" || typeof example.kind !== "string") return [];
        return [{ id: example.id, kind: example.kind, turns: parseTurns(example.turns), note: typeof example.note === "string" ? example.note : null }];
      })
    : [];
  return { articles, examples };
}

export function parseTurns(value: unknown): SimulationTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SimulationTurn[] => {
    if (!item || typeof item !== "object") return [];
    const turn = item as Record<string, unknown>;
    const text = typeof turn.text === "string" ? turn.text : null;
    if (!text) return [];
    return [{ role: turn.role === "assistant" ? "assistant" : "user", text }];
  });
}

async function resolveSource(input: RunAgentTurnInput, agent: { id: string; modelId: string; effort: string; draftConfig: unknown; draftTools: string[]; publishedVersionId: string | null }): Promise<ResolvedSource> {
  const wantsDraft = input.draft === true || (!input.versionId && input.mode !== "LIVE");
  if (!wantsDraft) {
    const versionId = input.versionId ?? agent.publishedVersionId;
    if (!versionId) throw new AgentRuntimeError("El agente no tiene una versión publicada.");
    const version = await database.aiAgentVersion.findFirst({ where: { id: versionId, agentId: agent.id } });
    if (!version) throw new AgentRuntimeError("Esa versión del agente no existe.");
    const snapshot = parseSnapshot(version.knowledgeSnapshot);
    return {
      versionId: version.id,
      modelId: version.modelId || DEFAULT_MODEL_ID,
      effort: normalizeEffort(version.effort),
      config: parseAgentConfig(version.config),
      tools: version.tools,
      articles: snapshot.articles,
      examples: snapshot.examples,
    };
  }
  const [articles, examples] = await Promise.all([
    database.knowledgeArticle.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: "asc" } }),
    database.aiAgentExample.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    versionId: null,
    modelId: agent.modelId || DEFAULT_MODEL_ID,
    effort: normalizeEffort(agent.effort),
    config: parseAgentConfig(agent.draftConfig),
    tools: agent.draftTools,
    articles: articles.map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      validFrom: article.validFrom,
      validUntil: article.validUntil,
    })),
    examples: examples.map((example) => ({ id: example.id, kind: example.kind, turns: parseTurns(example.turns), note: example.note })),
  };
}

// ───────────────────────── Historial ─────────────────────────

const MEDIA_LABELS: Record<string, string> = {
  image: "[el cliente envió una imagen]",
  audio: "[el cliente envió un audio]",
  video: "[el cliente envió un video]",
  document: "[el cliente envió un documento]",
  sticker: "[el cliente envió un sticker]",
  location: "[el cliente compartió su ubicación]",
  contacts: "[el cliente compartió un contacto]",
};

function bodyOf(message: { type: string; body: string | null; direction: string }): string {
  const body = message.body?.trim();
  if (body) return body;
  if (message.direction === "INBOUND") return MEDIA_LABELS[message.type] ?? "[el cliente envió un archivo que no se puede leer]";
  return "[mensaje sin texto]";
}

async function liveHistory(organizationId: string, conversationId: string, incomingText: string): Promise<ProviderMessage[]> {
  const rows = await database.message.findMany({
    where: { conversationId, organizationId, status: { notIn: ["CANCELLED", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: LIVE_HISTORY_MESSAGES,
    select: { direction: true, type: true, body: true, createdAt: true },
  });
  const ordered = rows.reverse();
  const turns: SimulationTurn[] = ordered.map((message) => ({
    role: message.direction === "INBOUND" ? "user" : "assistant",
    text: bodyOf(message),
  }));
  const last = turns[turns.length - 1];
  // El mensaje que dispara el turno ya está guardado: no se repite.
  if (!last || last.role !== "user" || last.text !== incomingText.trim()) {
    turns.push({ role: "user", text: incomingText.trim() });
  }
  return toMessages(turns);
}

/** Convierte turnos de texto en mensajes del proveedor. El primero siempre es del cliente. */
export function toMessages(turns: readonly SimulationTurn[]): ProviderMessage[] {
  const trimmed = [...turns];
  while (trimmed.length && trimmed[0]?.role === "assistant") trimmed.shift();
  return trimmed
    .filter((turn) => turn.text.trim().length > 0)
    .map((turn) => ({ role: turn.role, content: [{ type: "text" as const, text: turn.text.trim() }] }));
}

// ───────────────────────── Presupuesto ─────────────────────────

/** Costo del agente en el mes en curso (hora de Lima), en dólares. */
export async function monthlySpendUsd(agentId: string, timeZone: string, now = new Date()): Promise<number> {
  const from = monthStartUtc(now, timeZone);
  const aggregate = await database.aiTurn.aggregate({
    where: { agentId, createdAt: { gte: from } },
    _sum: { costUsd: true },
  });
  return Number(aggregate._sum.costUsd ?? 0);
}

export async function agentBudget(agent: { id: string; monthlyBudgetPen: unknown }, timeZone: string, now = new Date()): Promise<BudgetVerdict> {
  const spentUsd = await monthlySpendUsd(agent.id, timeZone, now);
  const limit = agent.monthlyBudgetPen === null || agent.monthlyBudgetPen === undefined ? null : Number(agent.monthlyBudgetPen);
  return budgetVerdict({ spentUsd, monthlyBudgetPen: limit, usdToPen: usdToPenRate() });
}

// ───────────────────────── El turno ─────────────────────────

export async function runAgentTurn(input: RunAgentTurnInput): Promise<AgentTurnResult> {
  const now = input.now ?? new Date();
  const agent = await database.aiAgent.findFirst({
    where: { id: input.agentId, organizationId: input.organizationId },
    select: {
      id: true,
      organizationId: true,
      modelId: true,
      effort: true,
      draftConfig: true,
      draftTools: true,
      publishedVersionId: true,
      monthlyBudgetPen: true,
      organization: { select: { name: true, timezone: true } },
    },
  });
  if (!agent) throw new AgentRuntimeError("El agente no existe o no pertenece a tu empresa.");
  const timezone = agent.organization.timezone;

  const budget = await agentBudget(agent, timezone, now);
  if (!budget.canRespond) {
    if (input.mode === "LIVE" && input.conversationId) {
      await setResponderState({ conversationId: input.conversationId, state: "REQUIERE_ASESOR", reason: BUDGET_EXHAUSTED_REASON });
      return blockedResult(budget);
    }
    throw new AgentRuntimeError("Se alcanzó el tope mensual del asistente: no puede responder hasta el próximo mes o hasta que se suba el tope.");
  }

  const source = await resolveSource(input, agent);
  const built = buildSystem({
    config: source.config,
    articles: source.articles,
    examples: source.examples,
    now,
    organizationName: agent.organization.name,
  });
  const tools = toolDefinitionsFor(source.tools);

  let conversation: { id: string; contactId: string } | null = null;
  if (input.mode === "LIVE") {
    if (!input.conversationId) throw new AgentRuntimeError("Un turno en vivo necesita la conversación.");
    conversation = await database.conversation.findFirst({
      where: { id: input.conversationId, organizationId: agent.organizationId },
      select: { id: true, contactId: true },
    });
    if (!conversation) throw new AgentRuntimeError("La conversación no existe o no pertenece a tu empresa.");
  }

  const executor =
    input.toolExecutor ??
    (conversation
      ? liveToolExecutor({
          organizationId: agent.organizationId,
          conversationId: conversation.id,
          contactId: conversation.contactId,
          timezone,
          allowedTags: source.config.allowedTags,
          enabled: source.tools,
        })
      : sandboxToolExecutor({
          organizationId: agent.organizationId,
          timezone,
          allowedTags: source.config.allowedTags,
          state: input.simulation?.state ?? emptySandboxState(),
        }));

  const messages: ProviderMessage[] = conversation
    ? await liveHistory(agent.organizationId, conversation.id, input.incomingText)
    : toMessages([...(input.simulation?.history ?? []), { role: "user", text: input.incomingText }]);
  if (!messages.length) throw new AgentRuntimeError("No hay nada que responder.");

  const provider = input.provider ?? anthropicProvider();
  const executed: ExecutedToolCall[] = [];
  let usage = emptyUsage();
  let costUsd = 0;
  let text = "";
  let stopReason = "end_turn";
  let handoff = false;
  let handoffReason: string | null = null;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const completion = await provider.complete({
      model: source.modelId,
      effort: source.effort,
      system: built.blocks,
      messages,
      tools,
    });
    usage = addUsage(usage, completion.usage);
    costUsd += completion.costUsd;
    stopReason = completion.stopReason;
    if (completion.text) text = completion.text;

    // Una negativa del proveedor se trata como «derivar a asesor», nunca como respuesta.
    if (completion.stopReason === "refusal") {
      handoff = true;
      handoffReason = "el proveedor no pudo responder este mensaje";
      text = "";
      break;
    }

    if (completion.stopReason !== "tool_use" || completion.toolCalls.length === 0) break;

    messages.push({ role: "assistant", content: completion.assistantContent });
    const results: ProviderContentBlock[] = [];
    for (const call of completion.toolCalls) {
      let outcome: ToolOutcome;
      try {
        outcome = await executor.run(call);
      } catch (error) {
        outcome = { content: error instanceof Error ? error.message : "La herramienta falló.", isError: true };
      }
      executed.push({ name: call.name, input: call.input, result: outcome.content, isError: Boolean(outcome.isError) });
      if (outcome.handoff) {
        handoff = true;
        handoffReason = outcome.handoffReason ?? "lo derivó el asistente virtual";
      }
      results.push({ type: "tool_result", toolUseId: call.id, content: outcome.content, isError: outcome.isError });
    }
    // Todos los resultados vuelven en un solo mensaje del cliente.
    messages.push({ role: "user", content: results });
  }

  if (handoff && !text) {
    text = source.config.handoffMessage || "Te paso con un asesor para que te ayude. En un momento te escribe.";
  }

  // Si el proveedor se negó, la conversación no se queda con el asistente.
  if (handoff && input.mode === "LIVE" && conversation && !executed.some((call) => call.name === "pasar_a_asesor")) {
    await database.conversationEvent.create({
      data: { conversationId: conversation.id, type: "AI_HANDOFF", detail: { summary: text, reason: handoffReason } },
    });
    await setResponderState({ conversationId: conversation.id, state: "REQUIERE_ASESOR", reason: handoffReason ?? "lo derivó el asistente virtual" });
  }

  const turn = await database.aiTurn.create({
    data: {
      agentId: agent.id,
      versionId: source.versionId,
      conversationId: conversation?.id ?? null,
      mode: input.mode,
      modelId: source.modelId,
      inputTokens: usage.input,
      outputTokens: usage.output,
      cacheReadTokens: usage.cacheRead,
      costUsd,
      toolCalls: executed as unknown as Prisma.InputJsonValue,
      articlesUsed: built.articleIds,
      stopReason,
      responseText: text || null,
    },
    select: { id: true },
  });

  return {
    text,
    toolCalls: executed,
    handoff,
    handoffReason,
    blocked: false,
    costUsd,
    usage,
    stopReason,
    modelId: source.modelId,
    versionId: source.versionId,
    articlesUsed: built.articleIds,
    turnId: turn.id,
    budget,
  };
}

function blockedResult(budget: BudgetVerdict): AgentTurnResult {
  return {
    text: "",
    toolCalls: [],
    handoff: true,
    handoffReason: BUDGET_EXHAUSTED_REASON,
    blocked: true,
    costUsd: 0,
    usage: emptyUsage(),
    stopReason: "budget",
    modelId: "",
    versionId: null,
    articlesUsed: [],
    turnId: null,
    budget,
  };
}

/** Reexportado para las pantallas: qué artículos estaban vigentes en un momento dado. */
export { articlesInForce };
