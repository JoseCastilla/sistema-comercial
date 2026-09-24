"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireManager } from "@/server/auth/access";
import { checkbox, decimal, failure, optionalText, text, type ActionState } from "@/server/forms";
import { scheduleModes, type ScheduleMode } from "@/server/ai/prompt";
import {
  addExampleFromConversation,
  createAgent,
  deleteExample,
  deleteTestCase,
  flagTurn,
  publishVersion,
  retireArticle,
  rollback,
  runTests,
  saveArticle,
  saveDraft,
  saveTestCase,
  setAgentStatus,
} from "@/server/ai/service";
import { runAgentTurn, type SimulationTurn } from "@/server/ai/runtime";
import { emptySandboxState, type SandboxState, type SimulationResult } from "@/server/ai/sandbox";

/**
 * Acciones de la pantalla de agentes. Entrenan y publican el asistente
 * (SPEC-058). Todas pasan por `requireManager`: entrenan el dueño y los
 * supervisores; publicar con una prueba crítica fallida lo comprueba el
 * servicio, que solo se lo permite al dueño.
 */

/** Una línea por elemento: así se escriben las listas en los formularios. */
function lines(formData: FormData, name: string): string[] {
  return text(formData, name)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function agentPath(agentId: string, tab: string): string {
  return `/agents/${agentId}?tab=${tab}`;
}

export async function createAgentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let target: string;
  try {
    const access = await requireManager();
    const agent = await createAgent({ organizationId: access.organizationId, name: text(formData, "name"), actorUserId: access.userId });
    revalidatePath("/agents");
    target = agentPath(agent.id, "configuracion");
  } catch (error) {
    return failure(error);
  }
  redirect(target);
}

export async function saveConfigAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    const mode = text(formData, "scheduleMode");
    await saveDraft({
      organizationId: access.organizationId,
      agentId,
      actorUserId: access.userId,
      name: optionalText(formData, "name") ?? undefined,
      modelId: optionalText(formData, "modelId") ?? undefined,
      effort: optionalText(formData, "effort") ?? undefined,
      scheduleMode: (scheduleModes as readonly string[]).includes(mode) ? (mode as ScheduleMode) : undefined,
      monthlyBudgetPen: decimal(formData, "monthlyBudgetPen"),
      config: {
        displayName: text(formData, "displayName"),
        objective: text(formData, "objective"),
        tone: text(formData, "tone"),
        must: lines(formData, "must"),
        never: lines(formData, "never"),
        dataToCollect: lines(formData, "dataToCollect"),
        allowedTags: lines(formData, "allowedTags"),
        handoffMessage: text(formData, "handoffMessage"),
      },
    });
    revalidatePath(agentPath(agentId, "configuracion"));
    revalidatePath("/agents");
    return { ok: true, message: "Guardado en el borrador. Publica para que el asistente lo use." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveToolsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    await saveDraft({
      organizationId: access.organizationId,
      agentId,
      actorUserId: access.userId,
      tools: formData.getAll("tools").map(String),
    });
    revalidatePath(agentPath(agentId, "herramientas"));
    return { ok: true, message: "Herramientas guardadas en el borrador." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveArticleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    const validFrom = optionalText(formData, "validFrom");
    const validUntil = optionalText(formData, "validUntil");
    await saveArticle({
      organizationId: access.organizationId,
      agentId,
      articleId: optionalText(formData, "articleId"),
      title: text(formData, "title"),
      content: text(formData, "content"),
      validFrom: validFrom ? new Date(`${validFrom}T00:00:00-05:00`) : new Date(),
      validUntil: validUntil ? new Date(`${validUntil}T23:59:59-05:00`) : null,
      actorUserId: access.userId,
    });
    revalidatePath(agentPath(agentId, "conocimiento"));
    return { ok: true, message: "Artículo guardado." };
  } catch (error) {
    return failure(error);
  }
}

