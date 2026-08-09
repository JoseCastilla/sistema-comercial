import Link from "next/link";

import { PageHeader } from "@repo/ui/page-header";

import { OrderRealtimeStatus } from "@/features/orders/components/order-realtime-status";

import type { PerformanceDashboardData } from "../performance.types";

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

function money(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

function percentage(value: number | null): string {
  return value === null
    ? "Sin base"
    : new Intl.NumberFormat("es-PE", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
}

function delta(value: number | null, points = false): string {
  if (value === null) return "Sin base comparable";
  const sign = value > 0 ? "+" : "";
  return points
    ? `${sign}${(value * 100).toFixed(1)} pp vs. mes anterior`
    : `${sign}${percentage(value)} vs. mes anterior`;
}

function performanceHref(
  data: PerformanceDashboardData,
  month: string,
): string {
  const parameters = new URLSearchParams({ month });
  if (data.teamFilter !== "ALL") parameters.set("team", data.teamFilter);
  return `/performance?${parameters.toString()}`;
}

function ordersHref(
  data: PerformanceDashboardData,
  status: string,
  team = data.teamFilter,
): string {
  const parameters = new URLSearchParams({
    period: "RANGE",
    from: data.from,
    to: data.to,
    status,
  });
  if (team !== "ALL") parameters.set("team", team);
  return `/orders?${parameters.toString()}`;
}

function Kpi({
  label,
  value,
  supporting,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  supporting: string;
  tone?: "neutral" | "positive" | "attention";
}) {
  return (
    <article className="performance-kpi" data-tone={tone}>
      <p className="performance-kpi__label">{label}</p>
      <p className="performance-kpi__value">{value}</p>
      <p className="performance-kpi__supporting">{supporting}</p>
    </article>
  );
}

function Funnel({ data }: { data: PerformanceDashboardData }) {
  const steps = [
    { label: "Ingresadas", value: data.metrics.entered },
    { label: "Entregadas", value: data.metrics.delivered },
    { label: "Activadas", value: data.metrics.activated },
    { label: "Pagables", value: data.metrics.payable },
  ];
  const maximum = Math.max(data.metrics.entered, 1);

  return (
    <div className="performance-funnel">
      {steps.map((step, index) => (
        <div className="performance-funnel__step" key={step.label}>
          <div className="performance-funnel__meta">
            <span>{step.label}</span>
            <strong>{step.value}</strong>
          </div>
          <div aria-hidden="true" className="performance-funnel__track">
            <span style={{ width: `${(step.value / maximum) * 100}%` }} />
          </div>
          {index > 0 ? (
            <small>
              {percentage(
                steps[index - 1]?.value
                  ? step.value / (steps[index - 1]?.value ?? 1)
                  : null,
              )}{" "}
              de la etapa anterior
            </small>
          ) : (
            <small>Cohorte ingresada en {data.monthLabel}</small>
          )}
        </div>
      ))}
    </div>
  );
}

export function PerformanceDashboard({
  data,
}: {
  data: PerformanceDashboardData;
}) {
  const description =
    data.role === "AGENT"
      ? "Entiende cómo avanza tu cartera y qué ventas requieren atención para convertirse en activaciones."
      : data.role === "BACKOFFICE"
        ? "Prioriza los bloqueos operativos que afectan la entrega y activación de las ventas."
        : "Compara resultados, identifica desvíos y abre las órdenes que requieren intervención.";

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={description}
        eyebrow={data.scopeLabel}
        meta={
          <span className="flex flex-wrap items-center justify-end gap-2">
            <OrderRealtimeStatus />
            <span>Actualizado: {data.generatedAt}</span>
          </span>
        }
        title="Rendimiento comercial"
      />

      <section className="performance-controls ui-surface">
        <div className="performance-month-nav">
          <Link
            aria-label="Ver mes anterior"
            className="performance-month-nav__arrow"
            href={performanceHref(data, data.previousMonth)}
          >
            ←
          </Link>
          <div>
            <p className="performance-controls__eyebrow">Período de ingreso</p>
            <p className="performance-controls__month">{data.monthLabel}</p>
          </div>
          {data.isCurrentMonth ? (
            <span aria-hidden="true" className="performance-month-nav__spacer" />
          ) : (
            <Link
              aria-label="Ver mes siguiente"
              className="performance-month-nav__arrow"
              href={performanceHref(data, data.nextMonth)}
            >
              →
            </Link>
          )}
        </div>

        <form className="performance-filter" method="get">
          <label>
            <span>Mes</span>
            <input defaultValue={data.month} max={data.currentMonth} name="month" type="month" />
          </label>
          {data.showTeamFilter ? (
            <label>
              <span>Equipo</span>
              <select defaultValue={data.teamFilter} name="team">
                <option value="ALL">
                  {data.role === "SUPERVISOR" ? "Mis equipos" : "Toda la organización"}
                </option>
                {data.teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="submit">Aplicar</button>
        </form>
      </section>

      <section className="performance-kpis" aria-label="Indicadores principales">
        <Kpi
          label="Ventas ingresadas"
          supporting={delta(data.comparison.enteredDelta)}
          value={data.metrics.entered}
        />
        <Kpi
          label="Entregadas"
          supporting={`${percentage(data.metrics.deliveryRate)} de las ingresadas`}
          value={data.metrics.delivered}
        />
        <Kpi
          label="Activadas y pagables"
          supporting={delta(data.comparison.payableDelta)}
          tone="positive"
          value={data.metrics.payable}
        />
        <Kpi
          label="Conversión pagable"
          supporting={delta(data.comparison.payableRateDelta, true)}
          value={percentage(data.metrics.payableRate)}
        />
      </section>

      <div className="performance-layout">
        <section className="performance-panel">
          <header className="performance-panel__header">
            <div>
              <p className="performance-panel__eyebrow">Conversión</p>
              <h2>Del ingreso a la activación</h2>
            </div>
            <span className="performance-panel__note">Cohorte mensual</span>
          </header>
          <Funnel data={data} />
        </section>

        <section className="performance-panel performance-panel--attention">
          <header className="performance-panel__header">
            <div>
              <p className="performance-panel__eyebrow">Siguiente acción</p>
              <h2>Oportunidades por recuperar</h2>
            </div>
          </header>
          <div className="performance-actions">
            <Link href={ordersHref(data, "AWAITING_ACTIVATION")}>
              <span>Entregadas por activar</span>
              <strong>{data.metrics.deliveredPendingActivation}</strong>
              <small>Revisar órdenes que aún no generan pago</small>
            </Link>
            <Link href={ordersHref(data, "RECOVERY")}>
              <span>No entregadas o rechazadas</span>
              <strong>{data.metrics.recovery}</strong>
              <small>Abrir la cola de recuperación</small>
            </Link>
            {data.role !== "AGENT" ? (
              <Link href={ordersHref(data, "ALL", "UNASSIGNED")}>
                <span>Sin asesor ni equipo</span>
                <strong>{data.metrics.unassigned}</strong>
                <small>Asignar antes de medir desempeño</small>
              </Link>
            ) : null}
          </div>
        </section>
      </div>

      {data.showCommission ? (
        <section className="performance-panel performance-commission">
          <header className="performance-panel__header">
            <div>
              <p className="performance-panel__eyebrow">Estimación provisional</p>
              <h2>Comisión del período</h2>
              <p>Se confirma únicamente con portabilidades entregadas y cerradas.</p>
            </div>
            <div className="performance-commission__aside">
              <strong className="performance-commission__total">
                {money(data.metrics.estimatedCommissionCents)}
              </strong>
              {data.role === "ADMIN" ? (
                <Link
                  className="performance-commission__review"
                  href={`/performance/reconciliation?month=${data.month}${data.teamFilter === "ALL" ? "" : `&team=${data.teamFilter}`}`}
                >
                  Revisar cálculo
                </Link>
              ) : null}
            </div>
          </header>
          <div className="performance-commission__details">
            <div>
              <span>Comisión base</span>
              <strong>{money(data.metrics.baseCommissionCents)}</strong>
              <small>{data.metrics.payable} portabilidades pagables</small>
            </div>
            <div>
              <span>Acelerador 1–15</span>
              <strong>{money(data.metrics.acceleratorOne.amountCents)}</strong>
              <small>
                {data.metrics.acceleratorOne.confirmed} confirmadas de {data.metrics.acceleratorOne.eligible} ingresadas
              </small>
            </div>
            {data.role === "AGENT" && data.metrics.acceleratorOne.nextTarget ? (
              <div>
                <span>Siguiente nivel</span>
                <strong>{data.metrics.acceleratorOne.missingForNextTarget}</strong>
                <small>activaciones pagables para el siguiente tramo</small>
              </div>
            ) : null}
          </div>
          <p className="performance-commission__notice">
            No es una liquidación de nómina. Puede cambiar mientras las ventas de esta cohorte maduran.
          </p>
        </section>
      ) : null}

      {data.breakdown.length > 0 ? (
        <section className="performance-panel">
          <header className="performance-panel__header">
            <div>
              <p className="performance-panel__eyebrow">Lectura del equipo</p>
              <h2>Resultados por asesor</h2>
              <p>El tamaño de la cartera acompaña la tasa para evitar comparaciones engañosas.</p>
            </div>
          </header>
          <div className="performance-table-wrap">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Asesor</th>
                  <th>Ingresadas</th>
                  <th>Entregadas</th>
                  <th>Pagables</th>
                  <th>Conversión</th>
                  {data.role === "ADMIN" ? <th>Estimado</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.breakdown.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong><small>{item.teamName ?? "Sin equipo"}</small></td>
                    <td>{item.metrics.entered}</td>
                    <td>{item.metrics.delivered}</td>
                    <td>{item.metrics.payable}</td>
                    <td>{percentage(item.metrics.payableRate)}</td>
                    {data.role === "ADMIN" ? <td>{money(item.metrics.estimatedCommissionCents)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
