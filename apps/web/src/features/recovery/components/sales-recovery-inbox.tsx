import Link from "next/link";

import { formatCount } from "@repo/ui/format";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import {
  internalRecoveryDueOptions,
  salesRecoveryOpenStatusOptions,
  salesRecoveryPriorityOptions,
  salesRecoveryReasonOptions,
  salesRecoveryResolvedStatusOptions,
  salesRecoveryViewOptions,
} from "@repo/validation";

import { CampaignDraftProvider, GuardedLink } from "./campaign-draft-context";
import { QueueFilters } from "./queue-filters";
import {
  SalesRecoveryRow,
  salesRecoveryColumnCount,
} from "./sales-recovery-row";

import type {
  SalesRecoveryInboxData,
  SalesRecoveryInboxFilters,
} from "../server/get-sales-recovery-inbox";
import type { InternalRecoveryDue } from "@repo/validation";

const dueLabels = Object.fromEntries(
  internalRecoveryDueOptions.map((option) => [option.value, option.label]),
) as Record<InternalRecoveryDue, string>;
const dueHints = Object.fromEntries(
  internalRecoveryDueOptions.map((option) => [option.value, option.hint]),
) as Record<InternalRecoveryDue, string>;

/**
 * Enlace a la bandeja con los filtros vigentes y lo que cambie. Los nombres
 * de los parámetros son los que emite la barra de filtros.
 */
function inboxHref(
  filters: SalesRecoveryInboxFilters,
  overrides: Partial<SalesRecoveryInboxFilters> & { page?: number } = {},
): string {
  const next = { ...filters, ...overrides };
  const parameters = new URLSearchParams();

  if (next.view === "resueltos") parameters.set("view", "resueltos");
  if (next.q) parameters.set("q", next.q);
  if (next.team) parameters.set("team", next.team);
  if (next.advisor) parameters.set("advisor", next.advisor);
  if (next.priority) parameters.set("prioridad", next.priority);
  if (next.reason) parameters.set("motivo", next.reason);
  if (next.status) parameters.set("estado", next.status);
  if (next.due) parameters.set("vence", next.due);
  if (overrides.page && overrides.page > 1) {
    parameters.set("page", String(overrides.page));
  }

  const query = parameters.toString();

  return query ? `/recovery/sales?${query}` : "/recovery/sales";
}

