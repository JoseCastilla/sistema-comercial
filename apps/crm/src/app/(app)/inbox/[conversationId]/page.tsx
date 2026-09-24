import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { StatusBadge } from "@repo/ui/status-badge";

import { canRespond, requireAccess } from "@/server/auth/access";
import { getInboxOverview, getConversationDetail, listConversations } from "@/server/inbox/queries";
import {
  contactTitle,
  deliveryGlyph,
  formatPhone,
  groupTimelineByDay,
  outboundOriginLabel,
  responderLabel,
  windowTone,
} from "@/server/inbox/rules";
import { canWriteFreely, describeWindow } from "@/server/messaging/windows";
import { formatTime } from "@/lib/time";

import { ChatActions } from "../chat-actions";
import { AsideToggle, MarkReadOnOpen, WindowBar } from "../chat-client-bits";
import { ChatComposer } from "../chat-composer";
import { ContactAside } from "../contact-aside";
import { ConversationList } from "../conversation-list";
import { readFilters } from "../filters";
import { inboxHref, isUuid, mediaUrl } from "../labels";
import type { ConversationDetail } from "@/server/inbox/queries";

export const dynamic = "force-dynamic";

type Detail = ConversationDetail;
type TimelineEntry =
  | { kind: "message"; id: string; createdAt: Date; message: Detail["messages"][number] }
  | { kind: "note"; id: string; createdAt: Date; note: Detail["notes"][number] };

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAccess();
  const { conversationId } = await params;
  if (!isUuid(conversationId)) notFound();

  const detail = await getConversationDetail(access, conversationId);
  if (!detail) notFound();

  const filters = readFilters(await searchParams);
  const [overview, list] = await Promise.all([getInboxOverview(access), listConversations(access, filters)]);

  const { conversation, contact, messages, notes, names } = detail;
  const now = new Date();
  const responder = responderLabel(conversation.responderState, conversation.assignedUserId ? names.get(conversation.assignedUserId) ?? null : null);
  const open = canWriteFreely(conversation.lastInboundAt, now);
  const mayRespond = canRespond(access.role);

  const entries: TimelineEntry[] = [
    ...messages.map((message) => ({ kind: "message" as const, id: message.id, createdAt: message.createdAt, message })),
    ...notes.map((note) => ({ kind: "note" as const, id: note.id, createdAt: note.createdAt, note })),
  ];
  const days = groupTimelineByDay(entries, access.timezone, now);
  const pendingNextAction = detail.opportunity && !detail.opportunity.nextActionAt && !conversation.isOrderInquiry;

  return (
    <div className="inbox inbox--detail">
      <ConversationList access={access} activeId={conversation.id} filters={filters} list={list} overview={overview} />

      <section aria-label="Chat" className="inbox__chat">
        <MarkReadOnOpen conversationId={conversation.id} unreadCount={conversation.unreadCount} />
        <header className="chat-header">
          <div className="chat-header__row">
            <div className="chat-header__identity">
              <Link className="chat-header__back" href={inboxHref({ vista: filters.view, q: filters.query })}>
                ← Chats
              </Link>
              <div className="min-w-0">
                <h1 className="chat-header__name">{contactTitle(contact)}</h1>
                <p className="chat-header__phone">
                  {formatPhone(contact.phone) || "Sin teléfono"} · <StatusBadge tone={responder.tone}>{responder.label}</StatusBadge>
                  {conversation.originAdId ? <> · <StatusBadge tone="info">Anuncio</StatusBadge></> : null}
                </p>
              </div>
            </div>
            {mayRespond ? (
              <ChatActions
                assignedUserId={conversation.assignedUserId}
                conversationId={conversation.id}
                currentUserId={access.userId}
                hasAiAgent={Boolean(conversation.aiAgentId)}
                members={detail.members.map((member) => ({ userId: member.userId, name: member.name, available: member.available }))}
                responderState={conversation.responderState}
                role={access.role}
                status={conversation.status}
              />
            ) : null}
            <AsideToggle />
          </div>
          {pendingNextAction ? (
            <p className="chat-hint">
              Esta oportunidad no tiene siguiente acción: define una antes de cerrar la conversación.{" "}
              <Link href={`/pipeline/${detail.opportunity?.id}`}>Abrir en el embudo</Link>
            </p>
          ) : null}
        </header>

        <div className="chat-messages">
          {detail.messagesTruncated ? <p className="chat-truncated">Se muestran los últimos 200 mensajes.</p> : null}
          {days.length === 0 ? (
            <p className="chat-truncated">Todavía no hay mensajes en esta conversación.</p>
          ) : (
            days.map((day) => (
              <Fragment key={day.key}>
                <p className="chat-day">{day.label}</p>
                {day.items.map((entry) =>
                  entry.kind === "note" ? (
                    <article className="chat-bubble chat-bubble--note" key={entry.id}>
                      <p className="chat-bubble__label">Nota interna · {names.get(entry.note.authorUserId) ?? "Alguien del equipo"}</p>
                      <p className="chat-bubble__body">{entry.note.body}</p>
                      <p className="chat-bubble__meta">{formatTime(entry.createdAt, access.timezone)}</p>
                    </article>
                  ) : (
                    <MessageBubble key={entry.id} message={entry.message} names={names} timezone={access.timezone} />
                  ),
                )}
              </Fragment>
            ))
          )}
        </div>

        <WindowBar
          freeUntil={conversation.freeUntil ? conversation.freeUntil.toISOString() : null}
          initialText={describeWindow(conversation.lastInboundAt, conversation.freeUntil, now)}
          initialTone={windowTone(conversation.lastInboundAt, now)}
          lastInboundAt={conversation.lastInboundAt ? conversation.lastInboundAt.toISOString() : null}
        />

        {!mayRespond ? (
          <p className="chat-readonly">El back office lee las conversaciones; responder y moverlas lo hace el equipo comercial.</p>
        ) : conversation.status === "CLOSED" ? (
          <p className="chat-readonly">Esta conversación está cerrada. Reábrela para volver a escribir.</p>
        ) : (
          <>
            {!open ? <p className="chat-readonly">Ya no puedes escribirle libremente. Envía una plantilla para retomar.</p> : null}
            <ChatComposer
              advisorName={access.userName}
              canWriteFreely={open}
              contactName={contact.displayName ?? ""}
              contactPhone={contact.phone ?? ""}
              conversationId={conversation.id}
              quickReplies={detail.quickReplies}
              templates={detail.templates.map((template) => ({
                id: template.id,
                name: template.name,
                language: template.language,
                category: template.category,
                components: template.components,
                variables: template.variables,
              }))}
            />
          </>
        )}
      </section>

      <ContactAside access={access} detail={detail} />
    </div>
  );
}

