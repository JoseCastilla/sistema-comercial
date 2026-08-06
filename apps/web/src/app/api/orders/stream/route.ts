import { auth } from "@/server/auth/auth";
import { database } from "@/server/database";
import {
  subscribeToOrderChanges,
  type OrderChangeEvent,
} from "@/server/orders/order-change-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function encodeEvent(eventName: string, data: unknown) {
  return encoder.encode(
    `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json({ message: "No autorizado" }, { status: 401 });
  }

  const membership = await database.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      user: { status: "ACTIVE" },
      organization: { status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  if (!membership) {
    return Response.json({ message: "Acceso denegado" }, { status: 403 });
  }

  let enqueueOrderChange: (event: OrderChangeEvent) => void = () => undefined;
  let unsubscribe: (() => void) | null = null;
  let closeStream = () => {
    unsubscribe?.();
    unsubscribe = null;
  };

  try {
    unsubscribe = await subscribeToOrderChanges(
      membership.organizationId,
      (event) => {
        enqueueOrderChange(event);
      },
    );
  } catch (error) {
    console.error("No se pudo abrir el canal de órdenes DITO", error);

    return Response.json(
      { message: "Sincronización temporalmente no disponible" },
      { status: 503 },
    );
  }

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

      enqueueOrderChange = (event) => {
        send(encodeEvent("order-change", event));
      };

      heartbeat = setInterval(() => {
        send(encoder.encode(": heartbeat\n\n"));
      }, 20_000);

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
