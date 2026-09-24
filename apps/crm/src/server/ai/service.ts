import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { OrganizationRole } from "@/generated/prisma/enums";

import { audit } from "../audit";
import { database } from "../database";

import { anonymizeTurns, type AnonymizableTurn } from "./anonymize";
import { monthStartUtc } from "./budget";
import { agentBudget, monthlySpendUsd, parseTurns, runAgentTurn, type AgentTurnResult, type SimulationTurn } from "./runtime";
import { articlesInForce, parseAgentConfig, parseSchedule, type AgentConfig, type ScheduleMode } from "./prompt";
import { evaluateExpectations, parseExpectations, type TestSummary } from "./expectations";
import { DEFAULT_MODEL_ID, FALLBACK_MODELS, MissingProviderKeyError, type LlmProvider, type ModelOption } from "./provider";
import { anthropicProvider, providerConfigured } from "./providers/anthropic";
import { DEFAULT_TOOLS, isToolName, TOOL_NAMES } from "./tool-definitions";
import { emptySandboxState } from "./sandbox";

/**
 * Entrenar, probar y publicar el agente (SPEC-058 BR-006, BR-016 a BR-019).
 *
 * Todo entra por `organizationId`: ni un agente, ni un artículo, ni un turno
 * se toca sin comprobar que es de la empresa de quien lo pide. Publicar es lo
 * único que congela: la versión guarda configuración, herramientas, artículos
 * vigentes, ejemplos y el resultado de las pruebas de ese momento.
 */

export { evaluateExpectations, anonymizeTurns };
export type { TestSummary };

export class AgentServiceError extends Error {}

const DEFAULT_CONFIG: AgentConfig = {
  displayName: "",
  objective: "",
  tone: "",
  must: [],
  never: [],
  dataToCollect: [],
  allowedTags: [],
  handoffMessage: "",
};

// ───────────────────────── Lecturas para las pantallas ─────────────────────────

export interface AgentListItem {
  id: string;
  name: string;
  status: string;
  modelId: string;
  publishedVersionNumber: number | null;
  monthCostUsd: number;
  monthCostPen: number;
  budgetState: string;
}

export async function listAgents(organizationId: string, timezone: string): Promise<AgentListItem[]> {
  const agents = await database.aiAgent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, status: true, modelId: true, publishedVersionId: true, monthlyBudgetPen: true },
  });
  const now = new Date();
  return Promise.all(
    agents.map(async (agent) => {
      const [budget, version] = await Promise.all([
        agentBudget(agent, timezone, now),
        agent.publishedVersionId
          ? database.aiAgentVersion.findUnique({ where: { id: agent.publishedVersionId }, select: { versionNumber: true } })
          : Promise.resolve(null),
      ]);
      return {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        modelId: agent.modelId,
        publishedVersionNumber: version?.versionNumber ?? null,
        monthCostUsd: budget.spentUsd,
        monthCostPen: budget.spentPen,
        budgetState: budget.state,
      };
    }),
  );
}

export async function getAgent(organizationId: string, agentId: string) {
  const agent = await database.aiAgent.findFirst({ where: { id: agentId, organizationId } });
  if (!agent) throw new AgentServiceError("Ese agente no existe o no pertenece a tu empresa.");
  return agent;
}

export interface AgentDetail {
  id: string;
  name: string;
  status: string;
  modelId: string;
  effort: string;
  config: AgentConfig;
  tools: string[];
  schedule: { mode: ScheduleMode };
  monthlyBudgetPen: number | null;
  publishedVersionId: string | null;
  publishedVersionNumber: number | null;
  updatedAt: Date;
}

export async function getAgentDetail(organizationId: string, agentId: string): Promise<AgentDetail> {
  const agent = await getAgent(organizationId, agentId);
  const version = agent.publishedVersionId
    ? await database.aiAgentVersion.findUnique({ where: { id: agent.publishedVersionId }, select: { versionNumber: true } })
    : null;
  return {
    id: agent.id,
    name: agent.name,
    status: agent.status,
    modelId: agent.modelId,
    effort: agent.effort,
    config: parseAgentConfig(agent.draftConfig),
    tools: agent.draftTools,
    schedule: parseSchedule(agent.schedule),
    monthlyBudgetPen: agent.monthlyBudgetPen === null ? null : Number(agent.monthlyBudgetPen),
    publishedVersionId: agent.publishedVersionId,
    publishedVersionNumber: version?.versionNumber ?? null,
    updatedAt: agent.updatedAt,
  };
}

