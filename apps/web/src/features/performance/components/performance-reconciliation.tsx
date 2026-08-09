import Link from "next/link";

import { PageHeader } from "@repo/ui/page-header";

import type {
  PerformanceReconciliationData,
  ReconciliationFilter,
} from "../reconciliation.types";

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

const operationLabels: Record<string, string> = {
  PORT_POSTPAID: "Portabilidad postpago",
  PORT_PREPAID: "Portabilidad prepago",
  NEW_LINE: "Alta nueva",
  UNKNOWN: "Sin clasificar",
};

function money(cents: number): string {
  return currencyFormatter.format(cents / 100);
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
        description="Explica qué órdenes generan comisión base y cuáles requieren una corrección o todavía deben madurar."
        eyebrow="Control administrativo"
        meta={<span>Actualizado: {data.generatedAt}</span>}
        title="Conciliación de comisiones"
      />

      <div className="reconciliation-return">
        <Link href={`/performance?month=${data.month}`}>← Volver a rendimiento</Link>
        <span>Los aceleradores se concilian por asesor, no por orden individual.</span>
      </div>

      <section className="performance-controls ui-surface">
        <div>
          <p className="performance-controls__eyebrow">Cohorte revisada</p>
          <p className="performance-controls__month">{data.monthLabel}</p>
        </div>
        <form className="performance-filter" method="get">
          <label>
            <span>Mes</span>
            <input defaultValue={data.month} max={data.currentMonth} name="month" type="month" />
          </label>
          <label>
            <span>Equipo</span>
            <select defaultValue={data.teamFilter} name="team">
              <option value="ALL">Toda la organización</option>
              {data.teamOptions.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Resultado</span>
            <select defaultValue={data.filter} name="reason">
              <option value="ALL">Todos los resultados</option>
              <option value="PAYABLE">Pagables</option>
              <option value="NOT_ACTIVATED">Entregadas por activar</option>
              <option value="NOT_DELIVERED">Pendientes de entrega</option>
              <option value="UNASSIGNED">Sin asesor responsable</option>
              <option value="UNKNOWN_OPERATION">Operación por corregir</option>
              <option value="CANCELLED">Canceladas</option>
              <option value="NEW_LINE_NO_COMMISSION">Altas sin comisión</option>
            </select>
          </label>
          <button type="submit">Aplicar</button>
        </form>
      </section>

      <section className="reconciliation-summary" aria-label="Resumen de conciliación">
        <article>
          <span>Órdenes de la cohorte</span>
          <strong>{data.totals.orders}</strong>
          <small>{data.pagination.filteredTotal} visibles con el filtro</small>
        </article>
        <article data-tone="positive">
          <span>Portabilidades pagables</span>
          <strong>{data.totals.payable}</strong>
          <small>Entregadas, cerradas y con asesor</small>
        </article>
        <article>
          <span>Comisión base provisional</span>
          <strong>{money(data.totals.baseCommissionCents)}</strong>
          <small>No incluye aceleradores</small>
        </article>
      </section>

      <section className="performance-panel">
        <header className="performance-panel__header">
          <div>
            <p className="performance-panel__eyebrow">Evidencia por orden</p>
            <h2>Detalle del cálculo</h2>
            <p>Cada fila conserva un enlace al pedido que respalda el resultado.</p>
          </div>
        </header>
        <div className="performance-table-wrap">
          <table className="performance-table reconciliation-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Asesor</th>
                <th>Operación</th>
                <th>Resultado</th>
                <th>Base</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <Link href={orderHref(data, line.orderCode)}>{line.orderCode}</Link>
                    <small>{line.registeredAtLabel}</small>
                  </td>
                  <td>{line.customerName}</td>
                  <td><strong>{line.agentName}</strong><small>{line.teamName ?? "Sin equipo"}</small></td>
                  <td>{operationLabels[line.operation] ?? line.operation}</td>
                  <td><span className="reconciliation-reason" data-reason={line.reason}>{line.reasonLabel}</span></td>
                  <td><strong>{money(line.baseCommissionCents)}</strong></td>
                </tr>
              ))}
              {data.lines.length === 0 ? (
                <tr><td className="reconciliation-empty" colSpan={6}>No hay órdenes para este resultado.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {data.pagination.totalPages > 1 ? (
          <nav className="reconciliation-pagination" aria-label="Paginación de conciliación">
            {data.pagination.page > 1 ? <Link href={reconciliationHref(data, { page: data.pagination.page - 1 })}>Anterior</Link> : <span />}
            <small>Página {data.pagination.page} de {data.pagination.totalPages}</small>
            {data.pagination.page < data.pagination.totalPages ? <Link href={reconciliationHref(data, { page: data.pagination.page + 1 })}>Siguiente</Link> : <span />}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
