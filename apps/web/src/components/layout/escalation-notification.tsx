"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Avisos flotantes: incidencias escaladas y recuperos vencidos para ADMIN y
 * SUPERVISOR; llamadas acordadas por atender para quien tiene casos de
 * campaña (SPEC-048 BR-017).
 *
 * El canal en tiempo real es el camino rápido, pero no es confiable por sí
 * solo: si el stream muere (red, 401 al expirar la sesión, reinicio del
 * servidor), `EventSource` puede quedar cerrado sin aviso y el contador se
 * congelaría mostrando información falsa.
 *
 * El latido del stream ahora es observable, así que el respaldo dejó de ser
 * un sondeo ciego: solo vuelve a consultar cuando el canal deja de latir, o
 * al regresar a la pestaña. Con el canal sano el contador se actualiza por
 * evento y no se gasta una sola petición de más.
 *
 * La agenda es distinta: una cita vence por el reloj, no por un evento de
 * pedidos, así que el aviso de citas se refresca cada minuto con la pestaña
 * visible y en cada cambio de página (registrar el resultado lleva a otra
 * página, y ahí el aviso debe desaparecer).
 */
const HEARTBEAT_INTERVAL_MS = 10_000;
const STALE_AFTER_MS = HEARTBEAT_INTERVAL_MS * 2 + 5_000;
const WATCHDOG_TICK_MS = 10_000;
const AGENDA_TICK_MS = 60_000;

export function EscalationNotification({ role }: { role: string }) {
  const [count, setCount] = useState(0);
  const [recoveryOverdue, setRecoveryOverdue] = useState(0);
  const [agendaDue, setAgendaDue] = useState(0);
  const streamBrokenRef = useRef(false);
  const pathname = usePathname();
  const supervises = role === "ADMIN" || role === "SUPERVISOR";

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/order-escalations/notifications", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        count?: number;
        recoveryOverdue?: number;
        agendaDue?: number;
      };
      setCount(Math.max(0, data.count ?? 0));
      setRecoveryOverdue(Math.max(0, data.recoveryOverdue ?? 0));
      setAgendaDue(Math.max(0, data.agendaDue ?? 0));
    } catch {
      // El sondeo siguiente volverá a intentarlo.
    }
  }, []);

  // Todos: al entrar, al volver a la pestaña, al cambiar de página y cada
  // minuto con la pestaña visible (la agenda vence por reloj).
  useEffect(() => {
    void refresh();

    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, AGENDA_TICK_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [pathname, refresh]);

  // Supervisión: además, el canal de pedidos con su vigía.
  useEffect(() => {
    if (!supervises) return;

    let lastSignalAt = Date.now();

    const stream = new EventSource("/api/orders/stream");

    const markAlive = () => {
      lastSignalAt = Date.now();
      streamBrokenRef.current = false;
    };

    stream.addEventListener("open", markAlive);
    stream.addEventListener("ready", markAlive);
    stream.addEventListener("heartbeat", markAlive);

    stream.addEventListener("order-change", () => {
      markAlive();
      void refresh();
    });

    stream.addEventListener("error", () => {
      // EventSource reintenta solo ante cortes de red, pero ante respuestas
      // HTTP de error queda CLOSED sin más señales. El vigía cubre ambos.
      streamBrokenRef.current = stream.readyState === EventSource.CLOSED;
    });

    const watchdog = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSignalAt < STALE_AFTER_MS) return;

      // El canal dejó de latir: el contador en pantalla ya no es confiable.
      lastSignalAt = Date.now();
      streamBrokenRef.current = true;
      void refresh();
    }, WATCHDOG_TICK_MS);

    return () => {
      stream.close();
      clearInterval(watchdog);
    };
  }, [supervises, refresh]);

  if (count === 0 && recoveryOverdue === 0 && agendaDue === 0) return null;
  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col items-end gap-2">
      {count > 0 ? (
        <Link
          aria-label={`${count} incidencias escaladas requieren atención`}
          className="flex items-center gap-2 rounded-full border border-ui-danger-border bg-ui-danger-soft px-3 py-2 text-sm font-semibold text-ui-danger shadow-lg"
          href="/orders?period=MONTH&status=ESCALATIONS"
          role="status"
        >
          <span aria-hidden="true">🔔</span>
          <span>{count}</span>
          <span className="hidden sm:inline">incidencia(s) por atender</span>
        </Link>
      ) : null}
      {recoveryOverdue > 0 ? (
        <Link
          aria-label={`${recoveryOverdue} recuperos con la próxima acción vencida`}
          className="flex items-center gap-2 rounded-full border border-ui-warning-border bg-ui-warning-soft px-3 py-2 text-sm font-semibold text-ui-warning shadow-lg"
          href="/recovery/sales?vence=vencido"
          role="status"
        >
          <span aria-hidden="true">⏰</span>
          <span>{recoveryOverdue}</span>
          <span className="hidden sm:inline">recupero(s) vencido(s)</span>
        </Link>
      ) : null}
      {agendaDue > 0 ? (
        <Link
          aria-label={`${agendaDue} llamadas acordadas vencidas o en los próximos quince minutos`}
          className="flex items-center gap-2 rounded-full border border-ui-warning-border bg-ui-warning-soft px-3 py-2 text-sm font-semibold text-ui-warning shadow-lg"
          href="/recovery/agenda"
          role="status"
        >
          <span aria-hidden="true">📞</span>
          <span>{agendaDue}</span>
          <span className="hidden sm:inline">llamada(s) acordada(s) por atender</span>
        </Link>
      ) : null}
    </div>
  );
}