export function SalesRecoveryInbox({ data }: { data: SalesRecoveryInboxData }) {
  const { totals, filters, pagination } = data;
  const resolvedView = filters.view === "resueltos";
  const narrowed =
    resolvedView || filters.due !== null || filters.status !== null;
  const anyFilter =
    narrowed ||
    filters.priority !== null ||
    filters.reason !== null ||
    filters.q !== "" ||
    filters.team !== "" ||
    filters.advisor !== "";

  return (
    <div className="ui-page-stack">
      <PageHeader
        description="Ventas propias caídas o no entregadas que todavía pueden salvarse. El primer contacto vence a las dos horas de que la venta se cayó."
        eyebrow={data.scopeLabel}
        meta={<span>Actualizado: {data.generatedAt}</span>}
        title="Recupero de ventas"
      />

      <MetricGroup label="Resumen del recupero de ventas">
        <Metric
          emphasis="hero"
          hint="De nuestras propias ventas"
          href={
            narrowed
              ? inboxHref(filters, {
                  view: "abiertos",
                  due: null,
                  status: null,
                })
              : undefined
          }
          label="Casos abiertos"
          value={totals.open}
        />
        <Metric
          hint={dueHints.primer_contacto}
          href={inboxHref(filters, {
            view: "abiertos",
            due: "primer_contacto",
            status: null,
          })}
          label={dueLabels.primer_contacto}
          tone={totals.firstContactOverdue > 0 ? "warning" : "neutral"}
          value={totals.firstContactOverdue}
        />
        <Metric
          hint={dueHints.seguimiento}
          href={inboxHref(filters, {
            view: "abiertos",
            due: "seguimiento",
            status: null,
          })}
          label={dueLabels.seguimiento}
          tone={totals.followUpOverdue > 0 ? "warning" : "neutral"}
          value={totals.followUpOverdue}
        />
        <Metric
          hint={dueHints.agenda}
          href={inboxHref(filters, {
            view: "abiertos",
            due: "agenda",
            status: null,
          })}
          label={dueLabels.agenda}
          tone={totals.agendaOverdue > 0 ? "warning" : "neutral"}
          value={totals.agendaOverdue}
        />
        <Metric
          hint="El supervisor debe asignarlas a otro asesor"
          label="Críticas sin asignar"
          tone={totals.criticalUnassigned > 0 ? "danger" : "neutral"}
          value={totals.criticalUnassigned}
        />
        <Metric
          hint="Con orden nueva vinculada"
          label="Recuperadas este mes"
          tone="success"
          value={totals.recoveredThisMonth}
        />
      </MetricGroup>

      <section className="performance-panel">
        <header className="performance-panel__header">
          <div>
            <p className="performance-panel__eyebrow">
              {resolvedView ? "Historial" : "Cola de trabajo"}
            </p>
            <h2>
              {resolvedView
                ? `Resueltos: ${formatCount(pagination.total)} ${pagination.total === 1 ? "caso" : "casos"}`
                : filters.due
                  ? `${dueLabels[filters.due]}: ${formatCount(pagination.total)} ${pagination.total === 1 ? "caso" : "casos"}`
                  : "Casos por prioridad"}
            </h2>
            <p>
              {resolvedView ? (
                <>
                  Recuperadas y perdidas del alcance actual, lo más reciente
                  primero.{" "}
                  <Link
                    href={inboxHref(filters, {
                      view: "abiertos",
                      status: null,
                    })}
                  >
                    Volver a los abiertos
                  </Link>
                </>
              ) : filters.due ? (
                <>
                  Solo los casos con este vencimiento, en el orden de la cola.{" "}
                  <Link href={inboxHref(filters, { due: null })}>
                    Ver todos los casos
                  </Link>
                </>
              ) : (
                "Crítica nunca vuelve a quien originó la venta; el resto se queda con su asesor el primer día. Lo vencido va primero dentro de cada prioridad. La gestión se registra desde la fila."
              )}
            </p>
          </div>
        </header>

        <QueueFilters
          basePath="/recovery/sales"
          options={{
            views: [...salesRecoveryViewOptions],
            teams: data.teamOptions ?? undefined,
            allowNoTeam: false,
            advisors:
              data.advisorFilterOptions.length > 0
                ? data.advisorFilterOptions
                : undefined,
            extras: [
              {
                key: "prioridad",
                label: "Prioridad",
                emptyLabel: "Todas",
                options: salesRecoveryPriorityOptions,
              },
              {
                key: "motivo",
                label: "Motivo",
                emptyLabel: "Todos",
                options: salesRecoveryReasonOptions,
              },
              {
                key: "estado",
                label: "Estado",
                emptyLabel: "Todos",
                options: resolvedView
                  ? salesRecoveryResolvedStatusOptions
                  : salesRecoveryOpenStatusOptions,
              },
              ...(resolvedView
                ? []
                : [
                    {
                      key: "vence",
                      label: "Vencimiento",
                      emptyLabel: "Cualquiera",
                      options: internalRecoveryDueOptions,
                    },
                  ]),
            ],
          }}
          resultLabel={`${formatCount(pagination.total)} caso(s) cumplen el filtro.`}
          searchLabel="Buscar cliente o venta"
          searchPlaceholder="Nombre, DNI, teléfono o código de venta"
          values={{
            q: filters.q,
            view: filters.view,
            team: filters.team,
            department: "",
            plan: "",
            advisor: filters.advisor,
            extra: {
              prioridad: filters.priority ?? "",
              motivo: filters.reason ?? "",
              estado: filters.status ?? "",
              vence: filters.due ?? "",
            },
          }}
        />

        {/* BR-090: una sola gestión abierta a la vez; el borrador vive por
            encima de las filas y la paginación pregunta antes de perderlo. */}
        <CampaignDraftProvider>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Venta</th>
                  <th>Motivo</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                  <th>Última gestión</th>
                  <th>{resolvedView ? "Resultado" : "Próxima acción"}</th>
                </tr>
              </thead>
              <tbody>
                {data.cases.map((item) => (
                  <SalesRecoveryRow
                    advisors={data.advisorOptions}
                    canAssign={data.canAssign}
                    item={item}
                    key={item.id}
                    resolvedView={resolvedView}
                  />
                ))}
                {data.cases.length === 0 ? (
                  <tr>
                    <td
                      className="reconciliation-empty"
                      colSpan={salesRecoveryColumnCount}
                    >
                      {resolvedView
                        ? "Ningún caso resuelto coincide con estos filtros."
                        : anyFilter
                          ? "Ningún caso abierto coincide con estos filtros. Prueba con menos o límpialos."
                          : "No hay ventas en recuperación. Las nuevas caídas aparecerán aquí solas."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 ? (
            <nav aria-label="Páginas de casos" className="ui-pagination">
              {pagination.page > 1 ? (
                <GuardedLink
                  className="ui-pagination__link"
                  href={inboxHref(filters, { page: pagination.page - 1 })}
                >
                  Anterior
                </GuardedLink>
              ) : (
                <span />
              )}

              <span className="ui-pagination__status">
                Página {pagination.page} de {pagination.totalPages} ·{" "}
                {formatCount(pagination.total)} casos
              </span>

              {pagination.page < pagination.totalPages ? (
                <GuardedLink
                  className="ui-pagination__link"
                  href={inboxHref(filters, { page: pagination.page + 1 })}
                >
                  Siguiente
                </GuardedLink>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </CampaignDraftProvider>
      </section>
    </div>
  );
}
