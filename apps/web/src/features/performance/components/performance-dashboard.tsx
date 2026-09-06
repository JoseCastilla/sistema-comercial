import Form from "next/form";
import Link from "next/link";

import { getPotentialBaseCommissionCents } from "@repo/validation";

import {
  formatDecimal,
  formatMoneyFromCents,
  formatPercent,
} from "@repo/ui/format";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";

import { OrderRealtimeStatus } from "@/features/orders/components/order-realtime-status";

import {
  advisorHref,
  managementHref,
  ordersHref,
  performanceHref,
  quotasHref,
  reconciliationHref,
  recoveryCasesHref,
  sortHref,
} from "../performance-links";
import {
  breakdownSortOptions,
  filterBreakdown,
  getManagementFilterOption,
  managementFilterOptions,
  sortBreakdown,
} from "../performance-management";

import type {
  PerformanceDashboardData,
  PerformanceQuotaProgress,
  PerformanceTeamSummary,
} from "../performance.types";

/*
 * El formato de cifras vive en `@repo/ui/format`. Antes este archivo definia
 * su propio `Intl.NumberFormat` de moneda —privado, que ningun otro modulo
 * podia importar— y por eso la misma variable salia con un formato aca y con
 * otro en la pantalla de al lado.
 */
function money(cents: number): string {
  return formatMoneyFromCents(cents);
}

function percentage(value: number | null): string {
  return value === null
    ? "Todavía sin ventas para comparar"
    : formatPercent(value);
}

function delta(
  value: number | null,
  comparedThroughDay: number | null,
  points = false,
): string {
  if (value === null) return "No hubo ventas el mes pasado para comparar";
  const sign = value > 0 ? "+" : "";
  const baseline =
    comparedThroughDay === null
      ? "vs. el mes pasado"
      : `vs. los días 1–${comparedThroughDay} del mes pasado`;
  return points
    ? `${sign}${formatDecimal(value * 100)} puntos ${baseline}`
    : `${sign}${percentage(value)} ${baseline}`;
}

