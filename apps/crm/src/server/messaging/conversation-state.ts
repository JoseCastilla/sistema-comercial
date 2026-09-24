import "server-only";

import type { ResponderState } from "@/generated/prisma/enums";

import { audit } from "../audit";
import { database } from "../database";
import { publishEvent } from "../events/bus";
import { cancelPendingOutbound } from "./store";

/**
 * Quién responde (SPEC-054 BR-008 a BR-008c). Un solo responsable por
 * conversación; tomar control cancela lo automático pendiente.
 */
export async function setResponderState(input: {
  conversationId: string;
  state: ResponderState;
  actorUserId?: string | null;
  reason: string;
  assignToUserId?: string | null;
}) {
  const conversation = await database.conversation.findUniqueOrThrow({
    where: { id: input.conversationId },
    select: { id: true, organizationId: true, responderState: true, assignedUserId: true },
  });
  const cancelled = input.state === "CONTROL_HUMANO" ? await cancelPendingOutbound(conversation.id) : 0;

  await database.conversation.update({
    where: { id: conversation.id },
    data: {
      responderState: input.state,
      responderChangedAt: new Date(),
      ...(input.assignToUserId !== undefined ? { assignedUserId: input.assignToUserId, assignedAt: new Date() } : {}),
      ...(input.state === "CONTROL_HUMANO" ? { unattendedSince: null } : {}),
    },
  });
  await database.conversationEvent.create({
    data: {
      conversationId: conversation.id,
      type: input.state === "CONTROL_HUMANO" ? "TOOK_CONTROL" : input.state === "IA_ACTIVA" ? "HANDED_BACK" : "REQUIRES_ADVISOR",
      actorUserId: input.actorUserId ?? null,
      detail: { reason: input.reason, previous: conversation.responderState, cancelledPending: cancelled },
    },
  });
  await audit({
    organizationId: conversation.organizationId,
    actorUserId: input.actorUserId,
    action: `conversation.responder.${input.state.toLowerCase()}`,
    targetKind: "conversation",
    targetId: conversation.id,
    detail: { reason: input.reason },
  });
  publishEvent({ type: "conversation.responder", organizationId: conversation.organizationId, conversationId: conversation.id, state: input.state, actorUserId: input.actorUserId ?? undefined });
  publishEvent({ type: "conversation.updated", organizationId: conversation.organizationId, conversationId: conversation.id, reason: "responder" });
  return { cancelled };
}

/**
 * Reparto equitativo entre asesores disponibles (SPEC-054 BR-004): el que
 * tenga menos conversaciones abiertas asignadas. Null si nadie está conectado.
 */
export async function pickAvailableAdvisor(organizationId: string, excludeUserId?: string | null): Promise<string | null> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000);
  const advisors = await database.organizationMember.findMany({
    where: {
      organizationId,
      role: { in: ["AGENT", "SUPERVISOR", "OWNER"] },
      available: true,
      lastSeenAt: { gte: tenMinutesAgo },
      user: { status: "ACTIVE" },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: { userId: true },
  });
  if (!advisors.length) return null;
  const counts = await database.conversation.groupBy({
    by: ["assignedUserId"],
    where: { organizationId, status: "OPEN", assignedUserId: { in: advisors.map((a) => a.userId) } },
    _count: { _all: true },
  });
  const load = new Map(counts.map((c) => [c.assignedUserId, c._count._all]));
  advisors.sort((a, b) => (load.get(a.userId) ?? 0) - (load.get(b.userId) ?? 0));
  return advisors[0]?.userId ?? null;
}

export async function assignConversation(input: {
  conversationId: string;
  userId: string | null;
  actorUserId?: string | null;
  reason: string;
  type?: "ASSIGNED" | "TRANSFERRED" | "RETURNED";
}) {
  const conversation = await database.conversation.findUniqueOrThrow({
    where: { id: input.conversationId },
    select: { id: true, organizationId: true, assignedUserId: true },
  });
  await database.conversation.update({
    where: { id: conversation.id },
    data: { assignedUserId: input.userId, assignedAt: input.userId ? new Date() : null, unattendedSince: input.userId ? null : undefined },
  });
  await database.conversationEvent.create({
    data: {
      conversationId: conversation.id,
      type: input.type ?? (input.userId ? "ASSIGNED" : "RETURNED"),
      actorUserId: input.actorUserId ?? null,
      detail: { from: conversation.assignedUserId, to: input.userId, reason: input.reason },
    },
  });
  publishEvent({ type: "conversation.updated", organizationId: conversation.organizationId, conversationId: conversation.id, reason: "assignment" });
}
