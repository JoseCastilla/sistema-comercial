import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { requireManager } from "@/server/auth/access";
import { BROADCAST_STATUS_TEXT, exclusionText, RECIPIENT_STATUS_TEXT } from "@/server/broadcasts/rules";
import { broadcastResults, BroadcastError, listRecipients } from "@/server/broadcasts/service";

import { cancel, pause, resume } from "../actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(search: Search, key: string): string {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Cada cifra abre su lista: el nombre corto de la vista → estados que incluye. */
const VIEWS: Record<string, { title: string; statuses: string[] }> = {
  destinatarios: { title: "Todos los destinatarios", statuses: ["PENDING", "QUEUED", "SENT", "DELIVERED", "READ", "REPLIED", "FAILED", "CANCELLED"] },
  pendientes: { title: "Todavía no les sale", statuses: ["PENDING", "QUEUED"] },
  enviados: { title: "Ya salieron", statuses: ["SENT", "DELIVERED", "READ", "REPLIED"] },
  entregados: { title: "Les llegó", statuses: ["DELIVERED", "READ", "REPLIED"] },
  leidos: { title: "Lo leyeron", statuses: ["READ", "REPLIED"] },
  respondieron: { title: "Respondieron", statuses: ["REPLIED"] },
  fallidos: { title: "No les llegó", statuses: ["FAILED"] },
  excluidos: { title: "Quedaron fuera", statuses: ["EXCLUDED"] },
};

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Promoción",
  UTILITY: "Aviso",
  AUTHENTICATION: "Código de acceso",
};