/** Modelos disponibles. Sin clave configurada devuelve los tres conocidos y avisa. */
export async function listModelOptions(): Promise<{ options: ModelOption[]; configured: boolean; problem: string | null }> {
  if (!providerConfigured()) {
    return {
      options: FALLBACK_MODELS,
      configured: false,
      problem: "Falta ANTHROPIC_API_KEY: no se puede consultar la lista de modelos ni hacer responder al asistente.",
    };
  }
  try {
    const options = await anthropicProvider().listModels();
    return { options: options.length ? options : FALLBACK_MODELS, configured: true, problem: null };
  } catch (error) {
    return { options: FALLBACK_MODELS, configured: false, problem: error instanceof Error ? error.message : "No se pudo consultar los modelos." };
  }
}

// ───────────────────────── Crear y guardar el borrador ─────────────────────────

export async function createAgent(input: { organizationId: string; name: string; actorUserId: string }) {
  const name = input.name.trim();
  if (!name) throw new AgentServiceError("El agente necesita un nombre.");
  const agent = await database.aiAgent.create({
    data: {
      organizationId: input.organizationId,
      name,
      status: "DRAFT",
      provider: "ANTHROPIC",
      modelId: DEFAULT_MODEL_ID,
      effort: "low",
      draftConfig: { ...DEFAULT_CONFIG, displayName: name } as unknown as Prisma.InputJsonValue,
      draftTools: DEFAULT_TOOLS,
      schedule: { mode: "WHEN_NO_ADVISOR" },
    },
  });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "ai.agent.created",
    targetKind: "ai_agent",
    targetId: agent.id,
  });
  return agent;
}

export interface SaveDraftInput {
  organizationId: string;
  agentId: string;
  actorUserId: string;
  name?: string;
  modelId?: string;
  effort?: string;
  config?: Partial<AgentConfig>;
  tools?: string[];
  scheduleMode?: ScheduleMode;
  monthlyBudgetPen?: number | null;
}

/** Guarda el borrador. La versión publicada no cambia hasta publicar (BR-006). */
export async function saveDraft(input: SaveDraftInput) {
  const agent = await getAgent(input.organizationId, input.agentId);
  const current = parseAgentConfig(agent.draftConfig);
  const config: AgentConfig = { ...current, ...(input.config ?? {}) };
  const tools = input.tools ? input.tools.filter(isToolName) : agent.draftTools;
  const effort = input.effort === "medium" || input.effort === "high" ? input.effort : input.effort === "low" ? "low" : agent.effort;
  await database.aiAgent.update({
    where: { id: agent.id },
    data: {
      name: input.name?.trim() || agent.name,
      modelId: input.modelId?.trim() || agent.modelId,
      effort,
      draftConfig: config as unknown as Prisma.InputJsonValue,
      draftTools: tools,
      ...(input.scheduleMode ? { schedule: { mode: input.scheduleMode } } : {}),
      ...(input.monthlyBudgetPen !== undefined ? { monthlyBudgetPen: input.monthlyBudgetPen } : {}),
    },
  });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "ai.agent.draft.saved",
    targetKind: "ai_agent",
    targetId: agent.id,
  });
}

// ───────────────────────── Conocimiento ─────────────────────────

/** Un artículo con montos se desactualiza solo: los precios viven en el catálogo (BR-004). */
export function knowledgeMentionsMoney(content: string): boolean {
  return /S\/|soles/i.test(content);
}

