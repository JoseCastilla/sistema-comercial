import Form from "next/form";
import Link from "next/link";

import { formatCount, formatMoneyFromCents } from "@repo/ui/format";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";

import type {
  PerformanceReconciliationData,
  ReconciliationFilter,
} from "../reconciliation.types";

const operationLabels: Record<string, string> = {
  PORT_POSTPAID: "Portabilidad postpago",
  PORT_PREPAID: "Portabilidad prepago",
  NEW_LINE: "Alta nueva",
  UNKNOWN: "Sin clasificar",
};

function money(cents: number): string {
  return formatMoneyFromCents(cents);
}

function reconciliationHref(
  data: PerformanceReconciliationData,
  input: { page?: number; reason?: ReconciliationFilter },
): string {
  const parameters = new URLSearchParams({
    month: data.month,
    reason: input.reason ?? data.filter,
  });
  if (data.teamFilter !== "ALL") parameters.set("team", data.teamFilter);
  if (data.agentFilter !== "ALL") parameters.set("agent", data.agentFilter);
  if ((input.page ?? 1) > 1) parameters.set("page", String(input.page));
  return `/performance/reconciliation?${parameters.toString()}`;
}

function orderHref(
  data: PerformanceReconciliationData,
  orderCode: string,
): string {
  const parameters = new URLSearchParams({
    period: "RANGE",
    from: data.from,
    to: data.to,
    status: "ALL",
    q: orderCode,
  });
  if (data.teamFilter !== "ALL") parameters.set("team", data.teamFilter);
  return `/orders?${parameters.toString()}`;
}

export function PerformanceReconciliation({
  data,
}: {
  data: PerformanceReconciliationData;
}) {
  return (
    <div className="ui-page-stack">
      <PageHeader
        description="Explica qué órdenes generan comisión fija, cuáles hay que corregir y cuáles todavía están en camino."
        eyebrow={data.scopeLabel}
        meta={<span>Actualizado: {data.generatedAt}</span>}
        title={
          data.role === "AGENT"
            ? "Por qué me pagan cada venta"
            : "Detalle de comisiones"
        }
      />

      <div className="reconciliation-return">
        <Link
          href={`/performance?month=${data.month}${data.agentFilter === "ALL" ? "" : `&agent=${data.agentFilter}`}`}
        >
          ← Volver a rendimiento
        </Link>
        <span>Los bonos se calculan por asesor, no venta por venta.</span>
      </div>

      <section className="performance-controls ui-surface">
        <div>
          <p className="performance-controls__eyebrow">
            Mes que estás revisando
          </p>
          <p className="performance-controls__month">{data.monthLabel}</p>
        </div>
        <Form
          action="/performance/reconciliation"
          className="performance-filter"
        >
          <label>
            <span>Mes</span>
            <input
              defaultValue={data.month}
              max={data.currentMonth}
              name="month"
              type="month"
            />
          </label>
          {data.teamOptions.length > 0 ? (
            <label>
              <span>Equipo</span>
              <select defaultValue={data.teamFilter} name="team">
                <option value="ALL">
                  {data.role === "SUPERVISOR"
                    ? "Mis equipos"
                    : "Toda la organización"}
                </option>
                {data.teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {data.agentFilter === "ALL" ? null : (
            <input name="agent" type="hidden" value={data.agentFilter} />
          )}
          <label>
            <span>Resultado</span>
            <select defaultValue={data.filter} name="reason">
              <option value="ALL">Todos los resultados</option>
              <option value="PAYABLE">Ya generan comisión</option>
              <option value="NOT_ACTIVATED">
                Entregadas, falta activarlas
              </option>
              <option value="NOT_DELIVERED">Pendientes de entrega</option>
              <option value="UNASSIGNED">Sin asesor responsable</option>
              <option value="UNKNOWN_OPERATION">
                Falta clasificar la operación
              </option>
              <option value="CANCELLED">Canceladas</option>
              <option value="NEW_LINE_NO_COMMISSION">
                Altas nuevas (no pagan comisión)
              </option>
            </select>
          </label>
          <button type="submit">Aplicar</button>
        </Form>
      </section>

      <MetricGroup label="Resumen de conciliación">
        <Metric
          emphasis="hero"
          hint={`${formatCount(data.pagination.filteredTotal)} coinciden con el filtro`}
          label="Órdenes del mes"
          value={data.totals.orders}
        />
        <Metric
          hint="Entregadas, cerradas y con asesor"
          label="Portabilidades pagables"
          tone="success"
          value={data.totals.payable}
        />
        {data.showTotals ? (
          <Metric
            hint="No incluye bonos"
            label="Comisión fija estimada"
            value={money(data.totals.baseCommissionCents)}
          />
        ) : null}
      </MetricGroup>

      <section className="performance-panel">
        <header className="performance-panel__header">
          <div>
            <p className="performance-panel__eyebrow">Detalle por orden</p>
            <h2>Detalle del cálculo</h2>
            <p>Toca la orden para abrir el pedido.</p>
          </div>
        </header>
        <div className="ui-table-wrap">
          <table className="ui-table ui-table--linked">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Asesor</th>
                <th>Operación</th>
                <th>Resultado</th>
                {data.showLineAmounts ? (
                  <th data-numeric>Comisión fija</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <Link href={orderHref(data, line.orderCode)}>
                      {line.orderCode}
                    </Link>
                    <small>{line.registeredAtLabel}</small>
                  </td>
                  <td>{line.customerName}</td>
                  <td>
                    <strong>{line.agentName}</strong>
                    <small>{line.teamName ?? "Sin equipo"}</small>
                  </td>
                  <td>{operationLabels[line.operation] ?? line.operation}</td>
                  <td>
                    <span
                      className="reconciliation-reason"
                      data-reason={line.reason}
                    >
                      {line.reasonLabel}
                    </span>
                  </td>
                  {data.showLineAmounts ? (
                    <td data-numeric>
                      <strong>{money(line.baseCommissionCents)}</strong>
                    </td>
                  ) : null}
                </tr>
              ))}
              {data.lines.length === 0 ? (
                <tr>
                  <td
                    className="reconciliation-empty"
                    colSpan={data.showLineAmounts ? 6 : 5}
                  >
                    No hay órdenes para este resultado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {data.pagination.totalPages > 1 ? (
          <nav
            className="reconciliation-pagination"
            aria-label="Paginación de conciliación"
          >
            {data.pagination.page > 1 ? (
              <Link
                href={reconciliationHref(data, {
                  page: data.pagination.page - 1,
                })}
              >
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <small>
              Página {data.pagination.page} de {data.pagination.totalPages}
            </small>
            {data.pagination.page < data.pagination.totalPages ? (
              <Link
                href={reconciliationHref(data, {
                  page: data.pagination.page + 1,
                })}
              >
                Siguiente
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
