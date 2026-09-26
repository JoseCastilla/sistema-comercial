"use client";

import Link from "next/link";
import Form from "next/form";
import { useCallback, useEffect, useState } from "react";

import { formatCount } from "@repo/ui/format";
import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { Surface } from "@repo/ui/surface";

import { OrderNextStep } from "./order-next-step";
import { OrderStatusForm } from "./order-status-form";
import { OrderCancellationRequestPanel } from "./order-cancellation-request-panel";
import { OrderAssignmentResolution } from "./order-assignment-resolution";
import { OrderCorrectionForm } from "./order-correction-form";
import { OrderRealtimeStatus } from "./order-realtime-status";
import { OrderEscalationPanel } from "./order-escalation-panel";
import { SendOrderToRecoveryPanel } from "./send-order-to-recovery-panel";
import { OrderScopeFilters } from "./order-scope-filters";

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
  { value: "TO_MOVE", label: "Por mover" },
  { value: "LOGISTICS", label: "Entregas fallidas" },
  { value: "AWAITING_ACTIVATION", label: "Falta activar" },
  { value: "ESCALATIONS", label: "Escaladas" },
  { value: "RECOVERY", label: "Por recuperar" },
  { value: "DONE", label: "Cerrados" },
  { value: "ALL", label: "Todos" },
];

