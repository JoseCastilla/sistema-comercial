"use client";

import { useEffect } from "react";

/** Marca al usuario como visto cada 3 minutos para el reparto (SPEC-054 BR-005). */
export function PresencePing() {
  useEffect(() => {
    const ping = () => void fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => undefined);
    ping();
    const timer = setInterval(ping, 3 * 60_000);
    return () => clearInterval(timer);
  }, []);
  return null;
}
