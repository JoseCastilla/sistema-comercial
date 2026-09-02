"use client";

import { useEffect } from "react";

/**
 * Límite de error del segmento. Sin esto una consulta caída dejaba la pantalla
 * anterior congelada sin explicación; ahora el asesor ve qué pasó y puede
 * reintentar sin perder la navegación ni volver a iniciar sesión.
 */
export default function ToolsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fallo al cargar herramientas", error);
  }, [error]);

  return (
    <div className="ui-page-stack" role="alert">
      <div className="rounded-lg border border-ui-danger-border bg-ui-danger-soft p-6">
        <h1 className="text-lg font-semibold text-ui-danger">
          No pudimos cargar esta vista
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ui-muted">
          El servidor no respondió a tiempo o rechazó la consulta. Tus datos
          están a salvo: no se guardó ningún cambio.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-ui-soft">
            Referencia: {error.digest}
          </p>
        ) : null}
        <button
          className="ui-filter-submit mt-4"
          onClick={() => reset()}
          type="button"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
