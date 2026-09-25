import Link from "next/link";

import { formatCount } from "@repo/ui/format";
import { PageHeader } from "@repo/ui/page-header";
import {
  internalRecoveryDueFilterOptions,
  salesRecoveryOpenStatusOptions,
  salesRecoveryPriorityOptions,
  salesRecoveryReasonOptions,
  salesRecoveryResolvedStatusOptions,
  salesRecoveryViewOptions,
} from "@repo/validation";

import { CampaignDraftProvider, GuardedLink } from "./campaign-draft-context";
import { QueueFilters } from "./queue-filters";
import { SalesRecoveryRow } from "./sales-recovery-row";

import type {
  SalesRecoveryCaseItem,
  SalesRecoveryInboxData,
  SalesRecoveryInboxFilters,
} from "../server/get-sales-recovery-inbox";

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

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

/**
 * Recupero de ventas — SPEC-041 y SPEC-068. Primero lo caliente (ventas de
 * los últimos 7 días), con la tarjeta de «Mi día»; lo antiguo, plegado al
 * final, sin ruido. Quien reparte ve arriba cuánto tiene cada asesor sin
 * llamar: antes las calientes iban mezcladas con las antiguas, todas en
 * ámbar, en una tabla que no cabía.
 */
export function SalesRecoveryInbox({ data }: { data: SalesRecoveryInboxData }) {
  const { totals, filters, pagination } = data;
  const resolvedView = filters.view === "resueltos";
  const anyFilter =
    filters.due !== null ||
    filters.status !== null ||
    filters.priority !== null ||
    filters.reason !== null ||
    filters.q !== "" ||
    filters.team !== "" ||
    filters.advisor !== "";

  const figures = [
    {
      label: "Calientes sin llamar",
      value: totals.hotNotCalled,
      tone: totals.hotNotCalled > 0 ? "text-ui-warning" : "text-ui-text",
    },
    {
      label: "Seguimientos vencidos",
      value: totals.hotFollowUpOverdue,
      tone: totals.hotFollowUpOverdue > 0 ? "text-ui-warning" : "text-ui-text",
    },
    {
      label: "Recuperadas este mes",
      value: totals.recoveredThisMonth,
      tone: totals.recoveredThisMonth > 0 ? "text-ui-success" : "text-ui-text",
    },
  ];

  return (
    <div className="ui-page-stack">
      {/* BR-014: sin subtítulo; las reglas, plegadas en «Cómo funciona». */}
      <PageHeader
        eyebrow={data.scopeLabel}
        meta={<span>Actualizado: {data.generatedAt}</span>}
        title="Recupero de ventas"
      />

      {/* BR-007: tres cifras de lo caliente, en una línea. */}
      <section
        aria-label="Resumen"
        className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-sm text-ui-muted"
      >
        {figures.map((figure) => (
          <span key={figure.label}>
            {figure.label}{" "}
            <strong className={`text-base tabular-nums ${figure.tone}`}>
              {formatCount(figure.value)}
            </strong>
          </span>
        ))}
        {totals.criticalUnassigned > 0 ? (
          <Link
            className="font-semibold text-ui-danger underline-offset-2 hover:underline"
            href={inboxHref(filters, {
              view: "abiertos",
              priority: "CRITICA",
              status: null,
              due: null,
            })}
          >
            {plural(
              totals.criticalUnassigned,
              "crítica sin asignar",
              "críticas sin asignar",
            )}
          </Link>
        ) : null}
      </section>

      {/* BR-006: por asesor, para quien reparte. */}
      {data.byAdvisor.length > 0 && !resolvedView ? (
        <section aria-labelledby="por-asesor" className="grid gap-2">
          <h2
            className="text-sm font-semibold text-ui-text"
            id="por-asesor"
          >
            Por asesor
          </h2>
          <ul className="divide-y divide-ui-border rounded-lg border border-ui-border bg-ui-surface text-sm">
            {data.byAdvisor.map((advisor) => {
              const selected =
                advisor.userId !== null && filters.advisor === advisor.userId;
              return (
                <li
                  className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2 ${selected ? "bg-ui-accent-soft" : ""}`}
                  key={advisor.userId ?? "sin-responsable"}
                >
                  {advisor.userId ? (
                    <Link
                      className="min-w-48 font-medium text-ui-text underline-offset-2 hover:underline"
                      href={inboxHref(filters, {
                        view: "abiertos",
                        advisor: selected ? "" : advisor.userId,
                      })}
                    >
                      {advisor.name}
                    </Link>
                  ) : (
                    <span className="min-w-48 font-medium text-ui-danger">
                      {advisor.name}
                    </span>
                  )}
                  <span
                    className={
                      advisor.hotNotCalled > 0
                        ? "font-semibold text-ui-warning"
                        : "text-ui-muted"
                    }
                  >
                    {formatCount(advisor.hotNotCalled)} de{" "}
                    {formatCount(advisor.hotTotal)} calientes sin llamar
                  </span>
                  {advisor.hotFollowUpOverdue > 0 ? (
                    <span className="text-ui-warning">
                      {plural(
                        advisor.hotFollowUpOverdue,
                        "seguimiento vencido",
                        "seguimientos vencidos",
                      )}
                    </span>
                  ) : null}
                  <span className="text-ui-muted">
                    {plural(advisor.coldTotal, "antigua", "antiguas")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <QueueFilters
        basePath="/recovery/sales"
        moreFilters
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
                    options: internalRecoveryDueFilterOptions,
                  },
                ]),
          ],
        }}
        resultLabel={
          resolvedView
            ? plural(pagination.total, "caso resuelto", "casos resueltos")
            : `${plural(data.hotCases.length, "caliente", "calientes")} · ${plural(pagination.total, "antigua", "antiguas")}`
        }
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

      <details className="rounded-lg border border-ui-border bg-ui-surface text-sm">
        <summary className="cursor-pointer px-4 py-3 font-semibold text-ui-text">
          Cómo funciona
        </summary>
        <div className="grid gap-1 border-t border-ui-border p-4 text-ui-muted">
          <p>
            Aquí están las ventas propias caídas o no entregadas que todavía
            pueden salvarse. Hay dos horas desde que la venta se cayó para la
            primera llamada.
          </p>
          <p>
            Calientes son las ventas de los últimos 7 días: van primero. Las
            antiguas siguen siendo una oportunidad, pero no compiten con ellas.
          </p>
          <p>
            Una venta crítica nunca vuelve a quien la vendió; el resto se queda
            con su asesor el primer día.
          </p>
        </div>
      </details>

      {/* BR-090: una sola gestión abierta a la vez en toda la bandeja. */}
      <CampaignDraftProvider>
        {resolvedView ? (
          <CaseList
            empty="Ningún caso resuelto coincide con estos filtros."
            items={data.cases}
            advisors={data.advisorOptions} canAssign={false} resolvedView={resolvedView}
          />
        ) : (
          <>
            <section aria-labelledby="calientes" className="grid gap-2">
              <h2
                className="flex items-baseline gap-2 text-sm font-semibold text-ui-text"
                id="calientes"
              >
                Calientes · ventas de los últimos 7 días
                <span className="text-xs font-medium text-ui-soft">
                  {formatCount(data.hotCases.length)}
                </span>
              </h2>
              <CaseList
                empty={
                  anyFilter
                    ? "Ninguna venta caliente coincide con estos filtros."
                    : "No hay ventas calientes por recuperar. Las nuevas caídas aparecerán aquí solas."
                }
                items={data.hotCases}
                advisors={data.advisorOptions} canAssign={data.canAssign} resolvedView={resolvedView}
              />
            </section>

            {/* BR-016: lo antiguo, plegado al final, como en «Mi día». */}
            {pagination.total > 0 ? (
              <details
                className="rounded-lg border border-ui-border bg-ui-surface"
                open={pagination.page > 1 || undefined}
              >
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ui-text">
                  Ventas antiguas por recuperar{" "}
                  <span className="text-xs font-medium text-ui-soft">
                    {formatCount(pagination.total)}
                  </span>
                  <span className="block text-xs font-normal text-ui-muted">
                    Ventas de hace más de 7 días. Siguen siendo una
                    oportunidad, pero lo caliente va primero.
                  </span>
                </summary>
                <div className="grid gap-2 border-t border-ui-border p-3">
                  <CaseList
                    empty=""
                    items={data.cases}
                    advisors={data.advisorOptions} canAssign={data.canAssign} resolvedView={resolvedView}
                  />
                </div>
              </details>
            ) : null}
          </>
        )}

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
              Página {pagination.page} de {pagination.totalPages}
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
    </div>
  );
}

function CaseList({
  items,
  empty,
  advisors,
  canAssign,
  resolvedView,
}: {
  items: SalesRecoveryCaseItem[];
  empty: string;
  advisors: SalesRecoveryInboxData["advisorOptions"];
  canAssign: boolean;
  resolvedView: boolean;
}) {
  if (items.length === 0) {
    return empty ? (
      <p className="rounded-lg border border-ui-border bg-ui-surface px-4 py-6 text-center text-sm text-ui-muted">
        {empty}
      </p>
    ) : null;
  }

  return (
    <ol className="grid gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <SalesRecoveryRow
            advisors={advisors}
            canAssign={canAssign}
            item={item}
            resolvedView={resolvedView}
          />
        </li>
      ))}
    </ol>
  );
}
