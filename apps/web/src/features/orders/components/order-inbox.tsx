"use client";

import Link from "next/link";
import Form from "next/form";
import { Fragment, useCallback, useEffect, useState } from "react";

import { formatCount } from "@repo/ui/format";
import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { Surface } from "@repo/ui/surface";

import { BulkCloseBar } from "./bulk-close-bar";
import { OrderNextStep } from "./order-next-step";
import { SaleOriginPicker, saleOriginLabels } from "./sale-origin-picker";
import { OrderStatusForm } from "./order-status-form";
import { OrderCancellationRequestPanel } from "./order-cancellation-request-panel";
import { OrderAssignmentResolution } from "./order-assignment-resolution";
import { OrderCorrectionForm } from "./order-correction-form";
import { OrderRealtimeStatus } from "./order-realtime-status";
import { OrderEscalationPanel } from "./order-escalation-panel";
import { SendOrderToRecoveryPanel } from "./send-order-to-recovery-panel";
import { OrderScopeFilters } from "./order-scope-filters";

import {
  getAdvisorOrderGroup,
  getAgrReasonText,
  groupAdvisorOrders,
} from "../advisor-order-groups";

import type {
  OrderAssignmentTeamOption,
  OrderInboxData,
  OrderFilter,
  OrderInboxItem,
  OrderSlaState,
} from "../order-inbox.types";
import type { OrderDueFilter } from "@repo/validation";

/*
 * SPEC-074 §4.1: cada pedido vive en una sola vista y cada vista lleva su
 * cifra. «Activos», «Incidencias» y «Entregados» se contenían entre sí; sus
 * enlaces antiguos siguen abriendo (ver `legacyFilterLabels`).
 */
const filterOptions: Array<{
  value: OrderFilter;
  label: string;
}> = [
  // «Por mover» era jerga nuestra; lo que el asesor espera es la entrega.
  { value: "TO_MOVE", label: "Por entregar" },
  { value: "LOGISTICS", label: "Entregas fallidas" },
  { value: "AWAITING_ACTIVATION", label: "Falta activar" },
  { value: "ESCALATIONS", label: "Escaladas" },
  { value: "DONE", label: "Cerrados" },
  { value: "ALL", label: "Todos" },
];

const legacyFilterLabels: Partial<Record<OrderFilter, string>> = {
  // SPEC-074 D2 (José, 25/09/2026): «Por recuperar» sale de Pedidos; esos
  // pedidos ya abren su caso y se trabajan en Recupero de ventas. La vista
  // sigue abriendo desde Rendimiento, que la usa para explicar su cifra.
  RECOVERY: "Por recuperar",
  ACTIVE: "Activos",
  INCIDENTS: "Incidencias",
  DELIVERED: "Entregados",
  FINAL: "Finalizados",
};

function visibleFilterOptions(
  current: OrderFilter,
): Array<{ value: OrderFilter; label: string }> {
  const legacy = legacyFilterLabels[current];
  return legacy
    ? [...filterOptions, { value: current, label: legacy }]
    : filterOptions;
}

const periodOptions: Array<{
  value: OrderInboxData["period"];
  label: string;
}> = [
  { value: "TODAY", label: "Hoy" },
  { value: "YESTERDAY", label: "Ayer" },
  { value: "WEEK", label: "Semana" },
  { value: "MONTH", label: "Mes actual" },
];

function ordersHref(
  data: OrderInboxData,
  overrides: {
    period?: OrderInboxData["period"];
    filter?: OrderFilter;
    search?: string;
    team?: string;
    advisor?: string;
    /** Un rango propio (fechas ISO), para lo de meses anteriores. */
    range?: { from: string; to: string };
    maximo?: string | null;
    due?: OrderDueFilter | null;
    page?: number;
  } = {},
): string {
  let period = overrides.period ?? data.period;
  let filter = overrides.filter ?? data.filter;

  // Recuperación es la cola operativa del mes en curso, no la fecha que el
  // usuario estaba explorando antes de abrirla.
  if (overrides.filter === "RECOVERY" && overrides.period === undefined) {
    period = "MONTH";
  } else if (
    overrides.period !== undefined &&
    data.filter === "RECOVERY" &&
    overrides.filter === undefined
  ) {
    filter = "ALL";
  }
  const search = overrides.search ?? data.search;
  const team = overrides.team ?? data.teamFilter;
  const advisor = overrides.advisor ?? data.advisorFilter;
  // El estado de Máximo solo filtra en la vista logística: al salir de ella
  // no viaja.
  const maximo =
    filter === "LOGISTICS"
      ? overrides.maximo === undefined
        ? data.maximoFilter
        : overrides.maximo
      : null;
  // SPEC-084: el plazo solo filtra lo que sigue en curso; en Falta activar,
  // Cerrados o Escaladas dejaba la lista vacía sin decir por qué.
  const due =
    filter === "TO_MOVE" || filter === "ALL"
      ? overrides.due === undefined
        ? data.dueFilter
        : overrides.due
      : null;
  const page = overrides.page ?? 1;
  const parameters = new URLSearchParams({ period });
  if (overrides.range) {
    parameters.set("period", "RANGE");
    parameters.set("from", overrides.range.from);
    parameters.set("to", overrides.range.to);
  } else if (period === "RANGE") {
    if (data.from) parameters.set("from", data.from);
    if (data.to) parameters.set("to", data.to);
  }
  if (filter !== "ALL") parameters.set("status", filter);
  if (search) parameters.set("q", search);
  if (team !== "ALL") parameters.set("team", team);
  if (advisor !== "ALL") parameters.set("advisor", advisor);
  if (maximo) parameters.set("maximo", maximo);
  if (due) parameters.set("plazo", due);
  if (data.returnTo) parameters.set("volver", data.returnTo);
  if (page > 1) parameters.set("page", String(page));
  return `/orders?${parameters.toString()}`;
}

