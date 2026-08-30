const portalUrl = "https://consulta.portabilidad.pe/";

export function PortabilityFrame() {
  return (
    <section className="rounded-2xl border border-ui-border bg-ui-surface p-6 shadow-sm sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-ui-subtle text-xl text-ui-accent"
        >
          ↗
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-ui-muted">
          Portal externo
        </p>
        <h2 className="mt-2 text-xl font-bold text-ui-text">
          Consulta estado de numeración
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ui-muted">
          Mientras coordinamos la integración con el regulador, la consulta se
          realizará directamente en el portal oficial. El asesor deberá
          completar allí el número y regresar al sistema comercial al terminar.
        </p>
        <a
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-ui-strong px-5 text-sm font-semibold text-ui-on-strong transition hover:bg-ui-strong"
          href={portalUrl}
          rel="noreferrer"
          target="_blank"
        >
          Abrir consulta portabilidad
          <span aria-hidden="true" className="ml-2">
            ↗
          </span>
        </a>
        <p className="mt-4 text-xs leading-5 text-ui-muted">
          El enlace abrirá una pestaña nueva en consulta.portabilidad.pe.
        </p>
      </div>
    </section>
  );
}
