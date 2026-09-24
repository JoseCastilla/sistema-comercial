import "server-only";

import { isWithinBusinessHours } from "@/lib/time";

import { database } from "../database";
import { subscribeToEvents, type DomainEvent } from "../events/bus";
import { pickAvailableAdvisor, setResponderState } from "../messaging/conversation-state";
import { enqueueOutboundMessage, OutboundRejectedError } from "../messaging/store";

import { parseSchedule } from "./prompt";
import { MissingProviderKeyError, ProviderError } from "./provider";
import { AgentRuntimeError, runAgentTurn } from "./runtime";
import { shouldAgentRespond, type AgentDecisionInput } from "./schedule";

/**
 * El asistente responde a los mensajes entrantes (SPEC-058 BR-009 a BR-012).
 *
 * Solo actúa si la conversación está en `IA_ACTIVA`, tiene un agente publicado
 * y su horario aplica. Si está en `IA_ACTIVA` pero no hay asistente que pueda
 * responder, la conversación pasa a la cola en vez de quedarse callada.
 *
 * Espera dos segundos por conversación antes de contestar: quien escribe tres
 * mensajes seguidos recibe una sola respuesta, no tres.
 */

export const DEBOUNCE_MS = 2_000;

export { shouldAgentRespond };

interface PendingTurn {
  timer: ReturnType<typeof setTimeout>;
  text: string;
}

const globalForAi = globalThis as typeof globalThis & {
  crmAiSubscriber?: () => void;
  crmAiPending?: Map<string, PendingTurn>;
};

const pending = globalForAi.crmAiPending ?? new Map<string, PendingTurn>();
globalForAi.crmAiPending = pending;

interface BusinessHours {
  days: number[];
  start: string;
  end: string;
}

function parseBusinessHours(value: unknown): BusinessHours {
  const fallback: BusinessHours = { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "19:00" };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const days = Array.isArray(raw.days) ? raw.days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : fallback.days;
  return {
    days: days.length ? days : fallback.days,
    start: typeof raw.start === "string" ? raw.start : fallback.start,
    end: typeof raw.end === "string" ? raw.end : fallback.end,
  };
}

/** Junta lo que hace falta para decidir y lo pasa a la regla pura. */
async function decide(organizationId: string, conversationId: string, now: Date) {
  const conversation = await database.conversation.findFirst({
    where: { id: conversationId, organizationId },
    select: {
      id: true,
      responderState: true,
      aiAgentId: true,
      organization: { select: { businessHours: true, timezone: true } },
    },
  });
  if (!conversation) return null;

  const agent = conversation.aiAgentId
    ? await database.aiAgent.findFirst({
        where: { id: conversation.aiAgentId, organizationId },
        select: { id: true, status: true, publishedVersionId: true, schedule: true },
      })
    : null;

  const hours = parseBusinessHours(conversation.organization.businessHours);
  const timezone = conversation.organization.timezone;
  const withinBusinessHours = isWithinBusinessHours(now, hours, timezone);
  const scheduleMode = parseSchedule(agent?.schedule).mode;
  // Solo se pregunta por asesores conectados cuando la decisión depende de ello.
  const advisorAvailable = scheduleMode === "WHEN_NO_ADVISOR" ? Boolean(await pickAvailableAdvisor(organizationId)) : false;

  const facts: AgentDecisionInput = {
    responderState: conversation.responderState,
    agentStatus: agent?.status ?? null,
    hasPublishedVersion: Boolean(agent?.publishedVersionId),
    scheduleMode,
    withinBusinessHours,
    advisorAvailable,
  };
  return { conversation, agent, decision: shouldAgentRespond(facts) };
}

async function answer(event: Extract<DomainEvent, { type: "message.inbound" }>, text: string) {
  const now = new Date();
  const context = await decide(event.organizationId, event.conversationId, now);
  if (!context) return;
  const { agent, decision } = context;

  if (!decision.respond) {
    if (decision.handoffReason) {
      await setResponderState({ conversationId: event.conversationId, state: "REQUIERE_ASESOR", reason: decision.handoffReason });
    }
    return;
  }
  if (!agent?.publishedVersionId) return;

  let result;
  try {
    result = await runAgentTurn({
      organizationId: event.organizationId,
      agentId: agent.id,
      versionId: agent.publishedVersionId,
      conversationId: event.conversationId,
      incomingText: text,
      mode: "LIVE",
      now,
    });
  } catch (error) {
    // Sin clave, con el proveedor caído o con la configuración rota, la
    // conversación va a la cola: nunca se queda sin respuesta.
    const reason =
      error instanceof MissingProviderKeyError
        ? "el asistente no tiene credenciales"
        : error instanceof ProviderError
          ? "el proveedor del asistente no respondió"
          : error instanceof AgentRuntimeError
            ? error.message
            : "el asistente falló";
    console.error("El asistente no pudo responder", error);
    await setResponderState({ conversationId: event.conversationId, state: "REQUIERE_ASESOR", reason });
    return;
  }

  // Tope agotado: `runAgentTurn` ya dejó la conversación en la cola.
  if (result.blocked) return;
  if (!result.text.trim()) return;

  try {
    await enqueueOutboundMessage({
      conversationId: event.conversationId,
      originKind: "AGENT_AI",
      originRef: result.versionId,
      content: { kind: "text", body: result.text },
      clientRequestId: result.turnId ? `ai:${result.turnId}` : null,
    });
  } catch (error) {
    // Con la ventana de 24 h cerrada el agente no escribe (BR-012).
    if (error instanceof OutboundRejectedError) {
      await setResponderState({
        conversationId: event.conversationId,
        state: "REQUIERE_ASESOR",
        reason: "pasaron 24 h: hay que escribirle con una plantilla",
      });
      return;
    }
    throw error;
  }
}

function schedule(event: Extract<DomainEvent, { type: "message.inbound" }>, text: string) {
  const existing = pending.get(event.conversationId);
  if (existing) clearTimeout(existing.timer);
  const merged = existing ? `${existing.text}\n${text}` : text;
  const timer = setTimeout(() => {
    pending.delete(event.conversationId);
    answer(event, merged).catch((error) => console.error("El asistente falló al responder", error));
  }, DEBOUNCE_MS);
  // El proceso no se queda vivo por un turno pendiente.
  timer.unref?.();
  pending.set(event.conversationId, { timer, text: merged });
}

async function onInbound(event: Extract<DomainEvent, { type: "message.inbound" }>) {
  const message = await database.message.findFirst({
    where: { id: event.messageId, organizationId: event.organizationId },
    select: { body: true, type: true },
  });
  if (!message) return;
  const text = message.body?.trim() || `[el cliente envió ${message.type}]`;
  schedule(event, text);
}

/** Suscriptor que hace responder al agente en IA_ACTIVA (módulo agente). */
export function registerAiSubscriber(): void {
  globalForAi.crmAiSubscriber?.();
  globalForAi.crmAiSubscriber = subscribeToEvents((event) => {
    if (event.type !== "message.inbound") return;
    onInbound(event).catch((error) => console.error("Suscriptor del asistente falló", error));
  });
}