function MessageBubble({
  message,
  names,
  timezone,
}: {
  message: Detail["messages"][number];
  names: Map<string, string>;
  timezone: string;
}) {
  const outbound = message.direction === "OUTBOUND";
  const delivery = outbound ? deliveryGlyph(message.status, message.errorTitle) : null;
  const label = outbound ? outboundOriginLabel(message.originKind, message.senderUserId ? names.get(message.senderUserId) : null) : "";
  const mime = message.mediaMimeType ?? "";
  const buttons = readButtons(message.payload);

  return (
    <article className={`chat-bubble ${outbound ? "chat-bubble--out" : "chat-bubble--in"}`}>
      {label ? <p className="chat-bubble__label">{label}</p> : null}
      {message.mediaPath ? (
        mime.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- adjunto servido por /api/media, sin optimización de Next
          <img alt={message.body ?? "Imagen recibida"} className="chat-bubble__image" src={mediaUrl(message.mediaPath)} />
        ) : mime.startsWith("audio/") ? (
          <audio controls preload="none" src={mediaUrl(message.mediaPath)}>
            Tu navegador no puede reproducir este audio.
          </audio>
        ) : (
          <a className="chat-bubble__file" href={mediaUrl(message.mediaPath)} rel="noreferrer noopener" target="_blank">
            Abrir el archivo{message.mediaSizeBytes ? ` (${Math.max(1, Math.round(message.mediaSizeBytes / 1024))} KB)` : ""}
          </a>
        )
      ) : null}
      {message.body ? <p className="chat-bubble__body">{message.body}</p> : null}
      {buttons.length ? (
        <div className="chat-bubble__buttons">
          {buttons.map((button) => (
            <span key={button}>{button}</span>
          ))}
        </div>
      ) : null}
      <p className="chat-bubble__meta">
        <span>{formatTime(message.createdAt, timezone)}</span>
        {delivery?.glyph ? (
          <span className="chat-status" data-tone={delivery.tone} title={delivery.title}>
            {delivery.glyph}
          </span>
        ) : null}
      </p>
      {message.status === "FAILED" && message.errorTitle ? <p className="chat-bubble__error">No se entregó: {message.errorTitle}</p> : null}
    </article>
  );
}

/** Botones de respuesta rápida guardados en el payload normalizado. */
function readButtons(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const list = (payload as Record<string, unknown>).buttons;
  if (!Array.isArray(list)) return [];
  return list
    .map((button) => (button && typeof button === "object" && "title" in button ? String((button as { title: unknown }).title) : ""))
    .filter(Boolean);
}