const legacyFilterLabels: Partial<Record<OrderFilter, string>> = {
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
  const due = overrides.due === undefined ? data.dueFilter : overrides.due;
  const page = overrides.page ?? 1;
  const parameters = new URLSearchParams({ period });
  if (period === "RANGE") {
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
        <div>
          <p className="ui-period-bar__eyebrow">Bandeja operativa</p>
          <p className="ui-period-bar__label">
            {logistics
              ? "Entregas fallidas por gestionar desde el 10/08"
              : "Escalaciones de todas las fechas"}
          </p>
        </div>
        <p className="max-w-xl text-sm text-ui-muted">
          {logistics
            ? `Pedidos con un problema de entrega reportado por Máximo. ${
                data.logisticsSummary.lastFetchedAtLabel
                  ? `Última consulta: ${data.logisticsSummary.lastFetchedAtLabel}.`
                  : "Aún no se ha consultado hoy."
              }`
            : "Las incidencias permanecen aquí hasta que un supervisor las resuelva, aunque la venta pertenezca a un período anterior."}
        </p>
      </Surface>
    );
  }

  return (
    <Surface className="ui-period-bar" raised>
      <div>
        <p className="ui-period-bar__eyebrow">Período de ventas</p>
        <p className="ui-period-bar__label">{data.periodLabel}</p>
      </div>

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

      {showAgr && order.agrDelivery ? (
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
      data-tone={agr.opportunity ? "warning" : "neutral"}
    >
      <h4 className="ui-order-notice__headline">
        <span className="ui-order-notice__source">Máximo</span>
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
        Consultado {agr.fetchedAtLabel}
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
  onSaved,
}: {
  order: OrderInboxItem;
  assignmentTeams: OrderAssignmentTeamOption[];
  showAdvisor: boolean;
  /** Tras guardar un paso, pasar al pedido de abajo (escritorio). */
  onSaved?: () => void;
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
          <OrderNextStep key={formKey} onSaved={onSaved} order={order} />

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
          <dt>En este estado desde hace</dt>
          <dd>{order.statusAgeLabel}</dd>
        </div>

        {showAdvisor ? (
          <>
            <div>
              <dt>Agente</dt>
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

        {showAdvisor ? (
          <div>
            <dt>Asignación</dt>
            <dd>{order.assignmentStatusLabel}</dd>
          </div>
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
            En este estado desde hace {order.statusAgeLabel}
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

function DesktopOrderList({
  items,
  selectedOrderId,
  onSelect,
  showAdvisorColumn,
}: {
  items: OrderInboxItem[];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
  showAdvisorColumn: boolean;
}) {
  /*
   * SPEC-073: la hoja es una línea por venta cuando cabe. Cuando la lista es
   * angosta (laptop con el panel de gestión al lado), cada venta pasa a dos
   * líneas —cliente y plazo; estado, acción y quién— en lugar de cortarse
   * con desplazamiento lateral. Lo decide el ancho de la lista, no la
   * pantalla: ver `@container order-list` en patterns.css.
   */
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
          {items.map((order) => {
            const selected = selectedOrderId === order.id;

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
                  const sibling =
                    event.key === "ArrowDown"
                      ? event.currentTarget.nextElementSibling
                      : event.currentTarget.previousElementSibling;
                  if (sibling instanceof HTMLElement && sibling.dataset.orderRow) {
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

                <span className="ui-order-grid__client">
                  <strong>{order.holderName}</strong>
                  {/* Solo en dos líneas: lo que las columnas ocultas decían. */}
                  <small className="ui-order-grid__meta">
                    {[
                      order.orderCode,
                      getOperatorLabel(order),
                      showAdvisorColumn ? order.agentName || "Sin asesor" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
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
                  {order.agrDelivery ? (
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
                  {order.agrDelivery ? (
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
          })}
        </div>
      </div>
    </div>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
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
              label={`Ventas · ${data.periodLabel}`}
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
      {!logistics && data.pendingBeforeMonth > 0 && data.period !== "HISTORY" ? (
        <p className="mt-2 text-xs">
          <Link
            className="font-semibold text-ui-warning hover:underline"
            href={ordersHref(data, { period: "HISTORY", filter: "TO_MOVE" })}
          >
            {plural(
              data.pendingBeforeMonth,
              "pendiente de meses anteriores",
              "pendientes de meses anteriores",
            )}{" "}
            →
          </Link>
        </p>
      ) : null}
    </section>
  );
}

export function OrderInbox({ data }: { data: OrderInboxData }) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    data.items[0]?.id ?? null,
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

  // SPEC-074: guardar un paso pasa al pedido de abajo, antes de que el
  // refresco saque de la vista al que se acaba de mover.
  const selectNextAfter = useCallback(
    (orderId: string) => {
      const index = data.items.findIndex((order) => order.id === orderId);
      const next = data.items[index + 1] ?? null;
      if (next) setSelectedOrderId(next.id);
    },
    [data.items],
  );

  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="Operación comercial"
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

      <Surface className="ui-filter-bar" raised>
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
                    <span className="text-xs text-ui-muted">
                      {formatCount(count)}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <OrderScopeFilters
          advisorOptions={data.advisorOptions}
          buildHref={(overrides) => ordersHref(data, overrides)}
          maximoOptions={
            data.filter === "LOGISTICS"
              ? data.logisticsSummary.byState.map((item) => item.state)
              : null
          }
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
          {plural(data.items.length, "pedido", "pedidos")} en esta página
          {data.filteredTotal > data.pagination.pageSize
            ? ` de ${formatCount(data.filteredTotal)} encontrados`
            : ""}
          {data.search ? ` para “${data.search}”` : ""}
        </p>
      </Surface>

      {data.items.length === 0 ? (
        <EmptyState
          description={
            data.filter === "RECOVERY"
              ? "No tienes pedidos no entregados o cancelados pendientes de recuperación este mes."
              : data.filter === "LOGISTICS"
                ? "Máximo no reporta pedidos con una acción comercial pendiente."
                : data.filter === "ESCALATIONS"
                  ? "No hay incidencias escaladas pendientes de atención."
                  : data.totals.visible > 0
                    ? "No hay ventas que coincidan con este estado o búsqueda."
                    : data.teamFilter === "UNASSIGNED"
                      ? "No hay ventas pendientes de asignación en este período."
                      : data.period === "TODAY"
                        ? "No se registraron ventas hoy."
                        : data.period === "YESTERDAY"
                          ? "No se registraron ventas ayer."
                          : data.period === "WEEK"
                            ? "No se registraron ventas esta semana."
                            : data.period === "MONTH"
                              ? "No se registraron ventas en el mes actual."
                              : data.period === "RANGE"
                                ? "No se registraron ventas en el rango seleccionado."
                                : "No se encontraron ventas en el histórico."
          }
          title={
            data.filter === "RECOVERY"
              ? "Recuperación al día"
              : data.filter === "LOGISTICS"
                ? "Gestión logística al día"
                : data.filter === "ESCALATIONS"
                  ? "Escalaciones al día"
                  : data.totals.visible > 0
                    ? "No hay coincidencias"
                    : data.teamFilter === "UNASSIGNED"
                      ? "Todo está asignado"
                      : "Aún no hay ventas en este período"
          }
        />
      ) : (
        <>
          <section className="space-y-3 lg:hidden">
            {data.items.map((order) => {
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

          <section className="ui-order-workspace hidden lg:grid">
            <DesktopOrderList
              items={data.items}
              onSelect={setSelectedOrderId}
              selectedOrderId={selectedOrder?.id ?? null}
              showAdvisorColumn={data.showAdvisorColumn}
            />

            <aside className="ui-order-detail-card">
              {selectedOrder ? (
                <OrderDetails
                  assignmentTeams={data.assignmentTeams}
                  key={selectedOrder.id}
                  onSaved={() => selectNextAfter(selectedOrder.id)}
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