export async function saveArticle(input: {
  organizationId: string;
  agentId: string;
  articleId?: string | null;
  title: string;
  content: string;
  validFrom: Date;
  validUntil: Date | null;
  actorUserId: string;
}) {
  await getAgent(input.organizationId, input.agentId);
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new AgentServiceError("El artículo necesita un título.");
  if (!content) throw new AgentServiceError("El artículo necesita contenido.");
  const data = { title, content, validFrom: input.validFrom, validUntil: input.validUntil };
  if (input.articleId) {
    const updated = await database.knowledgeArticle.updateMany({
      where: { id: input.articleId, agentId: input.agentId, organizationId: input.organizationId },
      data,
    });
    if (updated.count === 0) throw new AgentServiceError("Ese artículo no existe en este agente.");
  } else {
    await database.knowledgeArticle.create({ data: { ...data, agentId: input.agentId, organizationId: input.organizationId } });
  }
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "ai.knowledge.saved",
    targetKind: "ai_agent",
    targetId: input.agentId,
    detail: { title },
  });
}

export async function retireArticle(input: { organizationId: string; agentId: string; articleId: string; actorUserId: string }) {
  const updated = await database.knowledgeArticle.updateMany({
    where: { id: input.articleId, agentId: input.agentId, organizationId: input.organizationId },
    data: { validUntil: new Date() },
  });
  if (updated.count === 0) throw new AgentServiceError("Ese artículo no existe en este agente.");
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "ai.knowledge.retired",
    targetKind: "ai_agent",
    targetId: input.agentId,
    detail: { articleId: input.articleId },
  });
}

export async function listArticles(organizationId: string, agentId: string) {
  await getAgent(organizationId, agentId);
  const articles = await database.knowledgeArticle.findMany({ where: { agentId, organizationId }, orderBy: { createdAt: "desc" } });
  const inForceIds = new Set(articlesInForce(articles, new Date()).map((article) => article.id));
  return articles.map((article) => ({ ...article, inForce: inForceIds.has(article.id) }));
}

// ───────────────────────── Ejemplos ─────────────────────────

export async function listExamples(organizationId: string, agentId: string) {
  await getAgent(organizationId, agentId);
  const examples = await database.aiAgentExample.findMany({ where: { agentId }, orderBy: { createdAt: "desc" } });
  return examples.map((example) => ({ ...example, parsedTurns: parseTurns(example.turns) }));
}

export async function deleteExample(input: { organizationId: string; agentId: string; exampleId: string; actorUserId: string }) {
  await getAgent(input.organizationId, input.agentId);
  const deleted = await database.aiAgentExample.deleteMany({ where: { id: input.exampleId, agentId: input.agentId } });
  if (deleted.count === 0) throw new AgentServiceError("Ese ejemplo no existe en este agente.");
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "ai.example.deleted",
    targetKind: "ai_agent",
    targetId: input.agentId,
  });
}

/**
 * Toma un tramo de una conversación real y lo guarda como ejemplo con los
 * datos personales reemplazados (BR-005, AC-010). Los dos mensajes tienen que
 * ser de la misma conversación de la empresa.
 */
export async function addExampleFromConversation(input: {
  organizationId: string;
  agentId: string;
  conversationId: string;
  fromMessageId: string;
  toMessageId: string;
  kind: "GOOD" | "BAD";
  note?: string | null;
  actorUserId: string;
}) {
  await getAgent(input.organizationId, input.agentId);
  const conversation = await database.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId },
    select: { id: true, contact: { select: { displayName: true } } },
  });
  if (!conversation) throw new AgentServiceError("Esa conversación no existe o no pertenece a tu empresa.");
  const bounds = await database.message.findMany({
    where: { id: { in: [input.fromMessageId, input.toMessageId] }, conversationId: conversation.id },
    select: { id: true, createdAt: true },
  });
  if (bounds.length !== 2 && input.fromMessageId !== input.toMessageId) {
    throw new AgentServiceError("Los mensajes elegidos no son de esa conversación.");
  }
  if (!bounds.length) throw new AgentServiceError("Los mensajes elegidos no son de esa conversación.");
  const times = bounds.map((message) => message.createdAt.getTime());
  const from = new Date(Math.min(...times));
  const to = new Date(Math.max(...times));
  const messages = await database.message.findMany({
    where: { conversationId: conversation.id, createdAt: { gte: from, lte: to }, status: { notIn: ["CANCELLED", "FAILED"] } },
    orderBy: { createdAt: "asc" },
    select: { direction: true, body: true, type: true },
  });
  const turns: AnonymizableTurn[] = messages
    .map((message) => ({
      role: message.direction === "INBOUND" ? ("user" as const) : ("assistant" as const),
      text: message.body?.trim() || `[${message.type}]`,
    }))
    .filter((turn) => turn.text.length > 0);
  if (!turns.length) throw new AgentServiceError("Ese tramo no tiene mensajes con texto.");

  const example = await database.aiAgentExample.create({
    data: {
      agentId: input.agentId,
      kind: input.kind,
      turns: anonymizeTurns(turns, conversation.contact.displayName) as unknown as Prisma.InputJsonValue,
      note: input.note?.trim() || null,
    },
  });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "ai.example.added",
    targetKind: "ai_agent",
    targetId: input.agentId,
    detail: { conversationId: conversation.id, kind: input.kind },
  });
  return example;
}

