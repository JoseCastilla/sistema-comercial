"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ConnectionState = "CONNECTING" | "LIVE" | "STALE";

/**
 * El servidor late cada 10s con el evento `heartbeat`. Dos latidos perdidos
 * más un margen —25s en total— es la señal de que el canal murió sin avisar.
 * El techo lo fija AC-006 de SPEC-008: sin eventos SSE la bandeja debe
 * actualizarse dentro de los treinta segundos. `EventSource`
 * puede quedar con el socket abierto y mudo, o pasar a CLOSED tras un error
 * HTTP, y en ninguno de los dos casos emite algo que podamos observar.
 *
 * Antes esa ceguera se tapaba con un `router.refresh()` incondicional cada
 * 30s, que recargaba la bandeja completa para todos los asesores conectados
 * aunque no hubiera cambiado nada. El trigger `dito_order_change_notify` de
 * PostgreSQL ya garantiza que toda escritura sobre `dito_orders` llegue por
 * el stream, así que el sondeo no aportaba ninguna actualización: solo carga.
 * Ahora solo se refresca ante un cambio real o ante un canal comprobadamente
 * caído.
 */
const HEARTBEAT_INTERVAL_MS = 10_000;
const STALE_AFTER_MS = HEARTBEAT_INTERVAL_MS * 2 + 5_000;
const WATCHDOG_TICK_MS = 5_000;
const EVENT_DEBOUNCE_MS = 400;
const RECONNECT_BASE_MS = 3_000;
const RECONNECT_MAX_MS = 60_000;

export function OrderRealtimeStatus() {
  const router = useRouter();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("CONNECTING");
  const stateRef = useRef<ConnectionState>("CONNECTING");

  useEffect(() => {
    let source: EventSource | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshPendingWhileHidden = false;
    let lastSignalAt = Date.now();
    let failures = 0;
    let disposed = false;

    const setState = (next: ConnectionState) => {
      if (stateRef.current === next) return;
      stateRef.current = next;
      setConnectionState(next);
    };

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") {
        refreshPendingWhileHidden = true;
        return;
      }

      if (refreshTimer) clearTimeout(refreshTimer);

      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, EVENT_DEBOUNCE_MS);
    };

    const markAlive = () => {
      failures = 0;
      lastSignalAt = Date.now();
      setState("LIVE");
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer) return;

      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** failures,
        RECONNECT_MAX_MS,
      );
      failures += 1;

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposed) return;

      source?.close();
      lastSignalAt = Date.now();

      const next = new EventSource("/api/orders/stream");

      next.addEventListener("open", markAlive);
      next.addEventListener("ready", markAlive);
      next.addEventListener("heartbeat", markAlive);

      next.addEventListener("order-change", () => {
        markAlive();
        scheduleRefresh();
      });

      next.addEventListener("error", () => {
        setState("STALE");

        // En CONNECTING el navegador reintenta solo con el `retry` del stream.
        // En CLOSED se rindió —típicamente un 401 al expirar la sesión— y solo
        // revive con una reconexión explícita, que espaciamos para no castigar
        // al servidor mientras la causa siga presente.
        if (next.readyState === EventSource.CLOSED) scheduleReconnect();
      });

      source = next;
    };

    const recoverIfStale = () => {
      if (Date.now() - lastSignalAt < STALE_AFTER_MS) return false;

      setState("STALE");
      scheduleReconnect();
      scheduleRefresh();
      return true;
    };

    connect();

    // El vigía no refresca nada mientras el latido siga llegando.
    const watchdog = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      recoverIfStale();
    }, WATCHDOG_TICK_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      // Una pestaña dormida puede haber quedado con el stream congelado, así
      // que el estado del canal se revisa antes de dar por buena la vista.
      const recovering = recoverIfStale();

      if (refreshPendingWhileHidden) {
        refreshPendingWhileHidden = false;
        if (!recovering) scheduleRefresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [router]);

  const live = connectionState === "LIVE";
  const label = live
    ? "Actualización automática"
    : connectionState === "CONNECTING"
      ? "Conectando…"
      : "Sin conexión en vivo";

  return (
    <span
      aria-live="polite"
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium",
        live
          ? "border-ui-success bg-ui-success-soft text-ui-success"
          : "border-ui-warning-border bg-ui-warning-soft text-ui-warning",
      ].join(" ")}
      title={
        live
          ? "Los cambios de pedidos se actualizan automáticamente."
          : "Se perdió el canal en vivo. Reintentando y recargando la bandeja."
      }
    >
      <span
        aria-hidden="true"
        className={[
          "size-1.5 rounded-full",
          live ? "bg-ui-success" : "animate-pulse bg-ui-warning",
        ].join(" ")}
      />
      {label}
    </span>
  );
}
