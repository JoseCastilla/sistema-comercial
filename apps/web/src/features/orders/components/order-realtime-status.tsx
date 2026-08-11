"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ConnectionState = "CONNECTING" | "LIVE" | "RECONNECTING";

const FALLBACK_REFRESH_MS = 30_000;
const EVENT_DEBOUNCE_MS = 400;

export function OrderRealtimeStatus() {
  const router = useRouter();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("CONNECTING");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPendingWhileHidden = useRef(false);

  useEffect(() => {
    const eventSource = new EventSource("/api/orders/stream");

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") {
        refreshPendingWhileHidden.current = true;
        return;
      }

      if (refreshTimer.current) clearTimeout(refreshTimer.current);

      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, EVENT_DEBOUNCE_MS);
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        refreshPendingWhileHidden.current
      ) {
        refreshPendingWhileHidden.current = false;
        scheduleRefresh();
      }
    };

    eventSource.addEventListener("open", () => {
      setConnectionState("LIVE");
    });

    eventSource.addEventListener("ready", () => {
      setConnectionState("LIVE");
    });

    eventSource.addEventListener("order-change", scheduleRefresh);

    eventSource.addEventListener("error", () => {
      setConnectionState("RECONNECTING");
    });

    const fallbackRefresh = window.setInterval(() => {
      scheduleRefresh();
    }, FALLBACK_REFRESH_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      eventSource.close();
      window.clearInterval(fallbackRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [router]);

  const live = connectionState === "LIVE";
  const label = live
    ? "En vivo"
    : connectionState === "CONNECTING"
      ? "Conectando"
      : "Reconectando";

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
          : "La actualización automática está restableciendo la conexión."
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