function PeriodNavigation({ data }: { data: OrderInboxData }) {
  const advancedPeriodActive =
    data.period === "HISTORY" || data.period === "RANGE";
  const [rangeFrom, setRangeFrom] = useState(data.from ?? "");
  const [rangeTo, setRangeTo] = useState(data.to ?? "");

  if (data.filter === "ESCALATIONS" || data.filter === "LOGISTICS") {
    const logistics = data.filter === "LOGISTICS";
    return (
      <Surface className="ui-period-bar" raised>
        {/* SPEC-078: una línea; estas vistas no usan el período. */}
        <p className="text-sm text-ui-muted">
          {logistics
            ? `Desde el 10/08, según Máximo${
                data.logisticsSummary.lastFetchedAtLabel
                  ? ` · consultado ${data.logisticsSummary.lastFetchedAtLabel}`
                  : " · aún sin consultar hoy"
              }`
            : "De todas las fechas, hasta que supervisión las resuelva"}
        </p>
      </Surface>
    );
  }

  return (
    <Surface className="ui-period-bar" raised>
      {/* SPEC-078: el botón elegido ya dice el período; el texto solo hace
          falta para un rango o el histórico, que no tienen botón propio. */}
      {advancedPeriodActive ? (
        <p className="ui-period-bar__label">{data.periodLabel}</p>
      ) : null}

      <div className="ui-period-controls">
        <nav aria-label="Período de ventas" className="ui-period-navigation">
          {periodOptions.map((option) => (
            <Link
              aria-current={data.period === option.value ? "page" : undefined}
              className="ui-period-navigation__item"
              href={ordersHref(data, { period: option.value })}
              key={option.value}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <details
          className="ui-period-more"
          data-active={advancedPeriodActive ? "true" : "false"}
        >
          <summary>
            {data.period === "HISTORY"
              ? "Histórico"
              : data.period === "RANGE"
                ? "Rango personalizado"
                : "Histórico y rango"}
            <span aria-hidden="true">⌄</span>
          </summary>

          <div className="ui-period-more__panel">
            <Link
              aria-current={data.period === "HISTORY" ? "page" : undefined}
              className="ui-period-more__history"
              href={ordersHref(data, { period: "HISTORY" })}
            >
              <span>
                <strong>Histórico completo</strong>
                <small>Consulta ventas y pendientes anteriores.</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>

            <Form action="/orders" className="ui-period-range">
              <input name="period" type="hidden" value="RANGE" />
              {data.filter !== "ALL" ? (
                <input name="status" type="hidden" value={data.filter} />
              ) : null}
              {data.search ? (
                <input name="q" type="hidden" value={data.search} />
              ) : null}
              {data.teamFilter !== "ALL" ? (
                <input name="team" type="hidden" value={data.teamFilter} />
              ) : null}
              {data.advisorFilter !== "ALL" ? (
                <input
                  name="advisor"
                  type="hidden"
                  value={data.advisorFilter}
                />
              ) : null}
              {data.dueFilter ? (
                <input name="plazo" type="hidden" value={data.dueFilter} />
              ) : null}
              {data.returnTo ? (
                <input name="volver" type="hidden" value={data.returnTo} />
              ) : null}
              <label className="ui-period-range__field">
                <span>Desde</span>
                <input
                  max={rangeTo || data.rangeMaxDate}
                  name="from"
                  onChange={(event) => {
                    const nextFrom = event.target.value;
                    setRangeFrom(nextFrom);
                    if (rangeTo && nextFrom > rangeTo) setRangeTo("");
                  }}
                  required
                  type="date"
                  value={rangeFrom}
                />
              </label>
              <label className="ui-period-range__field">
                <span>Hasta</span>
                <input
                  max={data.rangeMaxDate}
                  min={rangeFrom || undefined}
                  name="to"
                  onChange={(event) => setRangeTo(event.target.value)}
                  required
                  type="date"
                  value={rangeTo}
                />
              </label>
              <button className="ui-period-range__submit" type="submit">
                Ver rango
              </button>
            </Form>
          </div>
        </details>
      </div>
    </Surface>
  );
}

type BadgeTone = "neutral" | "info" | "warning" | "danger" | "success";

function getStatusTone(status: string): BadgeTone {
  switch (status) {
    case "OPEN":
      return "info";

    // SPEC-077: enviado es el paso normal, no una alerta. El ámbar queda
    // para cuando Máximo reporta un problema.
    case "SENT":
      return "neutral";

    case "CLOSED":
      return "success";

    case "CANCELLED":
      return "danger";

    default:
      return "neutral";
  }
}

function getSlaTone(state: OrderSlaState): BadgeTone {
  switch (state) {
    case "OVERDUE":
      return "danger";

    case "DUE_SOON":
      return "warning";

    case "ON_TIME":
      return "success";

    case "PENDING_SHIFT":
      return "info";

    case "CLOSED":
      return "neutral";

    default:
      return "info";
  }
}

function StatusBadge({
  order,
  showAgr = true,
  showEscalationAction = true,
}: {
  order: OrderInboxItem;
  showAgr?: boolean;
  showEscalationAction?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {/* Estado y avance de la entrega en una sola etiqueta (SPEC-077). */}
      <span className="ui-order-badge" data-tone={getStatusTone(order.status)}>
        {order.sentSubstatusLabel
          ? `${order.statusLabel} · ${order.sentSubstatusLabel}`
          : order.statusLabel}
      </span>

      {order.noStatusIncident ? (
        <span className="ui-order-badge" data-tone="danger">
          Sin avance hace más de 10 min
        </span>
      ) : null}

      {showAgr && order.agrDelivery && !order.agrDelivery.stale ? (
        <span
          className="ui-order-badge"
          data-tone={order.agrDelivery.opportunity ? "warning" : undefined}
        >
          Máximo: {order.agrDelivery.estadoPedido}
        </span>
      ) : null}

      {order.pendingCancellationRequest ? (
        <span className="ui-order-badge" data-tone="warning">
          Cancelación pendiente
        </span>
      ) : null}

      {showEscalationAction &&
      (order.incidentEscalation || order.canEscalate) ? (
        <OrderEscalationPanel order={order} />
      ) : null}

      {!showEscalationAction && order.incidentEscalation ? (
        <span className="ui-order-badge" data-tone="danger">
          Escalada
        </span>
      ) : null}
    </div>
  );
}

function SlaBadge({ order }: { order: OrderInboxItem }) {
  return (
    <span className="ui-order-sla" data-tone={getSlaTone(order.slaState)}>
      {order.slaLabel}
    </span>
  );
}

function getOperatorLabel(order: OrderInboxItem): string {
  if (order.commercialOperation === "NEW_LINE") return "Alta nueva";
  if (order.carrier === "UNKNOWN") return "Sin definir";

  const normalized = order.carrier.toLocaleLowerCase("es-PE");
  return `${normalized.charAt(0).toLocaleUpperCase("es-PE")}${normalized.slice(1)}`;
}

/*
 * Nomenclatura del equipo: operacion, operador cedente y modalidad, en ese
 * orden. "Porta Claro Post", "Porta Bitel Pre", "Alta Nueva".
 */
function getOperationSummary(order: OrderInboxItem): string {
  if (order.commercialOperation === "NEW_LINE") {
    return "Alta Nueva";
  }

  const modality =
    order.commercialOperation === "PORT_POSTPAID"
      ? "Post"
      : order.commercialOperation === "PORT_PREPAID"
        ? "Pre"
        : null;

  if (!modality) {
    return "Sin clasificar";
  }

  const carrier = getOperatorLabel(order);

  return ["Porta", carrier === "Sin definir" ? null : carrier, modality]
    .filter(Boolean)
    .join(" ");
}

function DetailItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "ui-order-detail-grid__item--wide" : undefined}>
      <dt>{label}</dt>
      <dd>{value || "No registrado"}</dd>
    </div>
  );
}