export default async function BroadcastResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const access = await requireManager();
  const { id } = await params;
  const search = await searchParams;

  let results;
  try {
    results = await broadcastResults(access.organizationId, id);
  } catch (error) {
    if (error instanceof BroadcastError) notFound();
    throw error;
  }

  const view = one(search, "estado");
  const selected = VIEWS[view];
  const rows = selected ? await listRecipients(access.organizationId, id, selected.statuses) : [];
  const state = BROADCAST_STATUS_TEXT[results.status] ?? { label: results.status, tone: "neutral" as const, detail: "" };
  const link = (key: string) => `/broadcasts/${id}?estado=${key}`;
  const isOwner = access.role === "OWNER";
  const frozenByBrake = results.status === "PAUSED" && Boolean(results.pauseReason);

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={`${CATEGORY_LABEL[results.category] ?? results.category} con la plantilla «${results.templateName}».`}
        eyebrow="Difusiones"
        meta={<StatusBadge tone={state.tone}>{state.label}</StatusBadge>}
        title={results.name}
      />

      {results.pauseReason ? (
        <SectionPanel title="Por qué está pausada">
          <p>{results.pauseReason}</p>
          {frozenByBrake && !isOwner ? <p className="text-sm text-ui-muted">Se frenó sola: solo el dueño del negocio puede reanudarla.</p> : null}
        </SectionPanel>
      ) : null}

      <SectionPanel
        description="Cada cifra abre la lista de personas que hay detrás."
        title="Cómo le fue"
      >
        <MetricGroup label="Resultados de la difusión">
          <Metric emphasis="hero" href={link("destinatarios")} hint={`${results.excluded} quedaron fuera`} label="Destinatarios" value={results.recipients} />
          <Metric href={link("pendientes")} hideWhenZero hint="esperan su turno" label="Por salir" value={results.pending} />
          <Metric href={link("enviados")} label="Salieron" value={results.sent} />
          <Metric href={link("entregados")} label="Les llegó" value={results.delivered} />
          <Metric href={link("leidos")} label="Lo leyeron" value={results.read} />
          <Metric href={link("respondieron")} label="Respondieron" tone="success" value={results.replied} />
          <Metric href={link("fallidos")} hideWhenZero label="No les llegó" tone="danger" value={results.failed} />
          <Metric hideWhenZero hint="pidieron no recibir más" label="Se dieron de baja" tone="warning" value={results.optOuts} />
          <Metric hint="lo que cuestan los mensajes que salieron" label="Costo aprox." value={`S/ ${results.approximateCostPen.toFixed(2)}`} />
        </MetricGroup>
      </SectionPanel>

      <SectionPanel
        description="Lo que produjo en los 7 días siguientes a cada envío."
        title="Qué produjo"
      >
        <MetricGroup label="Efecto de la difusión">
          <Metric hint="llegaron a calificado o más" label="Oportunidades calificadas" value={results.qualifiedOpportunities} />
          <Metric label="Pedidos ingresados" value={results.ordersEntered} />
          <Metric label="Pedidos entregados" value={results.ordersDelivered} />
        </MetricGroup>
      </SectionPanel>

      {results.failuresByReason.length ? (
        <SectionPanel title="Por qué no llegaron">
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Motivo</th><th>Personas</th></tr></thead>
              <tbody>
                {results.failuresByReason.map((row) => (
                  <tr key={row.reason}><td>{row.reason}</td><td>{row.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionPanel>
      ) : null}

      {results.excludedByReason.length ? (
        <SectionPanel description="Reglas que no se pueden quitar." title="Por qué quedaron fuera">
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Motivo</th><th>Personas</th></tr></thead>
              <tbody>
                {results.excludedByReason.map((row) => (
                  <tr key={row.reason}><td>{row.reasonText}</td><td>{row.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p><Link className="ui-button ui-button--quiet" href={link("excluidos")}>Ver la lista completa</Link></p>
        </SectionPanel>
      ) : null}

      {selected ? (
        <SectionPanel
          aside={<Link className="ui-button ui-button--quiet" href={`/broadcasts/${id}`}>Cerrar lista</Link>}
          title={`${selected.title} (${rows.length})`}
        >
          {rows.length === 0 ? (
            <EmptyState description="No hay nadie en este estado todavía." title="Lista vacía" />
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead><tr><th>Persona</th><th>Teléfono</th><th>Estado</th><th>Detalle</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.contactId}>
                      <td>
                        <Link href={`/inbox?contacto=${row.contactId}`}>{row.contact.displayName ?? "Sin nombre"}</Link>
                        {row.contact.district ? <div className="text-xs text-ui-muted">{row.contact.district}</div> : null}
                      </td>
                      <td>{row.contact.phone ?? "—"}</td>
                      <td>{RECIPIENT_STATUS_TEXT[row.status] ?? row.status}</td>
                      <td className="text-xs text-ui-muted">
                        {row.status === "EXCLUDED"
                          ? exclusionText(row.exclusionReason)
                          : row.status === "FAILED"
                            ? row.message?.errorTitle ?? row.exclusionReason ?? "Meta no explicó el motivo"
                            : row.repliedAt
                              ? `Respondió el ${formatDateTime(row.repliedAt, access.timezone)}`
                              : formatDateTime(row.message?.sentAt ?? row.message?.createdAt ?? null, access.timezone)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>
      ) : null}

      <SectionPanel title="Qué puedes hacer">
        <div className="flex flex-wrap items-start gap-3">
          {results.status === "SCHEDULED" || results.status === "SENDING" ? (
            <ActionForm action={pause} className="flex items-center gap-2" submitLabel="Pausar" variant="secondary">
              <input name="id" type="hidden" value={id} />
              <input className="ui-control" name="reason" placeholder="Por qué la pausas" />
            </ActionForm>
          ) : null}
          {results.status === "PAUSED" && (isOwner || !frozenByBrake) ? (
            <ActionForm action={resume} className="flex items-center gap-2" submitLabel="Reanudar" variant="secondary">
              <input name="id" type="hidden" value={id} />
              <input className="ui-control" name="reason" placeholder="Por qué la reanudas" required={frozenByBrake} />
            </ActionForm>
          ) : null}
          {results.status !== "DONE" && results.status !== "CANCELLED" ? (
            <ActionForm
              action={cancel}
              className="flex items-center"
              confirm="Se detiene y no se retoma. ¿Cancelar la difusión?"
              submitLabel="Cancelar"
              variant="danger"
            >
              <input name="id" type="hidden" value={id} />
            </ActionForm>
          ) : null}
          <Link className="ui-button ui-button--quiet" href="/broadcasts">Volver a la lista</Link>
        </div>
        <p className="text-xs text-ui-muted">
          Programada para {formatDateTime(results.scheduledAt, access.timezone)}
          {results.startedAt ? ` · empezó el ${formatDateTime(results.startedAt, access.timezone)}` : ""}
          {results.finishedAt ? ` · terminó el ${formatDateTime(results.finishedAt, access.timezone)}` : ""}
        </p>
      </SectionPanel>
    </div>
  );
}