// ───────────────────────── Casos de prueba ─────────────────────────

export async function listTestCases(organizationId: string, agentId: string) {
  await getAgent(organizationId, agentId);
  const cases = await database.aiTestCase.findMany({ where: { agentId }, orderBy: [{ critical: "desc" }, { createdAt: "asc" }] });
  return cases.map((testCase) => ({
    ...testCase,
    inputs: Array.isArray(testCase.inputTurns) ? (testCase.inputTurns as unknown[]).map(String) : [],
    expectations: parseExpectations(testCase.expectations),
  }));
}

export async function saveTestCase(input: {
  organizationId: string;
  agentId: string;
  testCaseId?: string | null;
  name: string;
  inputs: string[];
  expectations: unknown;
  critical: boolean;
  actorUserId: string;
}) {
  await getAgent(input.organizationId, input.agentId);
  const name = input.name.trim();
  const inputs = input.inputs.map((line) => line.trim()).filter(Boolean);
  if (!name) throw new AgentServiceError("El caso necesita un nombre.");
  if (!inputs.length) throw new AgentServiceError("El caso necesita al menos un mensaje del cliente.");
  const data = {
    name,
    inputTurns: inputs as unknown as Prisma.InputJsonValue,
    expectations: parseExpectations(input.expectations) as unknown as Prisma.InputJsonValue,
    critical: input.critical,
  };
  if (input.testCaseId) {
    const updated = await database.aiTestCase.updateMany({ where: { id: input.testCaseId, agentId: input.agentId }, data });
    if (updated.count === 0) throw new AgentServiceError("Ese caso no existe en este agente.");
  } else {
    await database.aiTestCase.create({ data: { ...data, agentId: input.agentId } });
  }
}

export async function deleteTestCase(input: { organizationId: string; agentId: string; testCaseId: string }) {
  await getAgent(input.organizationId, input.agentId);
  const deleted = await database.aiTestCase.deleteMany({ where: { id: input.testCaseId, agentId: input.agentId } });
  if (deleted.count === 0) throw new AgentServiceError("Ese caso no existe en este agente.");
}