/**
 * SPEC-075: lo que manda Máximo, tal cual. Antes se traducía el estado y el
 * motivo a frases propias y se proponía una acción; el equipo pidió ver el
 * dato original porque la traducción dejaba información fuera.
 */
function AgrDeliveryPanel({ order }: { order: OrderInboxItem }) {
  const agr = order.agrDelivery;
  if (!agr) return null;

  return (
    <section
      aria-label="Lo que dice Máximo"
      className="ui-order-notice"
      data-tone={agr.opportunity && !agr.stale ? "warning" : "neutral"}
    >
      <h4 className="ui-order-notice__headline">
        <span className="ui-order-notice__source">
          {agr.stale ? "Último dato de Máximo" : "Máximo"}
        </span>
        {" · "}
        {agr.estadoPedido}
      </h4>
      <dl className="ui-order-notice__details">
        {agr.fields
          .filter((field) => field.key !== "estado_pedido")
          .map((field) => (
            <DetailItem
              key={field.key}
              label={field.label}
              value={field.value}
            />
          ))}
      </dl>
      <p className="mt-2 text-xs text-ui-muted">
        {agr.stale
          ? `Del ${agr.fetchedAtLabel}. Ya no se consulta: el pedido está ${
              order.status === "CLOSED" ? "cerrado" : "entregado"
            }.`
          : `Consultado ${agr.fetchedAtLabel}`}
      </p>
    </section>
  );
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) throw new Error("Clipboard unavailable");
}

