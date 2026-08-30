const portalUrl = "https://consulta.portabilidad.pe/";
const embeddedPortalUrl = "/tools/portability/embed";

export function PortabilityFrame() {
  return (
    <section className="overflow-hidden rounded-2xl border border-ui-border bg-ui-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-subtle px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-ui-text">
            Estado de numeración
          </h2>
          <p className="mt-1 text-xs leading-5 text-ui-muted">
            El asesor ingresa el número directamente en el portal autorizado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="ui-status-badge" data-tone="info">
            Portal autorizado
          </span>
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ui-border-strong bg-ui-surface px-4 text-sm font-semibold text-ui-text transition hover:bg-ui-subtle"
            href={portalUrl}
            rel="noreferrer"
            target="_blank"
          >
            Abrir fuera del sistema
            <span aria-hidden="true" className="ml-2">
              ↗
            </span>
          </a>
        </div>
      </div>

      <div className="bg-white p-2 sm:p-3">
        <iframe
          className="h-[72vh] min-h-[36rem] w-full rounded-xl border border-ui-border bg-white"
          id="portability-frame"
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          src={embeddedPortalUrl}
          title="Consulta portabilidad"
        />
      </div>
    </section>
  );
}
