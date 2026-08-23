"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function EscalationNotification({ role }: { role: string }) {
  const [count, setCount] = useState(0);
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
      // La bandeja seguirá disponible aunque la conexión en tiempo real falle.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const stream = new EventSource("/api/orders/stream");
    stream.addEventListener("order-change", refresh);
    return () => stream.close();
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