/** Corre el conjunto de pruebas sobre el borrador y guarda el resultado (BR-016). */
export async function runTests(input: { organizationId: string; agentId: string; provider?: LlmProvider }): Promise<TestSummary> {
  const agent = await getAgent(input.organizationId, input.agentId);
  const cases = await database.aiTestCase.findMany({ where: { agentId: agent.id }, orderBy: [{ critical: "desc" }, { createdAt: "asc" }] });
  const runId = randomUUID();
  const summary: TestSummary = {
    runId,
    ranAt: new Date().toISOString(),
    total: cases.length,
    passed: 0,
    failed: 0,
    criticalFailed: 0,
    costUsd: 0,
    cases: [],
  };
  if (!cases.length) return summary;

  for (const testCase of cases) {
    const inputs = Array.isArray(testCase.inputTurns) ? (testCase.inputTurns as unknown[]).map(String).filter(Boolean) : [];
    const expectations = parseExpectations(testCase.expectations);
    const history: SimulationTurn[] = [];
    const state = emptySandboxState();
    const transcript: { role: string; text: string; toolCalls?: unknown }[] = [];
    const toolNames: string[] = [];
    let handoff = false;
    let answers = "";
    let costUsd = 0;
    let failure: string | null = null;

    for (const line of inputs) {
      let result: AgentTurnResult;
      try {
        result = await runAgentTurn({
          organizationId: input.organizationId,
          agentId: agent.id,
          draft: true,
          mode: "TEST",
          incomingText: line,
          simulation: { history, state },
          provider: input.provider,
        });
      } catch (error) {
        failure = error instanceof Error ? error.message : "El caso no se pudo correr.";
        break;
      }
      costUsd += result.costUsd;
      toolNames.push(...result.toolCalls.map((call) => call.name));
      handoff = handoff || result.handoff;
      answers += `${answers ? "\n" : ""}${result.text}`;
      transcript.push({ role: "user", text: line });
      transcript.push({ role: "assistant", text: result.text, toolCalls: result.toolCalls });
      history.push({ role: "user", text: line }, { role: "assistant", text: result.text });
      if (handoff) break;
    }

    const verdict = failure
      ? { passed: false, problems: [failure] }
      : evaluateExpectations({ text: answers, toolNames, handoff }, expectations);
    summary.costUsd += costUsd;
    if (verdict.passed) summary.passed += 1;
    else {
      summary.failed += 1;
      if (testCase.critical) summary.criticalFailed += 1;
    }
    summary.cases.push({ id: testCase.id, name: testCase.name, critical: testCase.critical, passed: verdict.passed, problems: verdict.problems });
    await database.aiTestResult.create({
      data: {
        testCaseId: testCase.id,
        runId,
        passed: verdict.passed,
        transcript: transcript as unknown as Prisma.InputJsonValue,
        detail: verdict.problems.join(" ") || null,
        costUsd,
      },
    });
  }
  summary.costUsd = Math.round(summary.costUsd * 1_000_000) / 1_000_000;
  return summary;
}