function shortDelta(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value * 100)}%`;
}

function Funnel({ data }: { data: PerformanceDashboardData }) {
  const steps = [
    { label: "Ingresadas", value: data.metrics.entered },
    { label: "Entregadas", value: data.metrics.delivered },
    { label: "Cerradas", value: data.metrics.activated },
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
            <small>Ventas ingresadas en {data.monthLabel}</small>
          )}
        </div>
      ))}
    </div>
  );
}

function DailyPerformancePulse({ data }: { data: PerformanceDashboardData }) {
  const pulse = data.dailyPulse;
  if (!pulse) return null;

  const maximum = Math.max(
    ...pulse.days.flatMap((day) => [day.entered, day.closed]),
    1,
  );
  const isAgent = data.view === "SELF";
  const heading = isAgent ? "Tu día de hoy" : "Movimiento de hoy en tu equipo";
  const motivation = isAgent
    ? pulse.entered > 0
      ? `${pulse.entered} ${pulse.entered === 1 ? "venta ingresada" : "ventas ingresadas"} hoy y ${pulse.closed} ${pulse.closed === 1 ? "cierre registrado" : "cierres registrados"}. Sigue cuidando la entrega para convertir el potencial en comisión.`
      : "Aún no registras ventas hoy. Tu cartera pendiente sigue siendo una oportunidad para recuperar activaciones."
    : `${pulse.entered} ${pulse.entered === 1 ? "venta ingresada" : "ventas ingresadas"} y ${pulse.closed} ${pulse.closed === 1 ? "cierre registrado" : "cierres registrados"} hoy en ${data.scopeLabel.toLocaleLowerCase("es-PE")}.`;

  return (
    <section className="agent-daily" aria-labelledby="agent-daily-title">
      <header className="agent-daily__header">
        <div>
          <p className="performance-panel__eyebrow">{heading}</p>
          <h2 id="agent-daily-title">{pulse.todayLabel}</h2>
          <p>{motivation}</p>
        </div>
        <span className="agent-daily__live">Datos de hoy</span>
      </header>

      <div className="agent-daily__metrics">
        <article>
          <span>Ingresadas hoy</span>
          <strong>{pulse.entered}</strong>
          <small>Actividad comercial</small>
        </article>
        <article>
          {data.showCommission ? (
            <>
              <span>Potencial de hoy</span>
              <strong>{money(pulse.potentialCommissionCents)}</strong>
              <small>Sujeto a entrega y cierre</small>
            </>
          ) : (
            <>
              <span>Pagables hoy</span>
              <strong>{pulse.confirmed}</strong>
              <small>Entregadas y cerradas</small>
            </>
          )}
        </article>
        <article data-tone="confirmed">
          <span>Cierres registrados hoy</span>
          <strong>{pulse.closed}</strong>
          <small>
            {pulse.confirmed} pagables
            {data.showCommission
              ? ` · ${money(pulse.confirmedBaseCommissionCents)} de base`
              : ""}
          </small>
        </article>
        <article>
          {data.showCommission ? (
            <>
              <span>Estimación mensual</span>
              <strong>{money(data.metrics.estimatedCommissionCents)}</strong>
              <small>Incluye comisión fija y bono por metas</small>
            </>
          ) : (
            <>
              <span>Entregadas por activar</span>
              <strong>{data.metrics.deliveredPendingActivation}</strong>
              <small>Requieren seguimiento</small>
            </>
          )}
        </article>
      </div>

      {!isAgent ? (
        <div className="agent-daily__rhythm">
          <div className="agent-daily__rhythm-copy">
            <strong>Ritmo de los últimos 7 días</strong>
            <small>
              Compara ventas ingresadas y cierres registrados por día.
            </small>
            <div className="agent-daily__legend" aria-hidden="true">
              <span data-series="entered">Ingresadas</span>
              <span data-series="closed">Cerradas</span>
            </div>
          </div>
          <div
            aria-label="Ventas ingresadas y cierres registrados durante los últimos siete días"
            className="agent-daily__chart"
          >
            {pulse.days.map((day) => (
              <div
                className="agent-daily__day"
                data-today={day.isToday ? "true" : undefined}
                key={day.key}
                title={`${day.label}: ${day.entered} ingresadas, ${day.closed} cierres registrados y ${day.confirmed} pagables`}
              >
                <div className="agent-daily__totals">
                  <strong>I {day.entered}</strong>
                  <strong>C {day.closed}</strong>
                </div>
                <div aria-hidden="true" className="agent-daily__bars">
                  <span
                    data-series="entered"
                    style={{
                      height: `${Math.max(
                        (day.entered / maximum) * 100,
                        day.entered > 0 ? 12 : 3,
                      )}%`,
                    }}
                  />
                  <span
                    data-series="closed"
                    style={{
                      height: `${Math.max(
                        (day.closed / maximum) * 100,
                        day.closed > 0 ? 12 : 3,
                      )}%`,
                    }}
                  />
                </div>
                <span>{day.label}</span>
                <small>
                  {day.confirmed} pagables
                  {data.showCommission
                    ? ` · ${money(day.confirmedBaseCommissionCents)}`
                    : ""}
                </small>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="agent-daily__notice">
        Los cierres muestran cuándo se registró la confirmación en la
        plataforma; cada venta se cuenta en el mes en que se registró.
      </p>
    </section>
  );
}

function SalesTrendOverview({ data }: { data: PerformanceDashboardData }) {
  if (data.view === "SELF") return null;

  const days = data.monthProgress.days.filter((day) => !day.isFuture);
  const maximum = Math.max(
    ...days.flatMap((day) => [day.entered, day.closed]),
    1,
  );
  const points = (read: (day: (typeof days)[number]) => number) =>
    days
      .map((day, index) => {
        const x = days.length > 1 ? (index / (days.length - 1)) * 100 : 0;
        const y = 92 - (read(day) / maximum) * 78;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  const enteredPoints = points((day) => day.entered);
  const closedPoints = points((day) => day.closed);
  const areaPoints = enteredPoints ? `0,92 ${enteredPoints} 100,92` : "";
  const totalClosures = days.reduce((total, day) => total + day.closed, 0);

  return (
    <section
      className="performance-panel performance-sales-trend"
      aria-labelledby="sales-trend-title"
    >
      <header className="performance-panel__header">
        <div>
          <p className="performance-panel__eyebrow">Tendencia comercial</p>
          <h2 id="sales-trend-title">Actividad diaria</h2>
          <p>Ingresos y cierres registrados durante {data.monthLabel}.</p>
        </div>
        <div className="performance-sales-trend__legend" aria-hidden="true">
          <span data-series="entered">Ingresadas</span>
          <span data-series="closed">Cierres</span>
        </div>
      </header>

      <div className="performance-sales-trend__body">
        <div className="performance-sales-trend__summary">
          <dl>
            <div>
              <dt>Promedio diario</dt>
              <dd>{formatDecimal(data.monthProgress.averagePerElapsedDay)}</dd>
            </div>
            <div>
              <dt>Días con ventas</dt>
              <dd>{data.monthProgress.productiveDays}</dd>
            </div>
            <div>
              <dt>Mejor día</dt>
              <dd>
                {data.monthProgress.bestDay
                  ? `${data.monthProgress.bestDay.entered} ventas`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Cierres registrados</dt>
              <dd>{totalClosures}</dd>
            </div>
          </dl>
        </div>

        <div className="performance-sales-trend__chart">
          <svg
            aria-label={`Ventas ingresadas por día en ${data.monthLabel}`}
            preserveAspectRatio="none"
            role="img"
            viewBox="0 0 100 100"
          >
            <line x1="0" x2="100" y1="14" y2="14" />
            <line x1="0" x2="100" y1="40" y2="40" />
            <line x1="0" x2="100" y1="66" y2="66" />
            <line x1="0" x2="100" y1="92" y2="92" />
            {areaPoints ? <polygon points={areaPoints} /> : null}
            {enteredPoints ? (
              <polyline data-series="entered" points={enteredPoints} />
            ) : null}
            {closedPoints ? (
              <polyline data-series="closed" points={closedPoints} />
            ) : null}
          </svg>
          <div aria-hidden="true" className="performance-sales-trend__axis">
            <span>Día 1</span>
            <span>
              Día {Math.max(1, Math.ceil(data.monthProgress.elapsedDays / 2))}
            </span>
            <span>Día {data.monthProgress.elapsedDays}</span>
          </div>
        </div>
      </div>
      <p className="performance-sales-trend__notice">
        Las ingresadas se cuentan el día que se registró la venta y los cierres
        el día que se confirmó; por eso las dos líneas no coinciden.
      </p>
    </section>
  );
}

function PersonalMonthlyProgress({ data }: { data: PerformanceDashboardData }) {
  if (data.view !== "SELF") return null;

  const progress = data.monthProgress;
  const visibleDays = progress.days.filter((day) => !day.isFuture);
  const maximum = Math.max(...visibleDays.map((day) => day.entered), 1);

  return (
    <section
      className="performance-panel performance-month-progress"
      aria-labelledby="month-progress-title"
    >
      <header className="performance-panel__header">
        <div>
          <p className="performance-panel__eyebrow">Tu avance diario</p>
          <h2 id="month-progress-title">Ritmo de {data.monthLabel}</h2>
          <p>
            Cada barra representa las ventas ingresadas ese día; el acumulado
            muestra tu avance real del mes.
          </p>
        </div>
      </header>

      <dl className="performance-month-progress__summary">
        <div>
          <dt>Días transcurridos</dt>
          <dd>{progress.elapsedDays}</dd>
        </div>
        <div>
          <dt>Días con ventas</dt>
          <dd>{progress.productiveDays}</dd>
        </div>
        <div>
          <dt>Promedio diario</dt>
          <dd>{formatDecimal(progress.averagePerElapsedDay)}</dd>
        </div>
        <div>
          <dt>Mejor día</dt>
          <dd>
            {progress.bestDay
              ? `${progress.bestDay.entered} · día ${progress.bestDay.day}`
              : "—"}
          </dd>
        </div>
      </dl>

      <div
        aria-label={`Ventas diarias y acumuladas de ${data.monthLabel}`}
        className="performance-month-progress__chart"
      >
        {progress.days.map((day) => (
          <div
            className="performance-month-progress__day"
            data-future={day.isFuture ? "true" : undefined}
            data-today={day.isToday ? "true" : undefined}
            key={day.key}
            title={
              day.isFuture
                ? `Día ${day.day}: aún no transcurre`
                : `Día ${day.day}: ${day.entered} ventas · ${day.cumulative} acumuladas`
            }
          >
            <strong>{day.isFuture ? "" : day.entered}</strong>
            <div aria-hidden="true">
              <span
                style={{
                  height: `${Math.max(
                    (day.entered / maximum) * 100,
                    day.entered > 0 ? 10 : 2,
                  )}%`,
                }}
              />
            </div>
            <small>{day.day}</small>
            <em>{day.isFuture ? "" : day.cumulative}</em>
          </div>
        ))}
      </div>
      <div className="performance-month-progress__legend">
        <span>Venta del día</span>
        <span>Acumulado al cierre del día</span>
      </div>
    </section>
  );
}

function TeamDailyMatrix({ data }: { data: PerformanceDashboardData }) {
  // La matriz sigue el mismo filtro de gestión y el mismo orden que el
  // desglose: una sola lista de asesores por pantalla (REN-05).
  const advisors = sortBreakdown(
    filterBreakdown(data.breakdown, data.management).filter(
      (advisor) => advisor.isActiveSeller || advisor.metrics.entered > 0,
    ),
    data.sort,
  );
  if (data.view === "SELF" || advisors.length === 0) return null;

  return (
    <section
      className="performance-panel performance-daily-matrix"
      aria-labelledby="daily-matrix-title"
    >
      <header className="performance-panel__header">
        <div>
          <p className="performance-panel__eyebrow">Ritmo del equipo</p>
          <h2 id="daily-matrix-title">Ventas por asesor y día</h2>
          <p>
            Identifica continuidad, días sin producción y concentración de
            ventas durante {data.monthLabel}.
          </p>
        </div>
        <span className="performance-panel__note">Desliza para ver el mes</span>
      </header>

      <div className="performance-daily-matrix__wrap">
        <table className="performance-daily-matrix__table">
          <thead>
            <tr>
              <th scope="col">Asesor</th>
              {data.monthProgress.days.map((day) => (
                <th
                  data-future={day.isFuture ? "true" : undefined}
                  data-today={day.isToday ? "true" : undefined}
                  key={day.key}
                  scope="col"
                  title={day.label}
                >
                  {day.day}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {advisors.map((advisor) => (
              <tr key={advisor.id}>
                <th scope="row">
                  <Link href={advisorHref(data, advisor.id)}>
                    <strong>{advisor.name}</strong>
                  </Link>
                  <small>{advisor.teamName ?? "Sin equipo"}</small>
                </th>
                {advisor.dailyEntered.map((value, index) => {
                  const day = data.monthProgress.days[index];
                  const isFuture = day?.isFuture ?? false;
                  return (
                    <td
                      aria-label={
                        isFuture
                          ? `Día ${day?.day}: aún no transcurre`
                          : `Día ${day?.day}: ${value} ${value === 1 ? "venta" : "ventas"}`
                      }
                      data-future={isFuture ? "true" : undefined}
                      data-level={
                        isFuture ? undefined : String(Math.min(value, 4))
                      }
                      data-today={day?.isToday ? "true" : undefined}
                      key={day?.key ?? index}
                    >
                      {isFuture || value === 0 ? "" : value}
                    </td>
                  );
                })}
                <td>{advisor.metrics.entered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="performance-daily-matrix__legend" aria-hidden="true">
        <span>Sin ventas</span>
        <i data-level="1" />
        <i data-level="2" />
        <i data-level="3" />
        <i data-level="4" />
        <span>Mayor producción</span>
      </div>
    </section>
  );
}

function SalesOperationMix({ data }: { data: PerformanceDashboardData }) {
  const mix = data.salesMix;
  if (!data.isCurrentMonth && mix.total === 0) return null;

  const prepaidRateCents = getPotentialBaseCommissionCents("PORT_PREPAID");
  const postpaidRateCents = getPotentialBaseCommissionCents("PORT_POSTPAID");
  const rows = [
    {
      key: "new-line",
      label: "Altas nuevas",
      value: mix.newLine,
      commission: "No generan comisión base",
    },
    {
      key: "port-prepaid",
      label: "Porta origen prepago",
      value: mix.portPrepaid,
      commission: `${mix.payablePortPrepaid} pagables × ${money(prepaidRateCents)} = ${money(mix.payablePortPrepaid * prepaidRateCents)}`,
    },
    {
      key: "port-postpaid",
      label: "Porta origen postpago",
      value: mix.portPostpaid,
      commission: `${mix.payablePortPostpaid} pagables × ${money(postpaidRateCents)} = ${money(mix.payablePortPostpaid * postpaidRateCents)}`,
    },
    ...(mix.unclassified > 0
      ? [
          {
            key: "unclassified",
            label: "Por clasificar",
            value: mix.unclassified,
            commission: "No generan comisión mientras no se clasifiquen",
          },
        ]
      : []),
  ];

  return (
    <section className="sales-mix" aria-labelledby="sales-mix-title">
      <header className="sales-mix__header">
        <div>
          <strong id="sales-mix-title">Composición de ventas entregadas</strong>
          <small>
            {data.view === "SELF"
              ? "Así se reparten tus ventas entregadas del mes"
              : `Entregadas de ${data.scopeLabel.toLocaleLowerCase("es-PE")}`}
          </small>
        </div>
        <span>
          {mix.total} entregadas en {data.monthLabel}
        </span>
      </header>

      <div className="sales-mix__distribution">
        {rows.map((row) => {
          const ratio = mix.total > 0 ? row.value / mix.total : 0;
          return (
            <article data-segment={row.key} key={row.key}>
              <div>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
              <div aria-hidden="true" className="sales-mix__track">
                <span style={{ width: `${ratio * 100}%` }} />
              </div>
              <small>
                {percentage(ratio)} de las entregadas
                {data.showCommission ? ` · ${row.commission}` : ""}
              </small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Cohorte de la cuota dicha con fechas, no con el nombre del bono: «del 1 al
 * 15 de septiembre de 2026». Fuera de ventana activa se habla de la última
 * que cerró (SPEC-038 BR-015) y se dice.
 */
function quotaCohortLabel(data: PerformanceDashboardData): string {
  const window = data.quotaWindow;
  if (!window) return "";
  const range = `del ${window.startDay} al ${window.endDay} de ${data.monthLabel}`;
  return window.isActive
    ? `Portabilidades entregadas registradas ${range}. Tramo en curso.`
    : `Portabilidades entregadas registradas ${range}. Tramo cerrado: es la última ventana con datos.`;
}

function QuotaCell({
  quota,
  individual,
}: {
  quota: PerformanceQuotaProgress | null;
  individual: boolean;
}) {
  if (!quota) return <td>—</td>;

  // El siguiente tramo del bono se dice solo cuando añade algo: si la cuota
  // y el tramo coinciden y todo lo entregado ya cerró, repetirlo es ruido.
  const nextTier =
    individual &&
    quota.nextTarget !== null &&
    quota.missingForNextTarget > 0 &&
    (quota.nextTarget !== quota.target ||
      quota.missingForNextTarget !== quota.missing)
      ? `${quota.missingForNextTarget} ${quota.missingForNextTarget === 1 ? "confirmada" : "confirmadas"} para el bono de ${quota.nextTarget}`
      : null;

  return (
    <td
      data-quota-reached={quota.reached ? "true" : undefined}
      title={
        nextTier
          ? `${quota.confirmed} entregadas y cerradas (pagan el bono). Faltan ${nextTier}.`
          : `${quota.confirmed} entregadas y cerradas (pagan el bono).`
      }
    >
      <strong>
        {quota.delivered}/{quota.target}
      </strong>
      <small>
        {quota.reached ? "cumplida" : `faltan ${quota.missing}`} ·{" "}
        {quota.confirmed} {quota.confirmed === 1 ? "confirmada" : "confirmadas"}
        {nextTier ? ` · ${nextTier}` : ""}
      </small>
    </td>
  );
}

function CountLink({ value, href }: { value: number; href: string | null }) {
  return value > 0 && href ? <Link href={href}>{value}</Link> : <>{value}</>;
}

/**
 * SPEC-044 REN-02: una fila por equipo con su responsable, su plantilla y su
 * cuota; las filas residuales cierran la cuenta con el total del alcance.
 */
function TeamSummaryPanel({ data }: { data: PerformanceDashboardData }) {
  if (data.teams.length === 0) return null;

  const teamScope = (team: PerformanceTeamSummary) =>
    team.kind === "TEAM" && team.id ? team.id : null;
  const totals = data.teams.reduce(
    (sum, team) => ({
      entered: sum.entered + team.metrics.entered,
      payable: sum.payable + team.metrics.payable,
      pending: sum.pending + team.metrics.deliveredPendingActivation,
      recovery: sum.recovery + team.metrics.recovery,
      cases: sum.cases + team.openRecoveryCases,
    }),
    { entered: 0, payable: 0, pending: 0, recovery: 0, cases: 0 },
  );
  const teamsWithoutSupervisor = data.teams.filter(
    (team) => team.kind === "TEAM" && team.supervisorName === null,
  ).length;

  return (
    <section
      className="performance-panel performance-teams"
      aria-labelledby="teams-summary-title"
    >
      <header className="performance-panel__header">
        <div>
          <p className="performance-panel__eyebrow">Responsables</p>
          <h2 id="teams-summary-title">Resumen por equipo</h2>
          <p>
            Quién responde por cada equipo, cuántos venden y cómo va la cuota.
            {teamsWithoutSupervisor > 0
              ? ` ${teamsWithoutSupervisor === 1 ? "Un equipo no tiene" : `${teamsWithoutSupervisor} equipos no tienen`} supervisor: nadie reparte su cuota ni sigue su recupero.`
              : ""}
          </p>
        </div>
        {data.role !== "AGENT" && data.quotaWindow ? (
          <Link
            className="performance-commission__review"
            href={quotasHref(data, data.quotaWindow.key)}
          >
            Asignar cuotas
          </Link>
        ) : null}
      </header>
      <div className="ui-table-wrap">
        <table className="ui-table ui-table--figures">
          <thead>
            <tr>
              <th>Equipo</th>
              <th title="Vendedores activos con ventas del mes / vendedores activos">
                Vendedores
              </th>
              <th>Ingresadas</th>
              <th>Tasa de entrega</th>
              <th>Pagables</th>
              <th title="Entregadas sin cerrar: aún no generan pago; abre Pedidos">
                Por activar
              </th>
              <th title="Pedidos del mes no entregados o cancelados; abre Pedidos">
                Por recuperar
              </th>
              <th title="Casos abiertos en Recupero de ventas; abre la bandeja">
                Casos
              </th>
              {data.quotaWindow ? (
                <th title={quotaCohortLabel(data)}>
                  Cuota{data.quotaWindow.isActive ? "" : " (cerrada)"}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team) => {
              const scope = teamScope(team);
              return (
                <tr
                  data-unattributed={team.kind !== "TEAM" ? "true" : undefined}
                  key={team.id ?? team.kind}
                >
                  <td>
                    {scope ? (
                      <Link
                        href={performanceHref(data, data.month, {
                          team: scope,
                        })}
                      >
                        <strong>{team.name}</strong>
                      </Link>
                    ) : (
                      <strong>{team.name}</strong>
                    )}
                    <small>
                      {team.kind === "TEAM"
                        ? (team.supervisorName ?? "Sin supervisor")
                        : team.kind === "UNASSIGNED"
                          ? "Pedidos sin equipo, con o sin asesor"
                          : "Equipos fuera de este alcance"}
                    </small>
                  </td>
                  <td>
                    {team.kind === "TEAM" ? (
                      <>
                        <strong>
                          {team.sellersWithSales}/{team.activeSellers}
                        </strong>
                        <small>
                          {team.sellersWithoutSales > 0 && scope ? (
                            <Link
                              href={performanceHref(data, data.month, {
                                team: scope,
                                management: "SIN_PRODUCCION",
                              })}
                            >
                              {team.sellersWithoutSales} sin producción
                            </Link>
                          ) : (
                            "todos con ventas"
                          )}
                        </small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{team.metrics.entered}</td>
                  <td>{percentage(team.metrics.deliveryRate)}</td>
                  <td>{team.metrics.payable}</td>
                  <td>
                    <CountLink
                      href={
                        scope
                          ? ordersHref(data, "AWAITING_ACTIVATION", {
                              team: scope,
                            })
                          : null
                      }
                      value={team.metrics.deliveredPendingActivation}
                    />
                  </td>
                  <td>
                    <CountLink
                      href={
                        scope
                          ? ordersHref(data, "RECOVERY", { team: scope })
                          : null
                      }
                      value={team.metrics.recovery}
                    />
                  </td>
                  <td>
                    <CountLink
                      href={
                        scope ? recoveryCasesHref(data, undefined, scope) : null
                      }
                      value={team.openRecoveryCases}
                    />
                  </td>
                  {data.quotaWindow ? (
                    <QuotaCell individual={false} quota={team.quota} />
                  ) : null}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>
                <strong>Total del alcance</strong>
                <small>
                  Los equipos y las filas residuales suman el tablero
                </small>
              </td>
              <td>—</td>
              <td>{totals.entered}</td>
              <td>{percentage(data.metrics.deliveryRate)}</td>
              <td>{totals.payable}</td>
              <td>{totals.pending}</td>
              <td>{totals.recovery}</td>
              <td>{totals.cases}</td>
              {data.quotaWindow ? <td>—</td> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/**
 * SPEC-044 REN-05: los filtros de gestión y el orden viven en la URL y se
 * eligen con un clic; el filtro activo muestra su definición para que la
 * cifra no admita dos lecturas.
 */
function ManagementBar({
  data,
  shown,
  total,
}: {
  data: PerformanceDashboardData;
  shown: number;
  total: number;
}) {
  const active = data.management
    ? getManagementFilterOption(data.management)
    : null;

  return (
    <div className="performance-management">
      <div className="performance-management__row">
        <span>Mostrar</span>
        <Link
          aria-current={data.management === null ? "true" : undefined}
          href={managementHref(data, null)}
        >
          Todos
        </Link>
        {managementFilterOptions
          .filter((option) => !option.requiresQuota || data.quotaWindow)
          .map((option) => (
            <Link
              aria-current={data.management === option.key ? "true" : undefined}
              href={managementHref(data, option.key)}
              key={option.key}
              title={option.definition}
            >
              {option.label}
            </Link>
          ))}
      </div>
      <div className="performance-management__row">
        <span>Ordenar por</span>
        {breakdownSortOptions
          .filter((option) => option.key !== "CUOTA" || data.quotaWindow)
          .map((option) => (
            <Link
              aria-current={data.sort === option.key ? "true" : undefined}
              href={sortHref(data, option.key)}
              key={option.key}
            >
              {option.label}
            </Link>
          ))}
      </div>
      <p aria-live="polite" className="performance-management__meaning">
        {active
          ? `${active.label}: ${active.definition} ${shown} de ${total} asesores.`
          : `${total} asesores en el alcance.`}
      </p>
    </div>
  );
}

function AdvisorBreakdown({ data }: { data: PerformanceDashboardData }) {
  if (data.breakdown.length === 0 && !data.unattributed) return null;

  const rows = sortBreakdown(
    filterBreakdown(data.breakdown, data.management),
    data.sort,
  );
  const showsEstimate = data.showCommission && data.role !== "AGENT";
  const columns = 7 + (data.quotaWindow ? 1 : 0) + (showsEstimate ? 1 : 0);

  return (
    <details className="performance-panel performance-breakdown" open>
      <summary className="performance-breakdown__summary">
        <div>
          <p className="performance-panel__eyebrow">Avance individual</p>
          <h2>Indicadores por asesor</h2>
          <p>
            Cuánto entrega, cuánto llega a comisión y cuánto tiene pendiente
            cada asesor.
            {data.quotaWindow ? ` Cuota: ${quotaCohortLabel(data)}` : ""}
          </p>
        </div>
        <span>
          <b data-collapsed>Ver detalle</b>
          <b data-expanded>Ocultar detalle</b>
        </span>
      </summary>
      <ManagementBar
        data={data}
        shown={rows.length}
        total={data.breakdown.length}
      />
      <div className="ui-table-wrap">
        <table className="ui-table ui-table--figures">
          <thead>
            <tr>
              <th>Asesor</th>
              <th>Ingresadas</th>
              <th
                title={
                  data.comparison.comparedThroughDay === null
                    ? "Comparado contra el mes pasado completo"
                    : `Comparado contra los días 1–${data.comparison.comparedThroughDay} del mes pasado`
                }
              >
                Vs. mes pasado
              </th>
              <th>Tasa de entrega</th>
              {data.quotaWindow ? (
                <th title={quotaCohortLabel(data)}>
                  Cuota{data.quotaWindow.isActive ? "" : " (cerrada)"}
                </th>
              ) : null}
              <th>Pagables</th>
              <th title="Pedidos del mes no entregados o cancelados; abre Pedidos">
                Pedidos por recuperar
              </th>
              <th title="Casos abiertos a su cargo en Recupero de ventas; abre la bandeja">
                Casos de recupero
              </th>
              <th title="Entregadas sin cerrar: aún no generan pago; abre Pedidos">
                Por activar
              </th>
              {showsEstimate ? <th>Estimado</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr
                data-no-sales={
                  item.isActiveSeller && item.metrics.entered === 0
                    ? "true"
                    : undefined
                }
                key={item.id}
              >
                <td>
                  <Link href={advisorHref(data, item.id)}>
                    <strong>{item.name}</strong>
                  </Link>
                  <small>
                    {item.teamName ?? "Sin equipo"}
                    {!item.isActiveSeller ? " · histórico" : ""}
                  </small>
                </td>
                <td>{item.metrics.entered}</td>
                <td>{shortDelta(item.enteredDelta)}</td>
                <td>{percentage(item.metrics.deliveryRate)}</td>
                {data.quotaWindow ? (
                  <QuotaCell individual quota={item.quota} />
                ) : null}
                <td>{item.metrics.payable}</td>
                <td>
                  <CountLink
                    href={ordersHref(data, "RECOVERY", { advisor: item.id })}
                    value={item.metrics.recovery}
                  />
                </td>
                <td>
                  <CountLink
                    href={recoveryCasesHref(data, item.id)}
                    value={item.openRecoveryCases}
                  />
                </td>
                <td>
                  <CountLink
                    href={ordersHref(data, "AWAITING_ACTIVATION", {
                      advisor: item.id,
                    })}
                    value={item.metrics.deliveredPendingActivation}
                  />
                </td>
                {showsEstimate ? (
                  <td>{money(item.metrics.estimatedCommissionCents)}</td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="reconciliation-empty" colSpan={columns}>
                  Ningún asesor cumple el filtro elegido.
                </td>
              </tr>
            ) : null}
            {data.unattributed && data.management === null ? (
              <tr data-unattributed="true">
                <td>
                  <strong>Sin asesor</strong>
                  <small>Asignar antes de medir desempeño</small>
                </td>
                <td>{data.unattributed.metrics.entered}</td>
                <td>{shortDelta(data.unattributed.enteredDelta)}</td>
                <td>{percentage(data.unattributed.metrics.deliveryRate)}</td>
                {data.quotaWindow ? <td>—</td> : null}
                <td>{data.unattributed.metrics.payable}</td>
                <td>
                  <CountLink
                    href={ordersHref(data, "RECOVERY", { team: "UNASSIGNED" })}
                    value={data.unattributed.metrics.recovery}
                  />
                </td>
                <td>—</td>
                <td>
                  <CountLink
                    href={ordersHref(data, "AWAITING_ACTIVATION", {
                      team: "UNASSIGNED",
                    })}
                    value={data.unattributed.metrics.deliveredPendingActivation}
                  />
                </td>
                {showsEstimate ? <td>—</td> : null}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function PerformanceDashboard({
  data,
}: {
  data: PerformanceDashboardData;
}) {
  const description =
    data.view === "SELF"
      ? "Entiende cómo avanza tu cartera y qué ventas requieren atención para convertirse en activaciones."
      : data.role === "BACKOFFICE"
        ? "Prioriza los bloqueos operativos que afectan la entrega y activación de las ventas."
        : "Compara resultados, identifica desvíos y abre las órdenes que requieren intervención.";

  return (
    <div className="ui-page-stack performance-dashboard">
      <PageHeader
        description={description}
        eyebrow={data.scopeLabel}
        meta={
          <span className="flex flex-wrap items-center justify-end gap-2">
            <OrderRealtimeStatus />
            <span>Actualizado: {data.generatedAt}</span>
          </span>
        }
        title={
          data.view === "SELF" ? "Mi rendimiento" : "Rendimiento comercial"
        }
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
            <p className="performance-controls__eyebrow">Mes de la venta</p>
            <p className="performance-controls__month">{data.monthLabel}</p>
          </div>
          {data.isCurrentMonth ? (
            <span
              aria-hidden="true"
              className="performance-month-nav__spacer"
            />
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

        <Form action="/performance" className="performance-filter">
          {data.canSwitchView ? (
            <label>
              <span>Vista</span>
              <select defaultValue={data.view} name="view">
                <option value="SELF">Mi rendimiento</option>
                <option value="TEAM">Mi equipo</option>
              </select>
            </label>
          ) : null}
          <label>
            <span>Mes</span>
            <input
              defaultValue={data.month}
              max={data.currentMonth}
              name="month"
              type="month"
            />
          </label>
          {data.showTeamFilter ? (
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
          {data.showAdvisorFilter ? (
            <label>
              <span>Asesor</span>
              <select defaultValue={data.agentFilter} name="agent">
                <option value="ALL">Todos los asesores</option>
                {data.advisorOptions.map((advisor) => (
                  <option key={advisor.id} value={advisor.id}>
                    {advisor.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="submit">Aplicar</button>
        </Form>
      </section>

      {/*
       * La jerarquia va por tamano, no por color. Antes las cuatro tarjetas
       * llevaban un `tone` distinto —primary, info, positive, attention— para
       * «destacar» cada una, con el resultado de que ninguna destacaba y de
       * que el color dejaba de significar estado. Ahora la cifra que define el
       * mes encabeza, y el color queda reservado para lo que exige atencion.
       */}
      <MetricGroup label="Indicadores principales">
        <Metric
          emphasis="hero"
          hint={delta(
            data.comparison.enteredDelta,
            data.comparison.comparedThroughDay,
          )}
          label="Ventas ingresadas"
          value={data.metrics.entered}
        />
        <Metric
          hint={`${percentage(data.metrics.deliveryRate)} de ${data.metrics.entered} ingresadas`}
          label="Ventas entregadas"
          value={data.metrics.delivered}
        />
        <Metric
          href={reconciliationHref(data, "PAYABLE")}
          hint={`${percentage(data.metrics.payableRate)} de ${data.metrics.portability} portabilidades · ver el detalle`}
          label="Portabilidades pagables"
          value={data.metrics.payable}
        />
        {data.view === "SELF" ? (
          <Metric
            hint={`${percentage(
              data.metrics.entered > 0
                ? data.metrics.activated / data.metrics.entered
                : null,
            )} de tus ventas ingresadas`}
            label="Ventas cerradas"
            value={data.metrics.activated}
          />
        ) : data.workforce ? (
          <Metric
            hint={`${data.workforce.sellersWithoutSales} sin producción · ${formatDecimal(data.workforce.averageEnteredPerSeller)} promedio${data.workforce.sellersWithoutSales > 0 ? " · ver quiénes" : ""}`}
            href={
              data.workforce.sellersWithoutSales > 0
                ? managementHref(data, "SIN_PRODUCCION")
                : undefined
            }
            label="Asesores con ventas"
            tone={
              data.workforce.sellersWithoutSales > 0 ? "warning" : "neutral"
            }
            value={`${data.workforce.sellersWithSales}/${data.workforce.activeSellers}`}
          />
        ) : null}
      </MetricGroup>

      <div className="performance-decision-grid">
        {data.view === "SELF" ? (
          <PersonalMonthlyProgress data={data} />
        ) : (
          <SalesTrendOverview data={data} />
        )}
        <section className="performance-panel performance-panel--attention">
          <header className="performance-panel__header">
            <div>
              <p className="performance-panel__eyebrow">Siguiente acción</p>
              <h2>Pendientes de intervención</h2>
            </div>
          </header>
          <div className="performance-actions">
            <Link href={ordersHref(data, "AWAITING_ACTIVATION")}>
              <span>Entregadas por activar</span>
              <strong>{data.metrics.deliveredPendingActivation}</strong>
              <small>Revisar órdenes que aún no generan pago</small>
            </Link>
            <Link href={ordersHref(data, "RECOVERY")}>
              <span>Pedidos por recuperar</span>
              <strong>{data.metrics.recovery}</strong>
              <small>No entregados o cancelados del mes, en Pedidos</small>
            </Link>
            <Link href={recoveryCasesHref(data)}>
              <span>Casos de recupero abiertos</span>
              <strong>{data.openRecoveryCases}</strong>
              <small>Con o sin responsable, en Recupero de ventas</small>
            </Link>
            {data.view !== "SELF" ? (
              <Link href={ordersHref(data, "ALL", { team: "UNASSIGNED" })}>
                <span>Sin asesor ni equipo</span>
                <strong>{data.metrics.unassigned}</strong>
                <small>Asignar antes de medir desempeño</small>
              </Link>
            ) : null}
          </div>
        </section>
      </div>

      <TeamSummaryPanel data={data} />

      <AdvisorBreakdown data={data} />

      <TeamDailyMatrix data={data} />

      <div className="performance-insight-grid">
        <section className="performance-panel">
          <header className="performance-panel__header">
            <div>
              <p className="performance-panel__eyebrow">Conversión</p>
              <h2>Avance de las ventas ingresadas</h2>
            </div>
            <span className="performance-panel__note">Todas las ventas</span>
          </header>
          <Funnel data={data} />
        </section>

        <SalesOperationMix data={data} />
      </div>

      {data.view === "SELF" ? <DailyPerformancePulse data={data} /> : null}

      {data.showCommission ? (
        <section className="performance-panel performance-commission">
          <header className="performance-panel__header">
            <div>
              <p className="performance-panel__eyebrow">Monto estimado</p>
              <h2>Comisión del período</h2>
              <p>
                Se confirma únicamente con portabilidades entregadas y cerradas.
              </p>
            </div>
            <div className="performance-commission__aside">
              <strong className="performance-commission__total">
                {money(data.metrics.estimatedCommissionCents)}
              </strong>
              <Link
                className="performance-commission__review"
                href={reconciliationHref(data, "ALL")}
              >
                Revisar cálculo
              </Link>
              {data.role !== "AGENT" ? (
                <Link
                  className="performance-commission__review"
                  href={`/performance/quotas?period=${data.month}`}
                >
                  Asignar cuotas
                </Link>
              ) : null}
            </div>
          </header>
          <div className="performance-commission__details">
            <div>
              <span>Portabilidades pagables</span>
              <strong>{data.metrics.payable}</strong>
              <small>
                {money(data.metrics.baseCommissionCents)} de comisión base
              </small>
            </div>
            {data.metrics.accelerators.map((accelerator) => (
              <div key={accelerator.key}>
                <span>{accelerator.label}</span>
                <strong>{money(accelerator.amountCents)}</strong>
                <small>
                  {accelerator.confirmed} cerradas de {accelerator.eligible}{" "}
                  registradas
                  {accelerator.delivered > accelerator.confirmed
                    ? ` · ${accelerator.delivered - accelerator.confirmed} entregadas por activar`
                    : ""}
                </small>
              </div>
            ))}
          </div>
          {/*
           * Lo que mueve la aguja del asesor: cuanto le falta para el
           * siguiente tramo y cuanto vale alcanzarlo (SPEC-038 BR-013).
           */}
          {data.view === "SELF" ? (
            <div className="performance-commission__details">
              {data.metrics.accelerators
                .filter((accelerator) => accelerator.nextTarget !== null)
                .map((accelerator) => (
                  <div key={`next-${accelerator.key}`}>
                    <span>
                      {accelerator.label}: te falta para el siguiente bono
                    </span>
                    <strong>
                      {accelerator.missingForNextTarget}{" "}
                      {accelerator.missingForNextTarget === 1
                        ? "cerrada"
                        : "cerradas"}
                    </strong>
                    <small>
                      para llegar a {accelerator.nextTarget} y sumar{" "}
                      {money(accelerator.nextTargetAmountCents)}
                    </small>
                  </div>
                ))}
            </div>
          ) : null}
          <p className="performance-commission__notice">
            Todavía puede cambiar: algunas ventas aún no se entregan ni se
            cierran. No es tu boleta de pago.
          </p>
        </section>
      ) : null}
    </div>
  );
}
