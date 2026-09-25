"use client";

import { useRouter } from "next/navigation";

/**
 * Ir a una fecha de la agenda al elegirla (SPEC-066 BR-013). Antes había que
 * pulsar «Ir» después de elegir el día: un paso de más para una intención
 * que ya estaba clara. El resto del contexto (vista, búsqueda, estado) viaja
 * en `baseQuery`.
 */
export function AgendaDateJump({
  value,
  baseQuery,
}: {
  value: string;
  baseQuery: string;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Ir a la fecha</span>
      <input
        className="rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-1.5 text-sm text-ui-text"
        onChange={(event) => {
          const fecha = event.target.value;
          if (!fecha) return;
          const query = new URLSearchParams(baseQuery);
          query.set("fecha", fecha);
          router.push(`/recovery/agenda?${query.toString()}`);
        }}
        type="date"
        defaultValue={value}
        // Al cambiar de período la fecha viene del servidor: se remonta.
        key={value}
      />
    </label>
  );
}