export async function retireArticleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    await retireArticle({ organizationId: access.organizationId, agentId, articleId: text(formData, "articleId"), actorUserId: access.userId });
    revalidatePath(agentPath(agentId, "conocimiento"));
    return { ok: true, message: "El artículo deja de usarse desde ahora." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteExampleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    await deleteExample({ organizationId: access.organizationId, agentId, exampleId: text(formData, "exampleId"), actorUserId: access.userId });
    revalidatePath(agentPath(agentId, "ejemplos"));
    return { ok: true, message: "Ejemplo quitado." };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Guarda un tramo de una conversación real como ejemplo. La bandeja todavía no
 * tiene el botón que llama a esta acción: hasta que lo tenga, se usa pegando
 * los identificadores de la conversación y de los dos mensajes del tramo.
 */
export async function addExampleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    const fromMessageId = text(formData, "fromMessageId");
    await addExampleFromConversation({
      organizationId: access.organizationId,
      agentId,
      conversationId: text(formData, "conversationId"),
      fromMessageId,
      toMessageId: optionalText(formData, "toMessageId") ?? fromMessageId,
      kind: text(formData, "kind") === "BAD" ? "BAD" : "GOOD",
      note: optionalText(formData, "note"),
      actorUserId: access.userId,
    });
    revalidatePath(agentPath(agentId, "ejemplos"));
    return { ok: true, message: "Ejemplo guardado con los datos personales reemplazados." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveTestCaseAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    await saveTestCase({
      organizationId: access.organizationId,
      agentId,
      testCaseId: optionalText(formData, "testCaseId"),
      name: text(formData, "name"),
      inputs: lines(formData, "inputs"),
      expectations: {
        mustCallTool: optionalText(formData, "mustCallTool") ?? undefined,
        mustNotCallTool: optionalText(formData, "mustNotCallTool") ?? undefined,
        mustContain: lines(formData, "mustContain"),
        mustNotContain: lines(formData, "mustNotContain"),
        mustHandoff: text(formData, "mustHandoff") === "SI" ? true : text(formData, "mustHandoff") === "NO" ? false : undefined,
      },
      critical: checkbox(formData, "critical"),
      actorUserId: access.userId,
    });
    revalidatePath(agentPath(agentId, "pruebas"));
    return { ok: true, message: "Caso guardado." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTestCaseAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    await deleteTestCase({ organizationId: access.organizationId, agentId, testCaseId: text(formData, "testCaseId") });
    revalidatePath(agentPath(agentId, "pruebas"));
    return { ok: true, message: "Caso quitado." };
  } catch (error) {
    return failure(error);
  }
}

export async function runTestsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    const summary = await runTests({ organizationId: access.organizationId, agentId });
    revalidatePath(agentPath(agentId, "pruebas"));
    if (summary.total === 0) return { ok: true, message: "No hay casos que correr todavía." };
    return {
      ok: true,
      message: `${summary.passed} de ${summary.total} pruebas pasaron${summary.criticalFailed ? `, ${summary.criticalFailed} crítica(s) fallida(s)` : ""}. Costó US$ ${summary.costUsd.toFixed(4)}.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function publishAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    const { version, summary } = await publishVersion({
      organizationId: access.organizationId,
      agentId,
      reason: text(formData, "reason"),
      actorUserId: access.userId,
      actorRole: access.role,
      force: checkbox(formData, "force"),
    });
    revalidatePath(agentPath(agentId, "versiones"));
    revalidatePath("/agents");
    return {
      ok: true,
      message: `Versión ${version.versionNumber} publicada. ${summary.passed} de ${summary.total} pruebas pasaron.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function rollbackAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    const version = await rollback({
      organizationId: access.organizationId,
      agentId,
      versionId: text(formData, "versionId"),
      reason: text(formData, "reason"),
      actorUserId: access.userId,
    });
    revalidatePath(agentPath(agentId, "versiones"));
    revalidatePath("/agents");
    return { ok: true, message: `Ahora responde la versión ${version.versionNumber}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function setStatusAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    const status = text(formData, "status") === "PAUSED" ? "PAUSED" : "PUBLISHED";
    await setAgentStatus({ organizationId: access.organizationId, agentId, status, actorUserId: access.userId });
    revalidatePath(agentPath(agentId, "versiones"));
    revalidatePath("/agents");
    return { ok: true, message: status === "PAUSED" ? "El asistente ya no responde." : "El asistente vuelve a responder." };
  } catch (error) {
    return failure(error);
  }
}

export async function flagTurnAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireManager();
    const agentId = text(formData, "agentId");
    await flagTurn({ organizationId: access.organizationId, turnId: text(formData, "turnId"), reason: text(formData, "reason"), actorUserId: access.userId });
    revalidatePath(agentPath(agentId, "metricas"));
    return { ok: true, message: "Respuesta marcada como incorrecta." };
  } catch (error) {
    return failure(error);
  }
}

// ───────────────────────── Simulador ─────────────────────────

/**
 * Un turno del simulador contra el borrador. No manda nada a WhatsApp ni toca
 * fichas reales: el estado ficticio va y vuelve con cada llamada.
 */
export async function simulateTurn(input: { agentId: string; history: SimulationTurn[]; state: SandboxState | null; message: string }): Promise<SimulationResult> {
  try {
    const access = await requireManager();
    // El estado ficticio se muta durante el turno y vuelve al navegador.
    const state = input.state ?? emptySandboxState();
    const result = await runAgentTurn({
      organizationId: access.organizationId,
      agentId: input.agentId,
      draft: true,
      mode: "SIMULATOR",
      incomingText: input.message,
      simulation: { history: input.history, state },
    });
    return {
      ok: true,
      text: result.text,
      toolCalls: result.toolCalls.map((call) => ({ name: call.name, result: call.result, isError: call.isError })),
      costUsd: result.costUsd,
      handoff: result.handoff,
      state,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "El simulador falló." };
  }
}
