import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import type { Access } from "../auth/access";
import { database } from "../database";
import { conversationScopeWhere, INBOX_VIEWS, searchWhere, viewWhere, type InboxView } from "./scope";

/**
 * Lecturas de la bandeja. Todo parte del alcance del usuario
 * (`conversationScopeWhere`) y de la organización: nunca de un id suelto.
 */

export const PAGE_SIZE = 50;

async function unattendedThreshold(organizationId: string): Promise<Date> {
  const organization = await database.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { unattendedAfterMinutes: true },
  });
  return new Date(Date.now() - organization.unattendedAfterMinutes * 60_000);
}

async function userNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const users = await database.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(users.map((user) => [user.id, user.name]));
}

/** Cabecera de la bandeja: número conectado, disponibilidad y contadores por vista. */
export async function getInboxOverview(access: Access) {
  const scope = conversationScopeWhere(access);
  const unattendedBefore = await unattendedThreshold(access.organizationId);
  const [connectedNumbers, member, totalInScope, ...counts] = await Promise.all([
    database.whatsappNumber.count({ where: { organizationId: access.organizationId, status: "CONNECTED" } }),
    database.organizationMember.findUnique({ where: { id: access.memberId }, select: { available: true } }),
    database.conversation.count({ where: scope }),
    ...INBOX_VIEWS.map(([view]) => database.conversation.count({ where: { AND: [scope, viewWhere(view, { userId: access.userId, unattendedBefore })] } })),
  ]);
  const countByView = Object.fromEntries(INBOX_VIEWS.map(([view], index) => [view, counts[index] ?? 0])) as Record<InboxView, number>;
  return {
    hasConnectedNumber: connectedNumbers > 0,
    available: member?.available ?? false,
    totalInScope,
    countByView,
  };
}

export interface ListFilters {
  view: InboxView;
  query: string;
  page: number;
}

export async function listConversations(access: Access, filters: ListFilters) {
  const unattendedBefore = await unattendedThreshold(access.organizationId);
  const where: Prisma.ConversationWhereInput = {
    AND: [conversationScopeWhere(access), viewWhere(filters.view, { userId: access.userId, unattendedBefore }), searchWhere(filters.query)],
  };
  const page = Math.max(1, filters.page);
  const [rows, total] = await Promise.all([
    database.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        responderState: true,
        assignedUserId: true,
        originAdId: true,
        freeUntil: true,
        unreadCount: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        lastInboundAt: true,
        unattendedSince: true,
        contact: { select: { id: true, displayName: true, phone: true } },
      },
    }),
    database.conversation.count({ where }),
  ]);
  const names = await userNames(rows.map((row) => row.assignedUserId));
  return {
    rows: rows.map((row) => ({ ...row, assignedName: row.assignedUserId ? names.get(row.assignedUserId) ?? null : null })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export const MESSAGE_LIMIT = 200;
const OPEN_STAGES: Prisma.OpportunityWhereInput = { stage: { notIn: ["GANADA", "PERDIDA"] } };

/** Todo lo que necesita la pantalla de una conversación. Null si no está en el alcance. */
export async function getConversationDetail(access: Access, conversationId: string) {
  const conversation = await database.conversation.findFirst({
    where: { id: conversationId, ...conversationScopeWhere(access) },
    include: {
      contact: true,
      whatsappNumber: { select: { id: true, displayPhoneNumber: true, verifiedName: true, status: true } },
    },
  });
  if (!conversation) return null;

  const now = new Date();
  const [messagesDesc, notes, events, marketingConsent, opportunity, orders, appointments, members, quickReplies, templates, aiAgent] = await Promise.all([
    database.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MESSAGE_LIMIT,
    }),
    database.conversationNote.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } }),
    database.conversationEvent.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } }),
    database.contactConsent.findFirst({ where: { contactId: conversation.contactId, category: "MARKETING" }, orderBy: { createdAt: "desc" } }),
    database.opportunity.findFirst({
      where: { organizationId: access.organizationId, contactId: conversation.contactId, ...OPEN_STAGES },
      orderBy: { createdAt: "desc" },
      include: { proposalPlan: { select: { name: true } } },
    }),
    database.order.findMany({
      where: { organizationId: access.organizationId, contactId: conversation.contactId },
      orderBy: { registeredAt: "desc" },
      take: 10,
      select: { id: true, externalRef: true, planName: true, status: true, registeredAt: true },
    }),
    database.appointment.findMany({
      where: { organizationId: access.organizationId, contactId: conversation.contactId, scheduledAt: { gte: now }, status: { in: ["PENDING", "RESCHEDULED"] } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: { id: true, scheduledAt: true, status: true, userId: true },
    }),
    database.organizationMember.findMany({
      where: { organizationId: access.organizationId, role: { in: ["AGENT", "SUPERVISOR", "OWNER"] }, user: { status: "ACTIVE" } },
      select: { userId: true, available: true, role: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    database.quickReply.findMany({ where: { organizationId: access.organizationId }, orderBy: { shortcut: "asc" }, select: { id: true, shortcut: true, body: true } }),
    database.messageTemplate.findMany({
      where: { organizationId: access.organizationId, whatsappNumberId: conversation.whatsappNumberId, status: "APPROVED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, language: true, category: true, components: true, variables: true },
    }),
    conversation.aiAgentId
      ? database.aiAgent.findFirst({ where: { id: conversation.aiAgentId, organizationId: access.organizationId }, select: { id: true, name: true, status: true } })
      : Promise.resolve(null),
  ]);

  const messages = messagesDesc.reverse();
  const names = await userNames([
    conversation.assignedUserId,
    ...messages.map((message) => message.senderUserId),
    ...notes.map((note) => note.authorUserId),
    ...events.map((event) => event.actorUserId),
    ...events.flatMap((event) => {
      const detail = event.detail && typeof event.detail === "object" && !Array.isArray(event.detail) ? (event.detail as Record<string, unknown>) : {};
      return [detail.from, detail.to].filter((value): value is string => typeof value === "string");
    }),
    ...appointments.map((appointment) => appointment.userId),
    opportunity?.assignedUserId,
  ]);

  return {
    conversation,
    contact: conversation.contact,
    number: conversation.whatsappNumber,
    messages,
    notes,
    events,
    names,
    marketingConsent,
    opportunity,
    orders,
    appointments,
    members: members.map((member) => ({ userId: member.userId, name: member.user.name, available: member.available, role: member.role })),
    quickReplies,
    templates,
    aiAgent,
    messagesTruncated: messagesDesc.length === MESSAGE_LIMIT,
  };
}

export type ConversationDetail = NonNullable<Awaited<ReturnType<typeof getConversationDetail>>>;
export type ConversationRow = Awaited<ReturnType<typeof listConversations>>["rows"][number];
