import Link from "next/link";

import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import type { ContactOrigin, CustomerRelation } from "@/generated/prisma/enums";
import { localParts } from "@/lib/time";
import { requireRole } from "@/server/auth/access";
import { loadResultsInput } from "@/server/opportunities/queries";
import { buildResults, GROUP_LABELS, groupOf, type ResultFigures, type ResultGroup } from "@/server/opportunities/results";
import { ORIGIN_LABELS, RELATION_LABELS, soles } from "@/server/opportunities/rules";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(search: Search, key: string): string {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Inicio del día en Lima como instante UTC. */
function dayStart(value: string, offsetDays = 0): Date {
  const date = new Date(`${value}T00:00:00-05:00`);
  return offsetDays ? new Date(date.getTime() + offsetDays * 86_400_000) : date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const ORDER_OF_GROUPS: ResultGroup[] = ["CAMPAIGN", "BASE", "UNKNOWN"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await requireRole("OWNER", "SUPERVISOR", "BACKOFFICE");
  const search = await searchParams;

  const today = localParts(new Date(), access.timezone);
  const desde = isDate(one(search, "desde")) ? one(search, "desde") : `${today.year}-${pad(today.month)}-01`;
  const lastDay = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
  const hasta = isDate(one(search, "hasta")) ? one(search, "hasta") : `${today.year}-${pad(today.month)}-${pad(lastDay)}`;

  const from = dayStart(desde);
  const to = dayStart(hasta, 1);
  const { rows, groups, total } = buildResults(await loadResultsInput(access.organizationId, from, to));

  /** Enlace al embudo con la misma cohorte (mismo período de apertura). */
  function pipelineHref(origin: ContactOrigin | null, relation: CustomerRelation | null, extra: Record<string, string> = {}): string {
    const query = new URLSearchParams({ vista: "lista", cerradas: "1", desde, hasta, ...extra });
    if (origin) query.set("origen", origin);
    if (relation) query.set("relacion", relation);
    return `/pipeline?${query.toString()}`;
  }

  function FigureCells({
    figures,
    origin,
    relation,
    extra = {},
  }: {
    figures: ResultFigures;
    origin: ContactOrigin | null;
    relation: CustomerRelation | null;
    extra?: Record<string, string>;
  }) {
    const link = (value: number, more: Record<string, string> = {}) =>
      value === 0 ? <span>0</span> : <Link href={pipelineHref(origin, relation, { ...extra, ...more })}>{value}</Link>;
    return (
      <>
        <td>{link(figures.opportunities)}</td>
        <td>{link(figures.qualified, { alcanzo: "CALIFICADO" })}</td>
        <td>{link(figures.won, { etapa: "GANADA" })}</td>
        <td>{link(figures.lost, { etapa: "PERDIDA" })}</td>
        <td>{figures.ordersEntered}</td>
        <td>{figures.ordersDelivered}</td>
        <td>{figures.ordersActivated}</td>
        <td>{figures.ordersCancelled}</td>
        <td>{soles(figures.amountOrdered)}</td>
        <td>{soles(figures.amountConfirmed)}</td>
        <td>{soles(figures.amountSold)}</td>
      </>
    );
  }

  const hasData = total.opportunities > 0 || total.ordersEntered > 0;

  return (
    <div className="ui-page-stack">
      <PageHeader
        description="Qué trajo cada venta: lo que llegó por campaña (anuncios y difusiones) frente a lo que salió de la base (asesores, referidos, orgánico). La cohorte se arma por la fecha en que se abrió la oportunidad."
        eyebrow="CRM"
        title="Resultados"
      />

      <form action="/reports" className="ui-surface ui-surface--padded ui-form-row" method="get">
        <label className="ui-field ui-form-row__fixed">
          <span className="ui-field__label">Desde</span>
          <input className="ui-control" defaultValue={desde} name="desde" type="date" />
        </label>
        <label className="ui-field ui-form-row__fixed">
          <span className="ui-field__label">Hasta</span>
          <input className="ui-control" defaultValue={hasta} name="hasta" type="date" />
        </label>
        <button className="ui-button ui-button--secondary" type="submit">
          Ver período
        </button>
      </form>

      {!hasData ? (
        <EmptyState
          description="Esta tabla se llena con las oportunidades abiertas en el período y con los pedidos que se les vinculan. Abre conversaciones y registra pedidos con su referencia: entonces se puede decir qué campaña pagó cada venta."
          title="Sin datos en este período"
        />
      ) : (
        <>
          <MetricGroup label="Resumen del período">
            <Metric emphasis="hero" hint="Cargo fijo de los pedidos activados" label="Vendido efectivo" value={soles(total.amountSold)} />
            <Metric hint="Abiertas en el período" label="Oportunidades" value={total.opportunities} />
            <Metric hint="Con pedido vinculado" label="Ganadas" value={total.won} />
            <Metric hint="Entregados y no cancelados" label="Confirmado" value={soles(total.amountConfirmed)} />
          </MetricGroup>

          <SectionPanel
            description="Cada cifra de oportunidades abre el embudo con el mismo filtro. Los pedidos sin oportunidad se cuentan como origen desconocido."
            title="Origen y relación con el cliente"
          >
            <div className="ui-table-wrap">
              <table className="ui-table ui-table--figures">
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>Relación</th>
                    <th>Oportunidades</th>
                    <th>Calificadas</th>
                    <th>Ganadas</th>
                    <th>Perdidas</th>
                    <th>Ingresados</th>
                    <th>Entregados</th>
                    <th>Activados</th>
                    <th>Cancelados</th>
                    <th>Pedido</th>
                    <th>Confirmado</th>
                    <th>Vendido efectivo</th>
                  </tr>
                </thead>
                {ORDER_OF_GROUPS.map((group) => {
                  const groupRows = rows.filter((row) => groupOf(row.origin) === group);
                  if (groupRows.length === 0) return null;
                  return (
                    <tbody key={group}>
                      <tr>
                        <th colSpan={2} scope="row">
                          {GROUP_LABELS[group]}
                        </th>
                        <FigureCells extra={{ grupo: group }} figures={groups[group]} origin={null} relation={null} />
                      </tr>
                      {groupRows.map((row) => (
                        <tr key={`${row.origin}:${row.relation ?? "-"}`}>
                          <td>{ORIGIN_LABELS[row.origin]}</td>
                          <td>{row.relation ? RELATION_LABELS[row.relation] : "Pedido sin oportunidad"}</td>
                          <FigureCells figures={row} origin={row.origin} relation={row.relation} />
                        </tr>
                      ))}
                    </tbody>
                  );
                })}
                <tfoot>
                  <tr>
                    <th colSpan={2} scope="row">
                      Total
                    </th>
                    <FigureCells figures={total} origin={null} relation={null} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="ui-field__hint">
              «Pedido» es el cargo fijo de todo lo ingresado; «confirmado», lo entregado que no se canceló; «vendido efectivo», lo que ya está activado. Los montos de
              pedidos sin oportunidad aparecen en la fila de Desconocido.
            </p>
          </SectionPanel>
        </>
      )}
    </div>
  );
}
