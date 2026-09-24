import { auth } from "@/server/auth/auth";
import { database } from "@/server/database";
import { subscribeToEvents, type DomainEvent } from "@/server/events/bus";
import { conversationScopeWhere } from "@/server/inbox/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Canal de la bandeja (SPEC-054 BR-021). Se suscribe al emisor en proceso,
 * filtra por organización y, para el asesor, por lo que puede ver. El cliente
 * solo recibe «esta conversación cambió» y vuelve a pedir la página.
 *
 * El latido va como evento con nombre para que `EventSource` lo observe y
 * pueda distinguir un canal tranquilo de uno muerto.
 */
const HEARTBEAT_INTERVAL_MS = 10_000;
const encoder = new TextEncoder();

function encodeEvent(name: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Solo interesan los cambios de conversación; el resto de eventos no toca la bandeja. */
function conversationChange(event: DomainEvent): { conversationId: string; reason: string } | null {
  switch (event.type) {
    case "conversation.updated":
      return { conversationId: event.conversationId, reason: event.reason };
    case "message.status":
      return { conversationId: event.conversationId, reason: "status" };
    case "conversation.unanswered":
      return { conversationId: event.conversationId, reason: "unattended" };
    default:
      return null;
  }
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ message: "No autorizado" }, { status: 401 });

  const membership = await database.organizationMember.findFirst({
    where: { userId: session.user.id, user: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true },
  });
  if (!membership) return Response.json({ message: "Acceso denegado" }, { status: 403 });

  const scope = conversationScopeWhere({ organizationId: membership.organizationId, role: membership.role, userId: session.user.id });

  let unsubscribe: (() => void) | null = null;
  let closeStream: () => void = () => undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        unsubscribe = null;
        try {
          controller.close();
        } catch {
          // Ya estaba cerrado por el navegador.
        }
      };
      closeStream = close;

      const send = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          close();
        }
      };

      unsubscribe = subscribeToEvents((event) => {
        if (closed || event.organizationId !== membership.organizationId) return;
        const change = conversationChange(event);
        if (!change) return;
        void database.conversation
          .findFirst({
            where: { id: change.conversationId, ...scope },
            select: { id: true, unreadCount: true, lastMessagePreview: true, contact: { select: { displayName: true, phone: true } } },
          })
          .then((conversation) => {
            if (!conversation) return;
            send(
              encodeEvent("conversation", {
                conversationId: conversation.id,
                reason: change.reason,
                contactName: conversation.contact.displayName ?? (conversation.contact.phone ? `+${conversation.contact.phone}` : "Sin nombre"),
                preview: change.reason === "inbound" ? conversation.lastMessagePreview : null,
                unreadCount: conversation.unreadCount,
              }),
            );
          })
          .catch((error: unknown) => console.error("No se pudo resolver la conversación del evento", error));
      });

      heartbeat = setInterval(() => send(encodeEvent("heartbeat", { at: new Date().toISOString() })), HEARTBEAT_INTERVAL_MS);

      if (request.signal.aborted) {
        close();
      } else {
        request.signal.addEventListener("abort", close, { once: true });
      }

      send(encoder.encode("retry: 3000\n\n"));
      send(encodeEvent("ready", { connectedAt: new Date().toISOString() }));
    },
    cancel() {
      closeStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
