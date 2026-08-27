"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Aviso de incidencias escaladas para ADMIN y SUPERVISOR.
 *
 * El canal en tiempo real es el camino rápido, pero no es confiable por sí
 * solo: si el stream muere (red, 401 al expirar la sesión, reinicio del
 * servidor), `EventSource` puede quedar cerrado sin aviso y el contador se
 * congelaría mostrando información falsa. Por eso el conteo se revalida
 * siempre por sondeo de respaldo y al volver a la pestaña.
 */
const fallbackPollMs = 60_000;

export function EscalationNotification({ role }: { role: string }) {
  const [count, setCount] = useState(0);
  const streamBrokenRef = useRef(false);
  const enabled = role === "ADMIN" || role === "SUPERVISOR";

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch("/api/order-escalations/notifications", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { count?: number };
      setCount(Math.max(0, data.count ?? 0));
    } catch {
      // El sondeo siguiente volverá a intentarlo.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    void refresh();

    const stream = new EventSource("/api/orders/stream");

    stream.addEventListener("order-change", () => {
      streamBrokenRef.current = false;
      void refresh();
    });

    stream.addEventListener("error", () => {
      // EventSource reintenta solo ante cortes de red, pero ante respuestas
      // HTTP de error queda CLOSED sin más señales. El sondeo cubre ambos.
      streamBrokenRef.current = stream.readyState === EventSource.CLOSED;
    });

    const interval = setInterval(() => {
      void refresh();
    }, fallbackPollMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stream.close();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled, refresh]);

  if (!enabled || count === 0) return null;
  return (
    <Link
      aria-label={`${count} incidencias escaladas requieren atención`}
      className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-ui-danger-border bg-ui-danger-soft px-3 py-2 text-sm font-semibold text-ui-danger shadow-lg"
      href="/orders?period=MONTH&status=ESCALATIONS"
      role="status"
    >
      <span aria-hidden="true">🔔</span>
      <span>{count}</span>
      <span className="hidden sm:inline">ticket(s) por atender</span>
    </Link>
  );
}
