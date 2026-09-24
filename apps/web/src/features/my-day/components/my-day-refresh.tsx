"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** BR-015: el ritmo del aviso actual de citas. */
const refreshMs = 60_000;

/**
 * «Mi día» se vuelve a leer al volver a la pestaña —el asesor alterna con
 * DITO y WhatsApp— y cada minuto mientras está visible. `router.refresh`
 * conserva el estado del navegador: el bloque plegado y la posición.
 */
export function MyDayRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refreshIfVisible, refreshMs);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  return null;
}