export async function lastTestRun(organizationId: string, agentId: string) {
  await getAgent(organizationId, agentId);
  const results = await database.aiTestResult.findMany({
    where: { testCase: { agentId } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { testCase: { select: { name: true, critical: true } } },
  });
  const latest = results[0];
  if (!latest) return null;
  return { runId: latest.runId, ranAt: latest.createdAt, results: results.filter((result) => result.runId === latest.runId) };
}

// ───────────────────────── Publicar y volver atrás ─────────────────────────

async function nextVersionNumber(agentId: string): Promise<number> {
  const last = await database.aiAgentVersion.findFirst({ where: { agentId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
  return (last?.versionNumber ?? 0) + 1;
}

async function snapshotOf(organizationId: string, agentId: string, now: Date): Promise<Prisma.InputJsonValue> {
  const [articles, examples] = await Promise.all([
    database.knowledgeArticle.findMany({ where: { agentId, organizationId }, orderBy: { createdAt: "asc" } }),
    database.aiAgentExample.findMany({ where: { agentId }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    articles: articlesInForce(articles, now).map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      validFrom: article.validFrom.toISOString(),
      validUntil: article.validUntil ? article.validUntil.toISOString() : null,
    })),
    examples: examples.map((example) => ({
      id: example.id,
      kind: example.kind,
      turns: parseTurns(example.turns),
      note: example.note,
    })),
  } as unknown as Prisma.InputJsonValue;
}

export interface PublishInput {
  organizationId: string;
  agentId: string;
  reason: string;
  actorUserId: string;
  actorRole: OrganizationRole;
  /** Publicar con una prueba crítica fallida: solo el dueño y con motivo. */
  force?: boolean;
  provider?: LlmProvider;
}

/** Publicar corre primero el conjunto de pruebas y guarda su resultado (BR-017). */
export async function publishVersion(input: PublishInput) {
  const agent = await getAgent(input.organizationId, input.agentId);
  const reason = input.reason.trim();
  if (!reason) throw new AgentServiceError("Escribe qué cambió en esta versión.");

  let summary: TestSummary;
  try {
    summary = await runTests({ organizationId: input.organizationId, agentId: agent.id, provider: input.provider });
  } catch (error) {
    if (error instanceof MissingProviderKeyError) throw new AgentServiceError(error.message);
    throw error;
  }
  if (summary.criticalFailed > 0) {
    if (!input.force) {
      throw new AgentServiceError(
        `Hay ${summary.criticalFailed} prueba(s) crítica(s) fallida(s). Corrígelas o pide al dueño que publique igual explicando por qué.`,
      );
    }
    if (input.actorRole !== "OWNER") {
      throw new AgentServiceError("Publicar con una prueba crítica fallida solo lo puede hacer el dueño del negocio.");
    }
  }

  const now = new Date();
  const version = await database.aiAgentVersion.create({
    data: {
      agentId: agent.id,
      versionNumber: await nextVersionNumber(agent.id),
      provider: agent.provider,
      modelId: agent.modelId,
      effort: agent.effort,
      config: agent.draftConfig === null ? {} : (agent.draftConfig as Prisma.InputJsonValue),
      tools: agent.draftTools,
      knowledgeSnapshot: await snapshotOf(input.organizationId, agent.id, now),
      testSummary: summary as unknown as Prisma.InputJsonValue,
      publishedByUserId: input.actorUserId,
      publishReason: summary.criticalFailed > 0 ? `${reason} (publicada con pruebas críticas fallidas)` : reason,
    },
  });
  await database.aiAgent.update({ where: { id: agent.id }, data: { publishedVersionId: version.id, status: "PUBLISHED" } });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "ai.agent.published",
    targetKind: "ai_agent",
    targetId: agent.id,
    detail: { versionId: version.id, versionNumber: version.versionNumber, reason, criticalFailed: summary.criticalFailed, forced: Boolean(input.force) },
  });
  return { version, summary };
}

/** Volver atrás crea una versión nueva con el contenido de la anterior (BR-019). */
export async function rollback(input: { organizationId: string; agentId: string; versionId: string; reason: string; actorUserId: string }) {
  const agent = await getAgent(input.organizationId, input.agentId);
  const reason = input.reason.trim();
  if (!reason) throw new AgentServiceError("Escribe por qué vuelves a esta versión.");
  const previous = await database.aiAgentVersion.findFirst({ where: { id: input.versionId, agentId: agent.id } });
  if (!previous) throw new AgentServiceError("Esa versión no existe en este agente.");
  const version = await database.aiAgentVersion.create({
    data: {
      agentId: agent.id,
      versionNumber: await nextVersionNumber(agent.id),
      provider: previous.provider,
      modelId: previous.modelId,
      effort: previous.effort,
      config: previous.config === null ? {} : (previous.config as Prisma.InputJsonValue),
      tools: previous.tools,
      knowledgeSnapshot: previous.knowledgeSnapshot === null ? {} : (previous.knowledgeSnapshot as Prisma.InputJsonValue),
      testSummary: previous.testSummary === null ? undefined : (previous.testSummary as Prisma.InputJsonValue),
      publishedByUserId: input.actorUserId,
      publishReason: `Vuelta a la versión ${previous.versionNumber}: ${reason}`,
    },
  });
  await database.aiAgent.update({
    where: { id: agent.id },
    data: { publishedVersionId: version.id, status: "PUBLISHED", modelId: previous.modelId, effort: previous.effort },
  });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "ai.agent.rollback",
    targetKind: "ai_agent",
    targetId: agent.id,
    detail: { from: previous.versionNumber, to: version.versionNumber, reason },
  });
  return version;
}

export async function listVersions(organizationId: string, agentId: string) {
  await getAgent(organizationId, agentId);
  return database.aiAgentVersion.findMany({
    where: { agentId },
    orderBy: { versionNumber: "desc" },
    select: { id: true, versionNumber: true, modelId: true, effort: true, publishedAt: true, publishReason: true, testSummary: true },
  });
}