function InlineCopyValue({
  label,
  value,
  variant = "table",
}: {
  label: string;
  value: string;
  variant?: "table" | "heading";
}) {
  const [copyState, setCopyState] = useState<"COPIED" | "ERROR" | null>(null);

  useEffect(() => {
    if (copyState === null) return;

    const timeout = window.setTimeout(() => {
      setCopyState(null);
    }, 2_000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copyState]);

  async function copyValue() {
    try {
      await copyTextToClipboard(value);
      setCopyState("COPIED");
    } catch {
      setCopyState("ERROR");
    }
  }

  const feedback =
    copyState === "COPIED"
      ? `${label} copiado`
      : copyState === "ERROR"
        ? `No se pudo copiar ${label}`
        : `Copiar ${label}`;

  return (
    <button
      aria-label={`${feedback}: ${value}`}
      className={[
        "rounded px-0.5 underline decoration-dotted underline-offset-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2",
        variant === "heading"
          ? "font-mono text-sm font-semibold"
          : "font-medium",
        copyState === "COPIED"
          ? "bg-ui-success-soft text-ui-success decoration-ui-success"
          : copyState === "ERROR"
            ? "bg-ui-danger-soft text-ui-danger decoration-ui-danger"
            : variant === "heading"
              ? "text-ui-text decoration-ui-soft hover:bg-ui-subtle"
              : "text-ui-muted decoration-ui-soft hover:bg-ui-subtle hover:text-ui-text",
      ].join(" ")}
      onClick={copyValue}
      title={`${feedback}: ${value}`}
      type="button"
    >
      {value}
      <span aria-live="polite" className="sr-only">
        {copyState === "COPIED"
          ? `${label} copiado al portapapeles`
          : copyState === "ERROR"
            ? `No se pudo copiar ${label}`
            : ""}
      </span>
    </button>
  );
}

function OrderDetails({
  order,
  assignmentTeams,
  showAdvisor,
  onStepStart,
  onStepFailed,
}: {
  order: OrderInboxItem;
  assignmentTeams: OrderAssignmentTeamOption[];
  showAdvisor: boolean;
  /** Al tocar un paso, pasar al pedido de abajo (escritorio, SPEC-084). */
  onStepStart?: () => void;
  onStepFailed?: () => void;
}) {
  const [operationDetailsOpen, setOperationDetailsOpen] = useState(
    showAdvisor || !order.canUpdate,
  );

  const formKey = [
    order.id,
    order.status,
    order.sentSubstatus ?? "none",
    order.deliveryObservation ?? "none",
  ].join(":");

  /*
   * SPEC-003 BR-002 los mantiene separados como dato, pero DITO viene enviando
   * el mismo numero en ambos. Solo se muestra cuando aporta algo distinto de
   * lo que ya declara la cabecera.
   */
  const showContactPhone = order.deliveryContactPhone !== order.serviceNumber;

  const coordinates =
    order.deliveryLatitude && order.deliveryLongitude
      ? `${order.deliveryLatitude}, ${order.deliveryLongitude}`
      : null;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p>
              <InlineCopyValue
                label="orden"
                value={order.orderCode}
                variant="heading"
              />
            </p>

            <p className="mt-1 text-xs text-ui-muted">
              Registrado {order.registeredAtLabel}
            </p>
          </div>

          <SlaBadge order={order} />
        </div>

        <div className="mt-3">
          <StatusBadge
            order={order}
            showAgr={false}
            showEscalationAction={false}
          />
        </div>

        {order.parseStatus !== "PARSED" ? (
          <p className="mt-3 rounded-lg border border-ui-warning-border bg-ui-warning-soft px-3 py-2 text-sm font-semibold text-ui-warning">
            Faltan datos: vuelve a exportar el pedido desde DITO con el detalle
            abierto, o complétalos a mano aquí.
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-ui-text">
          {order.holderName}
        </h3>

        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ui-muted">
          <span>DNI</span>
          <InlineCopyValue label="DNI" value={order.documentNumber} />
          <span aria-hidden="true">·</span>
          <InlineCopyValue
            label="número de operación"
            value={order.serviceNumber}
          />
        </p>

        <div className="mt-3">
          <SaleOriginPicker key={order.saleOrigin ?? "sin"} order={order} />
        </div>
      </div>

      {/* SPEC-073: lo que hay que hacer con la venta va antes de su ficha. */}
      <AgrDeliveryPanel order={order} />

      {order.canResolveAssignment || order.canClaimAssignment ? (
        <OrderAssignmentResolution order={order} teams={assignmentTeams} />
      ) : null}

      {order.pendingCancellationRequest ? (
        <OrderCancellationRequestPanel
          canReview={order.canReviewCancellation}
          request={order.pendingCancellationRequest}
        />
      ) : null}

      {order.incidentEscalation ? <OrderEscalationPanel order={order} /> : null}

      {order.canUpdate || showAdvisor ? (
        <section className="ui-order-management" aria-label="¿En qué va?">
          <h4 className="mb-3 text-sm font-semibold text-ui-text">
            ¿En qué va?
          </h4>

          {/* SPEC-074 §4.3: un botón por resultado; guarda y sigue. */}
          <OrderNextStep
            key={formKey}
            onStepFailed={onStepFailed}
            onStepStart={onStepStart}
            order={order}
          />

          {/*
           * Lo que no es un paso adelante —volver a Abierto, pedir o hacer una
           * cancelación— sigue en el formulario completo, plegado.
           */}
          {order.canUpdate ? (
            <details className="ui-order-disclosure mt-4">
              <summary>
                <span>Otro cambio</span>
                <span className="ui-order-disclosure__hint">
                  {order.canCancelDirectly
                    ? "Volver a Abierto o cancelar"
                    : order.canRequestCancellation
                      ? "Volver a Abierto o pedir cancelación"
                      : "Volver a Abierto"}
                </span>
              </summary>
              <div className="ui-order-disclosure__content">
                <OrderStatusForm
                  key={formKey}
                  canCancelDirectly={order.canCancelDirectly}
                  canClose={order.canClose}
                  canRequestCancellation={order.canRequestCancellation}
                  canUpdate={order.canUpdate}
                  initialObservation={order.deliveryObservation}
                  initialSentSubstatus={order.sentSubstatus}
                  initialStatus={order.status}
                  orderId={order.id}
                />
              </div>
            </details>
          ) : null}

          {/*
           * Escalar es gestionar la venta, no un aviso paralelo: va dentro de
           * esta zona como accion secundaria. Una incidencia ya escalada si es
           * situacion y se muestra arriba, junto al diagnostico.
           */}
          {!order.incidentEscalation && order.canEscalate ? (
            <div className="ui-order-secondary-action">
              <OrderEscalationPanel order={order} />
            </div>
          ) : null}

          {order.canSendToRecovery || order.recoveryCase ? (
            <div className="ui-order-secondary-action">
              <SendOrderToRecoveryPanel order={order} />
            </div>
          ) : null}
        </section>
      ) : null}

      <dl className="ui-order-identity">
        <div>
          <dt>Operación</dt>
          <dd>
            {getOperationSummary(order)}
            {order.fixedCharge
              ? ` ${Number(order.fixedCharge).toFixed(2)}`
              : ""}
          </dd>
        </div>

        <div>
          <dt>Último cambio</dt>
          <dd>hace {order.statusAgeLabel}</dd>
        </div>

        {showAdvisor ? (
          <>
            <div>
              <dt>Asesor</dt>
              <dd>{order.agentName || "Sin asesor asignado"}</dd>
            </div>

            <div>
              <dt>Ubicación</dt>
              <dd>{order.locationLabel}</dd>
            </div>
          </>
        ) : null}

        <div>
          <dt>Tipo de entrega</dt>
          <dd>{order.deliveryMethodLabel}</dd>
        </div>

        <div>
          <dt>Horario de entrega</dt>
          <dd>
            {order.slaState === "PENDING_SHIFT"
              ? "Aún sin horario"
              : order.deliveryWindowLabel}
          </dd>
        </div>

        {/* SPEC-078: «Asignado» no dice nada; solo se muestra lo que falta. */}
        {showAdvisor ? (
          order.assignmentStatusLabel !== "Asignado" ? (
            <div>
              <dt>Asignación</dt>
              <dd>{order.assignmentStatusLabel}</dd>
            </div>
          ) : null
        ) : (
          <div className="ui-order-identity__item--wide">
            <dt>Ubicación</dt>
            <dd>{order.locationLabel}</dd>
          </div>
        )}
      </dl>

      <details
        className="ui-order-disclosure"
        onToggle={(event) => {
          setOperationDetailsOpen(event.currentTarget.open);
        }}
        open={operationDetailsOpen}
      >
        <summary>
          <span>Datos de la venta</span>
          <span className="ui-order-disclosure__hint">
            Seguimiento, dirección y facturación
          </span>
        </summary>

        <div className="ui-order-disclosure__content">
          <dl className="ui-order-detail-grid">
            {order.status === "CLOSED" ? (
              <DetailItem
                label="Cierre"
                value={
                  order.closedByName && order.closedAtLabel
                    ? `${order.closedByName} · ${order.closedAtLabel}`
                    : "Cerrada antes del sistema; no se sabe quién"
                }
              />
            ) : null}

            {!order.canUpdate && order.deliveryObservation ? (
              <DetailItem
                label="Última observación"
                wide
                value={order.deliveryObservation}
              />
            ) : null}

            {order.salesCode ? (
              <DetailItem label="Código de venta" value={order.salesCode} />
            ) : null}

            {order.deliveryTimeRange ? (
              <DetailItem
                label="Horario de entrega"
                value={order.deliveryTimeRange}
              />
            ) : null}

            {order.billingCycleDay ? (
              <DetailItem
                label="Ciclo de facturación"
                value={`Día ${order.billingCycleDay} de cada mes`}
              />
            ) : null}

            {order.paymentDueDay ? (
              <DetailItem
                label="Último día de pago"
                value={`Día ${order.paymentDueDay} de cada mes`}
              />
            ) : null}

            {showContactPhone ? (
              <DetailItem
                label="Teléfono de contacto"
                value={order.deliveryContactPhone}
              />
            ) : null}

            {order.deliveryAddress ? (
              <DetailItem
                label="Dirección de entrega"
                wide
                value={order.deliveryAddress}
              />
            ) : null}

            {order.deliveryReference ? (
              <DetailItem
                label="Referencia"
                wide
                value={order.deliveryReference}
              />
            ) : null}

            {coordinates ? (
              <DetailItem label="Coordenadas" value={coordinates} wide />
            ) : null}
          </dl>
        </div>
      </details>

      {order.canCorrect ? <OrderCorrectionForm order={order} /> : null}
    </div>
  );
}

function MobileOrderCard({
  order,
  assignmentTeams,
  expanded,
  onToggle,
  showAdvisor,
}: {
  order: OrderInboxItem;
  assignmentTeams: OrderAssignmentTeamOption[];
  expanded: boolean;
  onToggle: () => void;
  showAdvisor: boolean;
}) {
  return (
    <article
      className={[
        "overflow-hidden rounded-2xl border bg-ui-surface shadow-sm",
        order.noStatusIncident
          ? "border-ui-danger-border"
          : order.sentSubstatus === "NOT_DELIVERED"
            ? "border-ui-warning-border"
            : "border-ui-border",
      ].join(" ")}
    >
      <button
        aria-expanded={expanded}
        className="w-full p-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-ui-muted">
              {order.orderCode}
            </p>

            <h3 className="mt-1 truncate text-base font-semibold text-ui-text">
              {order.holderName}
            </h3>

            <p className="mt-1 text-sm text-ui-muted">
              DNI {order.documentNumber} · {order.serviceNumber}
            </p>

            <p className="mt-1 text-xs text-ui-soft">
              {getOperatorLabel(order)}
            </p>

            {showAdvisor ? (
              <p className="mt-1 text-sm font-medium text-ui-text">
                <span className="text-xs font-normal text-ui-soft">
                  Asesor{" "}
                </span>
                {order.agentName || "Sin asesor asignado"}
              </p>
            ) : null}
          </div>

          <span className="shrink-0 text-xl text-ui-soft">
            {expanded ? "−" : "+"}
          </span>
        </div>

        <div className="mt-3">
          <StatusBadge order={order} showEscalationAction={false} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-ui-muted">
            Último cambio hace {order.statusAgeLabel}
          </p>

          <SlaBadge order={order} />
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-ui-border p-4">
          <OrderDetails
            assignmentTeams={assignmentTeams}
            order={order}
            showAdvisor={showAdvisor}
          />
        </div>
      ) : null}
    </article>
  );
}

