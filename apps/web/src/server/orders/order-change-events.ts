import "server-only";

import { EventEmitter } from "node:events";

import { createPostgresNotificationClient } from "@repo/database";

const CHANNEL = "dito_order_changes";
const RECONNECT_DELAY_MS = 2_000;

export interface OrderChangeEvent {
  organizationId: string;
  orderId: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  changedAt: string;
}

type NotificationClient = ReturnType<typeof createPostgresNotificationClient>;
type OrderChangeListener = (event: OrderChangeEvent) => void;

interface OrderChangeBusState {
  client: NotificationClient | null;
  connectionPromise: Promise<void> | null;
  emitter: EventEmitter;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  subscribers: number;
}

const globalForOrderChangeBus = globalThis as typeof globalThis & {
  sistemaComercialOrderChangeBus?: OrderChangeBusState;
};

const state = globalForOrderChangeBus.sistemaComercialOrderChangeBus ?? {
  client: null,
  connectionPromise: null,
  emitter: new EventEmitter(),
  reconnectTimer: null,
  subscribers: 0,
};

state.emitter.setMaxListeners(0);

globalForOrderChangeBus.sistemaComercialOrderChangeBus = state;

function parseOrderChangeEvent(payload: string | undefined) {
  if (!payload) return null;

  try {
    const event = JSON.parse(payload) as Partial<OrderChangeEvent>;

    if (
      typeof event.organizationId !== "string" ||
      typeof event.orderId !== "string" ||
      !["INSERT", "UPDATE", "DELETE"].includes(event.operation ?? "") ||
      typeof event.changedAt !== "string"
    ) {
      return null;
    }

    return event as OrderChangeEvent;
  } catch {
    return null;
  }
}

function scheduleReconnect() {
  if (state.reconnectTimer || state.subscribers === 0) return;

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;

    void ensureConnected().catch((error: unknown) => {
      console.error("No se pudo restablecer LISTEN de órdenes DITO", error);
      scheduleReconnect();
    });
  }, RECONNECT_DELAY_MS);
}

function markDisconnected(client: NotificationClient) {
  if (state.client !== client) return;

  state.client = null;
  scheduleReconnect();
}

async function connect() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("La variable DATABASE_URL es obligatoria");
  }

  const client = createPostgresNotificationClient(connectionString);

  client.on("notification", (notification) => {
    if (notification.channel !== CHANNEL) return;

    const event = parseOrderChangeEvent(notification.payload);

    if (event) state.emitter.emit(event.organizationId, event);
  });

  client.on("error", (error) => {
    console.error("La conexión LISTEN de órdenes DITO falló", error);
    markDisconnected(client);
  });

  client.on("end", () => {
    markDisconnected(client);
  });

  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    state.client = client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

async function ensureConnected() {
  if (state.client) return;

  state.connectionPromise ??= connect().finally(() => {
    state.connectionPromise = null;
  });

  return state.connectionPromise;
}

export async function subscribeToOrderChanges(
  organizationId: string,
  listener: OrderChangeListener,
) {
  state.emitter.on(organizationId, listener);
  state.subscribers += 1;

  try {
    await ensureConnected();
  } catch (error) {
    state.emitter.off(organizationId, listener);
    state.subscribers = Math.max(0, state.subscribers - 1);
    throw error;
  }

  let active = true;

  return () => {
    if (!active) return;

    active = false;
    state.emitter.off(organizationId, listener);
    state.subscribers = Math.max(0, state.subscribers - 1);
  };
}