export async function setAgentStatus(input: { organizationId: string; agentId: string; status: "PUBLISHED" | "PAUSED"; actorUserId: string }) {
  const agent = await getAgent(input.organizationId, input.agentId);
  if (input.status === "PUBLISHED" && !agent.publishedVersionId) {
    throw new AgentServiceError("Todavía no hay una versión publicada: publica una antes de activarlo.");
  }
  await database.aiAgent.update({ where: { id: agent.id }, data: { status: input.status } });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: `ai.agent.${input.status.toLowerCase()}`,
    targetKind: "ai_agent",
    targetId: agent.id,
  });
}

// ───────────────────────── Supervisión y métricas ─────────────────────────

/**
 * Marca una respuesta del agente como incorrecta (BR-014). La bandeja la
 * llamará desde el detalle del mensaje; hoy la usa la pantalla de métricas.
 */
export async function flagTurn(input: { organizationId: string; turnId: string; reason: string; actorUserId: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new AgentServiceError("Escribe qué estuvo mal en la respuesta.");
  const turn = await database.aiTurn.findFirst({
    where: { id: input.turnId, agent: { organizationId: input.organizationId } },
    select: { id: true, agentId: true },
  });
  if (!turn) throw new AgentServiceError("Esa respuesta no existe o no pertenece a tu empresa.");
  await database.aiTurn.update({ where: { id: turn.id }, data: { flaggedReason: reason.slice(0, 80) } });
  await audit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "ai.turn.flagged",
    targetKind: "ai_turn",
    targetId: turn.id,
    detail: { reason },
  });
}

export interface AgentMetrics {
  turnsByMode: { mode: string; turns: number; costUsd: number }[];
  liveCostUsd: number;
  totalCostUsd: number;
  handoffs: number;
  conversationsServed: number;
  qualifiedOpportunities: number;
  costPerQualifiedUsd: number | null;
  flagged: { id: string; reason: string; text: string | null; createdAt: Date }[];
}

/** Cifras del mes en curso (hora de la organización). */
export async function agentMetrics(organizationId: string, agentId: string, timezone: string, now = new Date()): Promise<AgentMetrics> {
  await getAgent(organizationId, agentId);
  const from = monthStartUtc(now, timezone);
  const turns = await database.aiTurn.findMany({
    where: { agentId, createdAt: { gte: from } },
    select: { id: true, mode: true, costUsd: true, conversationId: true, flaggedReason: true, responseText: true, createdAt: true, toolCalls: true },
  });

  const byMode = new Map<string, { turns: number; costUsd: number }>();
  let liveCostUsd = 0;
  let totalCostUsd = 0;
  let handoffs = 0;
  const conversations = new Set<string>();
  for (const turn of turns) {
    const cost = Number(turn.costUsd);
    totalCostUsd += cost;
    const bucket = byMode.get(turn.mode) ?? { turns: 0, costUsd: 0 };
    bucket.turns += 1;
    bucket.costUsd += cost;
    byMode.set(turn.mode, bucket);
    if (turn.mode === "LIVE") {
      liveCostUsd += cost;
      if (turn.conversationId) conversations.add(turn.conversationId);
    }
    if (Array.isArray(turn.toolCalls) && (turn.toolCalls as unknown[]).some((call) => (call as { name?: string })?.name === "pasar_a_asesor")) {
      handoffs += 1;
    }
  }

  const qualifiedOpportunities = conversations.size
    ? await database.opportunity.count({
        where: {
          organizationId,
          conversationId: { in: [...conversations] },
          stage: { in: ["CALIFICADO", "PROPUESTA", "EN_CIERRE", "GANADA"] },
        },
      })
    : 0;

  return {
    turnsByMode: [...byMode.entries()].map(([mode, value]) => ({ mode, turns: value.turns, costUsd: value.costUsd })),
    liveCostUsd,
    totalCostUsd,
    handoffs,
    conversationsServed: conversations.size,
    qualifiedOpportunities,
    costPerQualifiedUsd: qualifiedOpportunities > 0 ? liveCostUsd / qualifiedOpportunities : null,
    flagged: turns
      .filter((turn) => turn.flaggedReason)
      .map((turn) => ({ id: turn.id, reason: turn.flaggedReason as string, text: turn.responseText, createdAt: turn.createdAt })),
  };
}

export { monthlySpendUsd, TOOL_NAMES };