/** SPEC-079: se puede cerrar en bloque lo entregado que el rol puede cerrar. */
function canBulkClose(order: OrderInboxItem): boolean {
  return (
    order.canClose &&
    order.status !== "CLOSED" &&
    order.status !== "CANCELLED" &&
    !order.pendingCancellationRequest
  );
}

function DesktopOrderList({
  items,
  selectedOrderId,
  onSelect,
  showAdvisorColumn,
  checked,
  onToggleChecked,
  groups,
  expandedGroups,
  onToggleGroup,
}: {
  items: OrderInboxItem[];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
  showAdvisorColumn: boolean;
  /** SPEC-079: casillas para cerrar varios; solo en «Falta activar». */
  checked?: ReadonlySet<string>;
  onToggleChecked?: (orderId: string) => void;
  /** SPEC-080: la hoja del asesor, agrupada por lo que toca. */
  groups?: ReturnType<typeof groupAdvisorOrders<OrderInboxItem>>;
  expandedGroups?: ReadonlySet<string>;
  onToggleGroup?: (key: string) => void;
}) {
  /*
   * SPEC-073: la hoja es una línea por venta cuando cabe. Cuando la lista es
   * angosta (laptop con el panel de gestión al lado), cada venta pasa a dos
   * líneas —cliente y plazo; estado, acción y quién— en lugar de cortarse
   * con desplazamiento lateral. Lo decide el ancho de la lista, no la
   * pantalla: ver `@container order-list` en patterns.css.
   */
  const renderRow = (order: OrderInboxItem) => {
    const selected = selectedOrderId === order.id;
    const reason =
      groups && getAdvisorOrderGroup(order) === "fallida"
        ? getAgrReasonText(order)
        : null;

    return (
      <div
        aria-pressed={selected}
        className="ui-order-grid__row"
        data-incident={order.noStatusIncident ? "true" : "false"}
        data-order-row={order.id}
        data-selected={selected ? "true" : "false"}
        data-show-advisor={showAdvisorColumn ? "true" : "false"}
        key={order.id}
        onClick={() => onSelect(order.id)}
        onKeyDown={(event) => {
          // SPEC-074: ↑ y ↓ recorren la hoja; Enter o espacio eligen.
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(order.id);
            return;
          }
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
            return;
          }
          event.preventDefault();
          // Entre grupos hay cabeceras: se recorre la lista de filas.
          const rows = Array.from(
            event.currentTarget
              .closest(".ui-order-grid")
              ?.querySelectorAll<HTMLElement>("[data-order-row]") ?? [],
          );
          const index = rows.indexOf(event.currentTarget);
          const sibling =
            rows[event.key === "ArrowDown" ? index + 1 : index - 1];
          if (sibling?.dataset.orderRow) {
            sibling.focus();
            onSelect(sibling.dataset.orderRow);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {/* SPEC-074: elegir la fila ya no copia nada; copiar, en el panel. */}
        <span className="ui-order-grid__order-code truncate">
          {order.orderCode}
        </span>

        <span
          className="ui-order-grid__client"
          data-checkable={checked ? "true" : undefined}
        >
          {checked && onToggleChecked ? (
            <input
              aria-label={`Marcar ${order.orderCode} para cerrar`}
              checked={checked.has(order.id)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--ui-accent)]"
              disabled={!canBulkClose(order)}
              onChange={() => onToggleChecked(order.id)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              type="checkbox"
            />
          ) : null}
          <span className="ui-order-grid__client-text">
            <strong>{order.holderName}</strong>
            {/* Solo en dos líneas: lo que las columnas ocultas decían. */}
            <small className="ui-order-grid__meta">
              {[
                order.orderCode,
                getOperatorLabel(order),
                order.saleOrigin ? saleOriginLabels[order.saleOrigin] : null,
                showAdvisorColumn
                  ? order.agentName || "Sin asesor"
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
            {/* SPEC-080: en la entrega fallida, por qué, según Máximo. */}
            {reason ? (
              <small className="ui-order-grid__reason">
                Máximo: {reason}
              </small>
            ) : null}
          </span>
        </span>

        <span className="ui-order-grid__plain">{order.documentNumber}</span>

        <span className="ui-order-grid__plain">{order.serviceNumber}</span>

        <span className="ui-order-grid__carrier">
          {getOperatorLabel(order)}
        </span>

        {showAdvisorColumn ? (
          <span className="ui-order-grid__agent">
            {order.agentName}
          </span>
        ) : null}

        <span className="ui-order-grid__status">
          <StatusBadge
            order={order}
            showAgr={false}
            showEscalationAction={false}
          />
          {order.agrDelivery && !order.agrDelivery.stale ? (
            <span
              className="ui-order-badge ui-order-grid__inline-action"
              data-tone={
                order.agrDelivery.opportunity ? "warning" : undefined
              }
            >
              Máximo: {order.agrDelivery.estadoPedido}
            </span>
          ) : null}
        </span>

        <span className="ui-order-grid__action">
          {/* Cerrado o entregado: Máximo ya no se consulta y su último
              dato («AGENDADO») confundiría. */}
          {order.agrDelivery && !order.agrDelivery.stale ? (
            <span
              className="ui-order-badge"
              data-tone={
                order.agrDelivery.opportunity ? "warning" : undefined
              }
              title={order.agrDelivery.estadoPedido}
            >
              {order.agrDelivery.estadoPedido}
            </span>
          ) : (
            <span aria-hidden="true" className="text-ui-soft">
              —
            </span>
          )}
        </span>

        <span className="ui-order-grid__sla">
          <SlaBadge order={order} />
        </span>
      </div>
    );
  };

  return (
    <div className="ui-order-grid">
      <div className="ui-order-grid__scroll">
        <div
          className="ui-order-grid__header"
          data-show-advisor={showAdvisorColumn ? "true" : "false"}
        >
          <span>Orden</span>
          <span>Cliente</span>
          <span>DNI</span>
          <span>Teléfono</span>
          <span>Operador</span>
          {showAdvisorColumn ? <span>Asesor</span> : null}
          <span>Estado</span>
          <span>Máximo</span>
          <span>Plazo</span>
        </div>

        <div className="ui-order-grid__body">
          {groups
            ? groups.map((group) => {
                const open =
                  !group.collapsed || (expandedGroups?.has(group.key) ?? false);
                return (
                  <Fragment key={group.key}>
                    <div className="ui-order-grid__group">
                      <span>
                        {group.label}{" "}
                        <span className="text-ui-muted">
                          {formatCount(group.items.length)}
                        </span>
                      </span>
                      {group.hint ? (
                        <span className="text-xs font-normal text-ui-muted">
                          {group.hint}
                        </span>
                      ) : null}
                      {group.collapsed ? (
                        <button
                          aria-expanded={open}
                          className="ml-auto text-xs font-semibold text-ui-accent hover:underline"
                          onClick={() => onToggleGroup?.(group.key)}
                          type="button"
                        >
                          {open ? "Ocultar" : "Ver"}
                        </button>
                      ) : null}
                    </div>
                    {open ? group.items.map(renderRow) : null}
                  </Fragment>
                );
              })
            : items.map(renderRow)}
        </div>
      </div>
    </div>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

/**
 * SPEC-081: supervisión y administración ven primero a su equipo, una fila
 * por asesor con lo pendiente; cada cifra abre esa lista ya filtrada. Arriba
 * quien tiene más entregas fallidas y fuera de plazo.
 */
function AdvisorSummary({ data }: { data: OrderInboxData }) {
  const [showAll, setShowAll] = useState(false);
  const rows = data.advisorSummary ?? [];
  if (rows.length === 0) return null;

  const severalTeams = new Set(rows.map((row) => row.teamName)).size > 1;
  const visible = showAll ? rows : rows.slice(0, 6);
  const cell = (
    value: number,
    href: string,
    tone?: "danger" | "warning",
    className = "",
  ) => (
    <td className={`px-3 py-2 text-right tabular-nums ${className}`}>
      {value > 0 ? (
        <Link
          className={[
            "font-semibold hover:underline",
            tone === "danger"
              ? "text-ui-danger"
              : tone === "warning"
                ? "text-ui-warning"
                : "text-ui-text",
          ].join(" ")}
          href={href}
        >
          {formatCount(value)}
        </Link>
      ) : (
        <span className="text-ui-soft">—</span>
      )}
    </td>
  );

  return (
    <section
      aria-label="Por asesor"
      className="overflow-x-auto rounded-lg border border-ui-border bg-ui-surface"
    >
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ui-muted">
          <tr className="border-b border-ui-border">
            <th className="px-3 py-2 font-semibold">Asesor</th>
            <th className="px-3 py-2 text-right font-semibold">
              Entregas fallidas
            </th>
            <th className="px-3 py-2 text-right font-semibold">
              Fuera de plazo
            </th>
            <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">
              Por entregar
            </th>
            <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">
              Falta activar
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const current = data.advisorFilter === row.id;
            return (
              <tr
                className={[
                  "border-b border-ui-border last:border-b-0",
                  current ? "bg-ui-accent-soft" : "",
                ].join(" ")}
                key={row.id}
              >
                <td className="px-3 py-2">
                  <Link
                    aria-current={current ? "true" : undefined}
                    className="font-semibold text-ui-text hover:underline"
                    href={ordersHref(data, {
                      advisor: current ? "ALL" : row.id,
                    })}
                  >
                    {row.name}
                  </Link>
                  {severalTeams ? (
                    <span className="ml-2 text-xs text-ui-muted">
                      {row.teamName}
                    </span>
                  ) : null}
                </td>
                {cell(
                  row.failed,
                  ordersHref(data, { advisor: row.id, filter: "LOGISTICS" }),
                  "warning",
                )}
                {cell(
                  row.overdue,
                  ordersHref(data, {
                    advisor: row.id,
                    filter: "TO_MOVE",
                    due: "vencido",
                  }),
                  "danger",
                )}
                {cell(
                  row.toDeliver,
                  ordersHref(data, { advisor: row.id, filter: "TO_MOVE" }),
                  undefined,
                  "hidden sm:table-cell",
                )}
                {cell(
                  row.awaiting,
                  ordersHref(data, {
                    advisor: row.id,
                    filter: "AWAITING_ACTIVATION",
                  }),
                  undefined,
                  "hidden sm:table-cell",
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 6 ? (
        <button
          className="w-full border-t border-ui-border px-3 py-2 text-left text-xs font-semibold text-ui-accent hover:bg-ui-subtle"
          onClick={() => setShowAll((value) => !value)}
          type="button"
        >
          {showAll ? "Ver menos" : `Ver los ${formatCount(rows.length)} asesores`}
        </button>
      ) : null}
    </section>
  );
}

/** SPEC-078: el vacío de cada vista, corto y dicho como resultado. */
function emptyStateFor(data: OrderInboxData): {
  title: string;
  description: string;
} {
  if (data.search || data.dueFilter || data.maximoFilter) {
    return {
      title: "Sin coincidencias",
      description: "Prueba con otra búsqueda o quita un filtro.",
    };
  }
  switch (data.filter) {
    case "TO_MOVE":
      return {
        title: "Nada por entregar",
        description: "Todo lo del período ya se entregó, se cerró o está en otra vista.",
      };
    case "LOGISTICS":
      return { title: "Sin entregas fallidas", description: "Máximo no reporta ninguna." };
    case "AWAITING_ACTIVATION":
      return { title: "Nada por activar", description: "Lo entregado ya se cerró." };
    case "ESCALATIONS":
      return { title: "Nada escalado", description: "Supervisión no tiene casos pendientes." };
    case "RECOVERY":
      return {
        title: "Nada por recuperar",
        description: "Sin pedidos no entregados ni cancelados este mes.",
      };
    default:
      break;
  }
  if (data.teamFilter === "UNASSIGNED") {
    return { title: "Todo está asignado", description: "No hay ventas sin asesor en el período." };
  }
  return {
    title: "Sin ventas en el período",
    description: "Elige otro período arriba.",
  };
}

function SummaryFigure({
  label,
  value,
  href,
  current = false,
}: {
  label: string;
  value: number;
  href?: string;
  current?: boolean;
}) {
  const content = (
    <>
      {label}{" "}
      <strong className="text-base tabular-nums text-ui-text">
        {formatCount(value)}
      </strong>
    </>
  );

  return href ? (
    <Link
      aria-current={current ? "page" : undefined}
      className="underline-offset-2 hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-ui-text"
      href={href}
    >
      {content}
    </Link>
  ) : (
    <span>{content}</span>
  );
}

function OrderSummary({ data }: { data: OrderInboxData }) {
  const logistics = data.filter === "LOGISTICS";
  const recoveryQueueCount =
    data.filter === "RECOVERY" ? data.filteredTotal : data.totals.recovery;

  return (
    <section
      aria-label="Resumen de pedidos"
      className="rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-sm text-ui-muted"
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {logistics ? (
          <>
            <SummaryFigure
              current={!data.maximoFilter}
              href={ordersHref(data, { maximo: null })}
              label="Por revisar"
              value={data.logisticsSummary.total}
            />
            {/* SPEC-075: agrupados por el estado que manda Máximo, tal cual. */}
            {data.logisticsSummary.byState.map((item) => (
              <SummaryFigure
                current={data.maximoFilter === item.state}
                href={ordersHref(data, { maximo: item.state })}
                key={item.state}
                label={item.state}
                value={item.count}
              />
            ))}
          </>
        ) : (
          <>
            <SummaryFigure
              label="Ventas"
              value={data.totals.visible}
            />
            <SummaryFigure label="Entregados" value={data.totals.delivered} />
            <SummaryFigure
              label="No entregados"
              value={data.totals.notDelivered}
            />
          </>
        )}
      </div>

      {data.filter === "DONE" ? (
        <p className="mt-2 text-xs">
          Los no entregados y cancelados que aún pueden volverse venta se
          trabajan en{" "}
          <Link className="text-ui-accent hover:underline" href="/recovery/sales">
            Recupero de ventas
          </Link>
          .
        </p>
      ) : null}

      {data.filter === "RECOVERY" ? (
        <p className="mt-2 text-xs">
          {plural(
            recoveryQueueCount,
            "pedido no entregado o cancelado",
            "pedidos no entregados o cancelados",
          )}{" "}
          que aún pueden volverse venta. Los casos con responsable y
          seguimiento están en{" "}
          <Link className="text-ui-accent hover:underline" href="/recovery/sales">
            Recupero de ventas
          </Link>
          .
        </p>
      ) : null}

      {/*
       * SPEC-074: los avisos de «por atender» repetían las pestañas, que ahora
       * llevan su cifra. Queda lo que ninguna pestaña muestra: lo pendiente de
       * meses anteriores, fuera del período.
       */}
      {!logistics &&
      data.period !== "HISTORY" &&
      data.period !== "RANGE" &&
      data.priorPending.toMove + data.priorPending.awaiting > 0 ? (
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs">
          <span className="text-ui-muted">
            {data.period === "TODAY"
              ? "Antes de hoy:"
              : data.period === "YESTERDAY"
                ? "Antes de ayer:"
                : data.period === "WEEK"
                  ? "Antes de esta semana:"
                  : "Antes de este mes:"}
          </span>
          {data.priorPending.toMove > 0 ? (
            <Link
              className="font-semibold text-ui-warning hover:underline"
              href={ordersHref(data, {
                range: data.priorPending,
                filter: data.role === "AGENT" ? "ALL" : "TO_MOVE",
                search: "",
                due: null,
              })}
            >
              {formatCount(data.priorPending.toMove)} por entregar →
            </Link>
          ) : null}
          {data.priorPending.awaiting > 0 ? (
            <Link
              className="font-semibold text-ui-warning hover:underline"
              href={ordersHref(data, {
                range: data.priorPending,
                filter: data.role === "AGENT" ? "ALL" : "AWAITING_ACTIVATION",
                search: "",
                due: null,
              })}
            >
              {formatCount(data.priorPending.awaiting)} por activar →
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

export function OrderInbox({ data }: { data: OrderInboxData }) {
  // SPEC-080: el asesor ve su mes en una sola lista agrupada, sin pestañas.
  const advisorSheet = data.role === "AGENT";
  const groups = advisorSheet ? groupAdvisorOrders(data.items) : null;
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  // El orden en pantalla: por grupo, y dentro de cada uno por urgencia.
  const displayItems = groups
    ? groups
        .filter((group) => !group.collapsed || expandedGroups.has(group.key))
        .flatMap((group) => group.items)
    : data.items;
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    displayItems[0]?.id ?? null,
  );
  const selectedOrder =
    data.items.find((order) => {
      return order.id === selectedOrderId;
    }) ?? null;

  /*
   * El canal en tiempo real refresca los datos del servidor sin desmontar este
   * componente, asi que la venta seleccionada puede dejar de pertenecer al
   * filtro mientras se la esta gestionando. Antes se sustituia en silencio por
   * la primera de la lista, con el riesgo de actuar sobre la venta equivocada.
   */
  const selectionLeftView = selectedOrderId !== null && selectedOrder === null;

  // SPEC-079: en «Falta activar», marcar varios y cerrarlos de una vez.
  const closable =
    data.filter === "AWAITING_ACTIVATION" ? data.items.filter(canBulkClose) : [];
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const visibleChecked = checkedIds.filter((id) =>
    closable.some((order) => order.id === id),
  );
  const checkedSet = new Set(visibleChecked);
  const toggleChecked = useCallback((orderId: string) => {
    setCheckedIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  }, []);
  const clearChecked = useCallback(() => setCheckedIds([]), []);

  /*
   * SPEC-084: al cambiar de vista (pestaña, período, filtros, página) la
   * selección y las casillas empiezan de nuevo. Antes sobrevivían, y el panel
   * decía «Esta venta salió de la bandeja» por un motivo que no era cierto.
   */
  const viewKey = [
    data.filter,
    data.period,
    data.from,
    data.to,
    data.teamFilter,
    data.advisorFilter,
    data.search,
    data.dueFilter,
    data.maximoFilter,
    data.pagination.page,
  ].join("|");
  const [shownViewKey, setShownViewKey] = useState(viewKey);
  // SPEC-074/084: «Guarda y pasa al siguiente». El siguiente se fija al
  // tocar el paso y se aplica cuando llegan los datos nuevos.
  const [pendingNext, setPendingNext] = useState<{ to: string | null } | null>(
    null,
  );
  const [shownItems, setShownItems] = useState(data.items);
  if (shownViewKey !== viewKey) {
    setShownViewKey(viewKey);
    setShownItems(data.items);
    setSelectedOrderId(displayItems[0]?.id ?? null);
    setCheckedIds([]);
    setPendingNext(null);
  } else if (shownItems !== data.items) {
    setShownItems(data.items);
    if (pendingNext) {
      if (pendingNext.to) setSelectedOrderId(pendingNext.to);
      setPendingNext(null);
    }
  }
  const startStep = useCallback(() => {
    const index = displayItems.findIndex(
      (order) => order.id === selectedOrderId,
    );
    setPendingNext({ to: displayItems[index + 1]?.id ?? null });
  }, [displayItems, selectedOrderId]);
  const cancelStep = useCallback(() => setPendingNext(null), []);

  return (
    <div className="ui-page-stack">
      <PageHeader
        meta={
          <span className="flex flex-wrap items-center justify-end gap-2">
            {data.returnTo ? (
              <Link className="ui-directory__manage" href={data.returnTo}>
                ← Volver a Rendimiento
              </Link>
            ) : null}
            <OrderRealtimeStatus updatedAt={data.generatedAt} />
          </span>
        }
        title="Pedidos"
      />

      <PeriodNavigation data={data} />

      <OrderSummary data={data} />

      {advisorSheet ? null : <AdvisorSummary data={data} />}

      <Surface className="ui-filter-bar" raised>
        {advisorSheet ? null : (
        <Form action="/orders" className="lg:hidden">
          <input name="period" type="hidden" value={data.period} />
          {data.from ? (
            <input name="from" type="hidden" value={data.from} />
          ) : null}
          {data.to ? <input name="to" type="hidden" value={data.to} /> : null}
          {data.search ? (
            <input name="q" type="hidden" value={data.search} />
          ) : null}
          {data.teamFilter !== "ALL" ? (
            <input name="team" type="hidden" value={data.teamFilter} />
          ) : null}
          {data.advisorFilter !== "ALL" ? (
            <input name="advisor" type="hidden" value={data.advisorFilter} />
          ) : null}
          {data.dueFilter ? (
            <input name="plazo" type="hidden" value={data.dueFilter} />
          ) : null}
          {data.returnTo ? (
            <input name="volver" type="hidden" value={data.returnTo} />
          ) : null}
          <label className="min-w-0 flex-1">
            <span className="sr-only">Filtrar pedidos</span>
            <select
              className="ui-filter-select"
              defaultValue={data.filter}
              name="status"
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              {visibleFilterOptions(data.filter).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {data.tabCounts[option.value] !== undefined
                    ? ` · ${formatCount(data.tabCounts[option.value] ?? 0)}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </Form>
        )}

        {advisorSheet ? null : (
        <nav
          aria-label="Estado de los pedidos"
          className="ui-segmented-scroll hidden lg:block"
        >
          <div className="ui-segmented">
            {visibleFilterOptions(data.filter).map((option) => {
              const active = option.value === data.filter;
              const count = data.tabCounts[option.value];

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className="ui-segmented__item"
                  href={ordersHref(data, { filter: option.value })}
                  key={option.value}
                >
                  {option.label}
                  {count !== undefined ? " " : null}
                  {count !== undefined ? (
                    <span className="ml-1.5 text-xs text-ui-muted">
                      {formatCount(count)}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
        )}

        <OrderScopeFilters
          advisorOptions={data.advisorOptions}
          buildHref={(overrides) => ordersHref(data, overrides)}
          maximoOptions={
            data.filter === "LOGISTICS"
              ? data.logisticsSummary.byState.map((item) => item.state)
              : null
          }
          showDueFilter={data.filter === "TO_MOVE" || data.filter === "ALL"}
          showTeamFilter={data.showTeamFilter}
          teamAllLabel={data.teamAllLabel}
          teamOptions={data.teamOptions}
          values={{
            search: data.search,
            team: data.teamFilter,
            advisor: data.advisorFilter,
            maximo: data.maximoFilter,
            due: data.dueFilter,
          }}
        />

        <p className="text-xs text-ui-muted md:basis-full">
          {data.filteredTotal > data.pagination.pageSize
            ? `${formatCount(data.items.length)} de ${plural(data.filteredTotal, "pedido", "pedidos")}`
            : plural(data.items.length, "pedido", "pedidos")}
          {data.search ? ` para “${data.search}”` : ""}
        </p>
      </Surface>

      {data.items.length === 0 ? (
        <EmptyState {...emptyStateFor(data)} />
      ) : (
        <>
          <section className="space-y-3 lg:hidden">
            {(groups
              ? groups.flatMap((group) => {
                  const open =
                    !group.collapsed || expandedGroups.has(group.key);
                  return [
                    { kind: "group" as const, group, open },
                    ...(open
                      ? group.items.map((order) => ({
                          kind: "order" as const,
                          order,
                        }))
                      : []),
                  ];
                })
              : data.items.map((order) => ({ kind: "order" as const, order }))
            ).map((entry) => {
              if (entry.kind === "group") {
                return (
                  <div
                    className="flex items-baseline gap-2 pt-2 text-sm font-semibold text-ui-text"
                    key={`grupo-${entry.group.key}`}
                  >
                    {entry.group.label}
                    <span className="text-ui-muted">
                      {formatCount(entry.group.items.length)}
                    </span>
                    {entry.group.collapsed ? (
                      <button
                        aria-expanded={entry.open}
                        className="ml-auto text-xs text-ui-accent"
                        onClick={() => toggleGroup(entry.group.key)}
                        type="button"
                      >
                        {entry.open ? "Ocultar" : "Ver"}
                      </button>
                    ) : null}
                  </div>
                );
              }
              const order = entry.order;
              const expanded = expandedOrderId === order.id;

              return (
                <MobileOrderCard
                  assignmentTeams={data.assignmentTeams}
                  expanded={expanded}
                  key={order.id}
                  onToggle={() => {
                    setExpandedOrderId(expanded ? null : order.id);
                  }}
                  order={order}
                  showAdvisor={data.showAdvisorColumn}
                />
              );
            })}
          </section>

          {closable.length > 0 ? (
            <div className="hidden lg:block">
              <BulkCloseBar
                checkedIds={visibleChecked}
                closableCount={closable.length}
                onCheckAll={() =>
                  setCheckedIds(closable.map((order) => order.id))
                }
                onClear={clearChecked}
                orderCodes={Object.fromEntries(
                  data.items.map((order) => [order.id, order.orderCode]),
                )}
              />
            </div>
          ) : null}

          <section className="ui-order-workspace hidden lg:grid">
            <DesktopOrderList
              checked={closable.length > 0 ? checkedSet : undefined}
              expandedGroups={expandedGroups}
              groups={groups ?? undefined}
              items={data.items}
              onToggleGroup={toggleGroup}
              onSelect={setSelectedOrderId}
              onToggleChecked={toggleChecked}
              selectedOrderId={selectedOrder?.id ?? null}
              showAdvisorColumn={data.showAdvisorColumn}
            />

            <aside className="ui-order-detail-card">
              {selectedOrder ? (
                <OrderDetails
                  assignmentTeams={data.assignmentTeams}
                  key={selectedOrder.id}
                  onStepFailed={cancelStep}
                  onStepStart={startStep}
                  order={selectedOrder}
                  showAdvisor={data.showAdvisorColumn}
                />
              ) : selectionLeftView ? (
                <div className="ui-order-notice" role="status">
                  <h4 className="ui-order-notice__headline">
                    Esta venta salió de la bandeja
                  </h4>
                  <p className="ui-order-notice__body">
                    Cambió de estado o de responsable mientras la revisabas, así
                    que ya no pertenece a este filtro. No se reemplazó por otra
                    para que no gestiones la equivocada.
                  </p>
                  <button
                    className="ui-order-notice__action"
                    onClick={() =>
                      setSelectedOrderId(data.items[0]?.id ?? null)
                    }
                    type="button"
                  >
                    Ver la primera venta de la lista
                  </button>
                </div>
              ) : null}
            </aside>
          </section>
        </>
      )}

      {data.pagination.totalPages > 1 ? (
        <nav aria-label="Páginas de ventas" className="ui-pagination">
          {data.pagination.page > 1 ? (
            <Link
              className="ui-pagination__link"
              href={ordersHref(data, { page: data.pagination.page - 1 })}
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}

          <span className="ui-pagination__status">
            Página {data.pagination.page} de {data.pagination.totalPages}
          </span>

          {data.pagination.page < data.pagination.totalPages ? (
            <Link
              className="ui-pagination__link"
              href={ordersHref(data, { page: data.pagination.page + 1 })}
            >
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
