const portalUrl = "https://checatuslineas.osiptel.gob.pe/";

export function ChecaTusLineasFrame() {
  return (
    <section className="overflow-hidden rounded-2xl border border-ui-border bg-ui-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-subtle px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-ui-text">Líneas del cliente</h2>
          <p className="mt-1 text-xs leading-5 text-ui-muted">
            El asesor selecciona el documento y completa la consulta en el
            portal oficial.
          </p>
        </div>
        <ExternalPortalActions url={portalUrl} />
      </div>

      <div className="bg-white p-2 sm:p-3">
        <div className="relative h-[72vh] min-h-[36rem] overflow-hidden rounded-xl border border-ui-border bg-white">
          <iframe
            className="absolute left-1/2 -top-[16rem] h-[calc(72vh+16rem)] min-h-[52rem] w-full -translate-x-1/2 border-0 bg-white sm:-top-[24rem] sm:h-[calc(72vh+24rem)] sm:min-h-[60rem] lg:-top-[41rem] lg:h-[calc(72vh+41rem)] lg:min-h-[77rem] lg:min-w-[64rem]"
            id="checa-tus-lineas-frame"
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            src={portalUrl}
            title="Checa tus líneas"
          />
        </div>
      </div>
    </section>
  );
}

function ExternalPortalActions({ url }: { url: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="ui-status-badge" data-tone="info">
        Portal autorizado
      </span>
      <a
        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ui-border-strong bg-ui-surface px-4 text-sm font-semibold text-ui-text transition hover:bg-ui-subtle"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        Abrir fuera del sistema
        <span aria-hidden="true" className="ml-2">
          ↗
        </span>
      </a>
    </div>
  );
}
