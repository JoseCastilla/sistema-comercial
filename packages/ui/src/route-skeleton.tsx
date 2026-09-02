/**
 * Silueta de carga para los límites de Suspense de cada ruta.
 *
 * Con el shell montado en un layout, `loading.tsx` solo reemplaza el contenido:
 * la navegación, el encabezado y el tema siguen en pantalla. El esqueleto
 * reproduce la forma de la vista —encabezado, barra de filtros, filas— para
 * que el salto al contenido real no mueva el layout.
 */
export function RouteSkeleton({
  filters = true,
  metrics = 0,
  rows = 8,
}: {
  /** Reserva el alto de la barra de filtros y búsqueda. */
  filters?: boolean;
  /** Cantidad de tarjetas de métrica sobre la tabla. */
  metrics?: number;
  /** Filas de tabla a simular. */
  rows?: number;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="ui-page-stack animate-pulse"
      role="status"
    >
      <span className="sr-only">Cargando contenido…</span>

      <div className="space-y-2">
        <div className="h-7 w-64 max-w-full rounded-md bg-ui-subtle" />
        <div className="h-4 w-96 max-w-full rounded bg-ui-subtle" />
      </div>

      {metrics > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: metrics }, (_, index) => (
            <div
              className="h-24 rounded-lg border border-ui-border bg-ui-surface"
              key={index}
            />
          ))}
        </div>
      ) : null}

      {filters ? (
        <div className="flex flex-wrap gap-2 rounded-lg border border-ui-border bg-ui-surface p-3">
          <div className="h-9 w-40 rounded-md bg-ui-subtle" />
          <div className="h-9 w-32 rounded-md bg-ui-subtle" />
          <div className="h-9 min-w-48 flex-1 rounded-md bg-ui-subtle" />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-ui-border bg-ui-surface">
        <div className="h-11 border-b border-ui-border bg-ui-subtle" />
        {Array.from({ length: rows }, (_, index) => (
          <div
            className="flex items-center gap-4 border-b border-ui-border px-4 py-3 last:border-b-0"
            key={index}
          >
            <div className="h-4 w-24 rounded bg-ui-subtle" />
            <div className="h-4 flex-1 rounded bg-ui-subtle" />
            <div className="h-4 w-20 rounded bg-ui-subtle" />
            <div className="h-6 w-24 rounded-full bg-ui-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
