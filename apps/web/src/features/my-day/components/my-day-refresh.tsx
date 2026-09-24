"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useCampaignDraft } from "@/features/recovery/components/campaign-draft-context";

/** BR-015: el ritmo del aviso actual de citas. */
const refreshMs = 60_000;

/**
 * «Mi día» se vuelve a leer al volver a la pestaña —el asesor alterna con
 * DITO y WhatsApp— y cada minuto mientras está visible. `router.refresh`
 * conserva el estado del navegador: el bloque plegado y la posición.
 *
 * Mientras hay una gestión abierta no se refresca: la lista se reordenaría
 * bajo las manos del asesor y la fila que está escribiendo podría cambiar de
 * sitio o desaparecer (la misma razón por la que la acción no revalida).
 */
export function MyDayRefresh() {
  const router = useRouter();
  const { editingId } = useCampaignDraft();

  useEffect(() => {
    if (editingId !== null) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refreshIfVisible, refreshMs);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [editingId, router]);

  return null;
}
