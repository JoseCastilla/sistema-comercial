"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { Surface } from "@repo/ui/surface";

import { OrderStatusForm } from "./order-status-form";
import { OrderCancellationRequestPanel } from "./order-cancellation-request-panel";
import { OrderAssignmentResolution } from "./order-assignment-resolution";
import { OrderCorrectionForm } from "./order-correction-form";
import { OrderRealtimeStatus } from "./order-realtime-status";
import { OrderEscalationPanel } from "./order-escalation-panel";
import { SendOrderToRecoveryPanel } from "./send-order-to-recovery-panel";

import type {
  OrderAssignmentTeamOption,
  OrderInboxData,
  OrderFilter,
  OrderInboxItem,
  OrderSlaState,
} from "../order-inbox.types";

const filterOptions: Array<{
  value: OrderFilter;
  label: string;
}> = [
  {
    value: "ACTIVE",
    label: "Activos",
  },
  {
    value: "ESCALATIONS",
    label: "Escaladas",
  },
  {
    value: "LOGISTICS",
    label: "Entregas fallidas por gestionar",
  },
  {
    value: "INCIDENTS",
    label: "Incidencias",
  },
  {
    value: "RECOVERY",
    label: "Por recuperar",
  },
  {
    value: "AWAITING_ACTIVATION",
    label: "Por activar",
  },
  {
    value: "DELIVERED",
    label: "Entregados",
  },
  {
    value: "FINAL",
    label: "Finalizados",
  },
  {
    value: "ALL",
    label: "Todos",
  },
];

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
  const page = overrides.page ?? 1;
  const parameters = new URLSearchParams({ period });
  if (period === "RANGE") {
    if (data.from) parameters.set("from", data.from);
    if (data.to) parameters.set("to", data.to);
  }
  if (filter !== "ALL") parameters.set("status", filter);
  if (search) parameters.set("q", search);
  if (team !== "ALL") parameters.set("team", team);
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
            ? `Solo aparecen pedidos con una acción pendiente según Máximo. ${
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
            <a
              aria-current={data.period === option.value ? "page" : undefined}
              className="ui-period-navigation__item"
              href={ordersHref(data, { period: option.value })}
              key={option.value}
            >
              {option.label}
            </a>
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
            <a
              aria-current={data.period === "HISTORY" ? "page" : undefined}
              className="ui-period-more__history"
              href={ordersHref(data, { period: "HISTORY" })}
            >
              <span>
                <strong>Histórico completo</strong>
                <small>Consulta ventas y pendientes anteriores.</small>
              </span>
              <span aria-hidden="true">→</span>
            </a>

            <form className="ui-period-range" method="get">
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
            </form>
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

    case "SENT":
      return "warning";

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
      <span className="ui-order-badge" data-tone={getStatusTone(order.status)}>
        {order.statusLabel}
      </span>

      {order.sentSubstatusLabel ? (
        <span className="ui-order-badge">{order.sentSubstatusLabel}</span>
      ) : null}

      {order.noStatusIncident ? (
        <span className="ui-order-badge" data-tone="danger">
          Sin avance hace más de 10 min
        </span>
      ) : null}

      {showAgr && order.agrDelivery ? (
        <span className="ui-order-badge" data-tone="warning">
          {order.agrDelivery.actionShortLabel}
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

/*
 * Máximo responde en mayúsculas de sistema (RECHAZADO, DEUDA EXIGIBLE...).
 * Aquí se traducen a frases que el asesor pueda leer y explicar al cliente.
 * Los valores no contemplados caen al texto original, solo capitalizado.
 */
function toSentenceCase(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("es-PE");
  if (!normalized) return value;
  return `${normalized.charAt(0).toLocaleUpperCase("es-PE")}${normalized.slice(1)}`;
}

const agrStatusRules: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /RECHAZ/, label: "El operador rechazó la entrega" },
  { pattern: /CANCEL/, label: "El operador canceló el pedido" },
  { pattern: /ANUL/, label: "El operador anuló el pedido" },
  { pattern: /DEVUEL/, label: "El pedido fue devuelto" },
  { pattern: /NO\s*ENTREG/, label: "El operador no pudo entregar" },
  { pattern: /AGENDADO/, label: "Entrega agendada por el operador" },
  { pattern: /SIN\s*GESTI/, label: "El operador aún no gestiona el pedido" },
];

function getAgrStatusLabel(status: string): string {
  const normalized = status.trim().toUpperCase();
  const match = agrStatusRules.find((rule) => rule.pattern.test(normalized));
  return match ? match.label : toSentenceCase(status);
}

const agrReasonRules: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /FUERA DE COBERTURA/,
    label: "La dirección está fuera de la zona de reparto",
  },
  {
    pattern: /ZONA PELIGROSA/,
    label: "El courier considera peligrosa la zona de entrega",
  },
  {
    pattern: /DIRECCION NO RECUPERABLE/,
    label: "No se pudo ubicar la dirección de entrega",
  },
  {
    pattern: /TIEMPO MINIMO DE PORTA/,
    label: "La línea no cumple los 30 días para portar",
  },
  {
    pattern: /NO ESTUVO EN SERVICIO/,
    label: "No se pudo comprobar la antigüedad de la línea",
  },
  {
    pattern: /DEUDA EXIGIBLE/,
    label: "El cliente tiene deuda pendiente con su operador",
  },
  {
    pattern: /SERVICIO SUSPENDIDO/,
    label: "La línea del cliente está suspendida",
  },
  {
    pattern: /OTRA PORTA EN CURSO/,
    label: "Hay otra portabilidad en curso para esta línea",
  },
  {
    pattern: /HUELLA NO CORRESPONDE|NO CORRESPONDE AL DNI|CLIENTE NO IDENTIFICADO/,
    label: "Falló la validación de identidad del cliente",
  },
  {
    pattern: /NO CUENTA CON PIN/,
    label: "El cliente no tenía el PIN de portabilidad",
  },
  {
    pattern: /CLIENTE AUSENTE/,
    label: "El cliente no estaba cuando llegó el courier",
  },
  {
    pattern: /VISITA EN FECHA NO ACORDADA/,
    label: "El courier fue en una fecha que el cliente no acordó",
  },
  {
    pattern: /CLIENTE NO DESEA/,
    label: "El cliente dijo que ya no quiere el servicio",
  },
];

function getAgrReasonLabel(reason: string): string {
  const normalized = reason.toUpperCase();
  const match = agrReasonRules.find((rule) => rule.pattern.test(normalized));
  return match ? match.label : toSentenceCase(reason);
}

function AgrDeliveryPanel({ order }: { order: OrderInboxItem }) {
  const agr = order.agrDelivery;
  if (!agr) return null;

  return (
    <section className="ui-order-notice">
      <h4 className="ui-order-notice__headline">
        <span className="ui-order-notice__source">
          {getAgrStatusLabel(agr.status)}
        </span>
        {" · "}
        {agr.actionLabel}
      </h4>
      <dl className="ui-order-notice__details">
        {agr.reason ? (
          <DetailItem label="Motivo" value={getAgrReasonLabel(agr.reason)} />
        ) : null}
        {agr.result ? (
          <DetailItem label="Resultado" value={agr.result} />
        ) : null}
        {agr.nextAction ? (
          <DetailItem
            label="Próxima acción del operador"
            value={agr.nextAction}
          />
        ) : null}
        {agr.commitmentDate ? (
          <DetailItem label="Fecha de compromiso" value={agr.commitmentDate} />
        ) : null}
      </dl>
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
}: {
  order: OrderInboxItem;
  assignmentTeams: OrderAssignmentTeamOption[];
  showAdvisor: boolean;
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
      </div>

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

      <AgrDeliveryPanel order={order} />

      {order.canUpdate || showAdvisor ? (
        <section
          className="ui-order-management"
          aria-label="Actualizar seguimiento"
        >
          <h4 className="mb-4 text-sm font-semibold text-ui-text">
            Actualizar seguimiento
          </h4>

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

function CopyOrderCodeButton({
  orderCode,
  selected,
  onSelect,
}: {
  orderCode: string;
  selected: boolean;
  onSelect: () => void;
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

  async function selectAndCopyOrderCode() {
    onSelect();

    try {
      await copyTextToClipboard(orderCode);
      setCopyState("COPIED");
    } catch {
      setCopyState("ERROR");
    }
  }

  const feedback =
    copyState === "COPIED"
      ? "Orden copiada"
      : copyState === "ERROR"
        ? "No se pudo copiar"
        : "";

  return (
    <button
      aria-label={`Seleccionar y copiar orden ${orderCode}`}
      aria-pressed={selected}
      className={[
        "ui-order-grid__order-code group flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2",
        copyState === "COPIED"
          ? "bg-ui-success-soft text-ui-success"
          : copyState === "ERROR"
            ? "bg-ui-danger-soft text-ui-danger"
            : "text-ui-muted hover:bg-ui-subtle hover:text-ui-text",
      ].join(" ")}
      onClick={selectAndCopyOrderCode}
      title={feedback || `Seleccionar y copiar orden ${orderCode}`}
      type="button"
    >
      <span className="truncate">{orderCode}</span>

      <span aria-hidden="true" className="shrink-0">
        {copyState === "COPIED" ? (
          <svg className="size-3.5" fill="none" viewBox="0 0 16 16">
            <path
              d="m3.5 8 3 3 6-7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />
          </svg>
        ) : (
          <svg className="size-3.5" fill="none" viewBox="0 0 16 16">
            <rect
              height="8.5"
              rx="1.5"
              stroke="currentColor"
              width="8.5"
              x="5"
              y="4.5"
            />
            <path
              d="M3.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1"
              stroke="currentColor"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>

      <span aria-live="polite" className="sr-only">
        {feedback}
      </span>
    </button>
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
          <span>Acción</span>
          <span>Plazo</span>
        </div>

        <div className="ui-order-grid__body">
          {items.map((order) => {
            const selected = selectedOrderId === order.id;

            return (
              <div
                className="ui-order-grid__row"
                data-incident={order.noStatusIncident ? "true" : "false"}
                data-selected={selected ? "true" : "false"}
                data-show-advisor={showAdvisorColumn ? "true" : "false"}
                key={order.id}
                onClick={() => onSelect(order.id)}
              >
                <CopyOrderCodeButton
                  onSelect={() => onSelect(order.id)}
                  orderCode={order.orderCode}
                  selected={selected}
                />

                <span className="ui-order-grid__client">
                  <strong>{order.holderName}</strong>
                </span>

                <InlineCopyValue label="DNI" value={order.documentNumber} />

                <InlineCopyValue label="teléfono" value={order.serviceNumber} />

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
                </span>

                <span className="ui-order-grid__action">
                  {order.agrDelivery ? (
                    <span className="ui-order-badge" data-tone="warning">
                      {order.agrDelivery.actionShortLabel}
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
  const recoveryQueueCount =
    data.filter === "RECOVERY" ? data.filteredTotal : data.totals.recovery;

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={
          data.filter === "LOGISTICS"
            ? "Decide sobre las ventas que el operador logístico no pudo entregar."
            : "Revisa incidencias, recupera pedidos y actualiza el avance comercial."
        }
        eyebrow="Operación comercial"
        meta={
          <span className="flex flex-wrap items-center justify-end gap-2">
            <OrderRealtimeStatus />
            <span>Actualizado: {data.generatedAt}</span>
          </span>
        }
        title="Seguimiento de órdenes"
      />

      <PeriodNavigation data={data} />

      {data.filter === "LOGISTICS" ? (
        <MetricGroup>
          <Metric
            label="Casos por revisar"
            tone={data.logisticsSummary.total > 0 ? "warning" : "neutral"}
            value={data.logisticsSummary.total}
          />
          <Metric
            label="Visita por coordinar"
            value={data.logisticsSummary.reschedule}
          />
          <Metric
            label="Contactar y validar"
            value={data.logisticsSummary.contact}
          />
          <Metric
            label="Por volver a ingresar"
            value={data.logisticsSummary.review}
          />
        </MetricGroup>
      ) : (
        <>
          {/* Resultado comercial del período: cuánto entró y cómo termina. */}
          <MetricGroup>
            <Metric
              label={`Ventas · ${data.periodLabel}`}
              value={data.totals.visible}
            />
            <Metric
              label="Entregados (según nuestro registro)"
              value={data.totals.delivered}
            />
            <Metric
              label={`No entregados (según nuestro registro) · ${data.periodLabel}`}
              value={data.totals.notDelivered}
            />
            <Metric
              label="Fuera de plazo"
              tone={data.totals.overdue > 0 ? "danger" : "neutral"}
              value={data.totals.overdue}
            />
          </MetricGroup>

          {/* Atención pendiente: lo que exige acción hoy. */}
          <MetricGroup>
            <Metric
              label="Incidencias"
              tone={data.totals.incidents > 0 ? "danger" : "neutral"}
              value={data.totals.incidents}
            />
            <Metric
              label="Escaladas al supervisor"
              tone={data.totals.escalations > 0 ? "danger" : "neutral"}
              value={data.totals.escalations}
            />
            <Metric
              label="Entregas fallidas por gestionar"
              tone={data.totals.logistics > 0 ? "warning" : "neutral"}
              value={data.totals.logistics}
            />
          </MetricGroup>
        </>
      )}

      {(data.role === "ADMIN" || data.role === "SUPERVISOR") &&
      data.totals.escalations > 0 ? (
        <a
          className="ui-inbox-alert"
          data-tone="danger"
          href={ordersHref(data, { filter: "ESCALATIONS" })}
          role="status"
        >
          <span>
            <strong>
              {data.totals.escalations} incidencia(s) requieren atención
            </strong>
            <span className="ml-2">
              Los asesores esperan respuesta del supervisor.
            </span>
          </span>
          <span className="ui-inbox-alert__action">Ver bandeja →</span>
        </a>
      ) : null}

      {data.totals.logistics > 0 && data.filter !== "LOGISTICS" ? (
        <a
          className="ui-inbox-alert"
          data-tone="warning"
          href={ordersHref(data, {
            filter: "LOGISTICS",
            search: "",
          })}
          role="status"
        >
          <span>
            <strong>
              {data.totals.logistics === 1
                ? "1 entrega fallida por gestionar"
                : `${data.totals.logistics} entregas fallidas por gestionar`}
            </strong>
            <span className="ml-2">
              Hay pedidos para contactar, reagendar o revisar su cancelación.
            </span>
          </span>
          <span className="ui-inbox-alert__action">Revisar →</span>
        </a>
      ) : null}

      {data.filter !== "LOGISTICS" &&
      (recoveryQueueCount > 0 || data.filter === "RECOVERY") ? (
        <div className="ui-recovery-queue" role="status">
          <div className="ui-recovery-queue__count" aria-hidden="true">
            {recoveryQueueCount}
          </div>
          <div className="ui-recovery-queue__content">
            <p className="ui-recovery-queue__title">
              {data.filter === "RECOVERY"
                ? `${recoveryQueueCount} ${recoveryQueueCount === 1 ? "pedido" : "pedidos"} por recuperar · ${data.periodLabel}`
                : data.totals.recovery === 1
                  ? "Hay 1 pedido por recuperar este mes"
                  : `Hay ${data.totals.recovery} pedidos por recuperar este mes`}
            </p>
            <p className="ui-recovery-queue__description">
              Reúne pedidos no entregados y cancelados que todavía pueden
              convertirse en una nueva venta.
            </p>
          </div>
          {data.filter === "RECOVERY" ? (
            <span className="ui-recovery-queue__current">Bandeja abierta</span>
          ) : (
            <a
              className="ui-recovery-queue__link"
              href={ordersHref(data, {
                period: "MONTH",
                filter: "RECOVERY",
                search: "",
              })}
            >
              Revisar ahora
            </a>
          )}
        </div>
      ) : null}

      {data.filter !== "LOGISTICS" &&
      data.pendingBeforeMonth > 0 &&
      data.period !== "HISTORY" ? (
        <div className="ui-prior-pending">
          <div>
            <p className="ui-prior-pending__title">
              {data.pendingBeforeMonth} pendientes de meses anteriores
            </p>
            <p className="ui-prior-pending__description">
              No se mezclan con las ventas del mes actual.
            </p>
          </div>
          <a
            className="ui-prior-pending__link"
            href={ordersHref(data, { period: "HISTORY", filter: "ACTIVE" })}
          >
            Revisar pendientes
          </a>
        </div>
      ) : null}

      <Surface className="ui-filter-bar" raised>
        <form className="lg:hidden" method="get">
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
          <label className="min-w-0 flex-1">
            <span className="sr-only">Filtrar pedidos</span>
            <select
              className="ui-filter-select"
              defaultValue={data.filter}
              name="status"
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </form>

        <nav
          aria-label="Estado de los pedidos"
          className="ui-segmented-scroll hidden lg:block"
        >
          <div className="ui-segmented">
            {filterOptions.map((option) => {
              const active = option.value === data.filter;

              return (
                <a
                  aria-current={active ? "page" : undefined}
                  className="ui-segmented__item"
                  href={ordersHref(data, { filter: option.value })}
                  key={option.value}
                >
                  {option.label}
                </a>
              );
            })}
          </div>
        </nav>

        {data.showTeamFilter ? (
          <form className="ui-team-filter" method="get">
            <input name="period" type="hidden" value={data.period} />
            {data.from ? (
              <input name="from" type="hidden" value={data.from} />
            ) : null}
            {data.to ? <input name="to" type="hidden" value={data.to} /> : null}
            {data.filter !== "ALL" ? (
              <input name="status" type="hidden" value={data.filter} />
            ) : null}
            {data.search ? (
              <input name="q" type="hidden" value={data.search} />
            ) : null}
            <label className="ui-team-filter__field">
              <span>Equipo</span>
              <select
                className="ui-filter-select"
                defaultValue={data.teamFilter}
                name="team"
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
              >
                <option value="ALL">{data.teamAllLabel}</option>
                <option value="UNASSIGNED">Sin asignar</option>
                {data.teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </form>
        ) : null}

        <form className="ui-order-search" method="get">
          <input name="period" type="hidden" value={data.period} />
          {data.from ? (
            <input name="from" type="hidden" value={data.from} />
          ) : null}
          {data.to ? <input name="to" type="hidden" value={data.to} /> : null}
          {data.filter !== "ALL" ? (
            <input name="status" type="hidden" value={data.filter} />
          ) : null}
          {data.teamFilter !== "ALL" ? (
            <input name="team" type="hidden" value={data.teamFilter} />
          ) : null}
          <label className="min-w-0 flex-1">
            <span className="sr-only">Buscar pedidos</span>

            <input
              className="ui-search-input"
              defaultValue={data.search}
              maxLength={100}
              name="q"
              placeholder="Buscar orden, cliente, teléfono o asesor"
              type="search"
            />
          </label>
          <button
            aria-label="Buscar pedidos"
            className="ui-filter-submit ui-order-search__submit"
            type="submit"
          >
            <span>Buscar</span>
            <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
              <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" />
              <path
                d="m12.4 12.4 4.1 4.1"
                stroke="currentColor"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </form>

        <p className="text-xs text-ui-muted md:basis-full">
          {data.items.length} órdenes en esta página
          {data.filteredTotal > data.pagination.pageSize
            ? ` de ${data.filteredTotal} encontradas`
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
            <a
              className="ui-pagination__link"
              href={ordersHref(data, { page: data.pagination.page - 1 })}
            >
              Anterior
            </a>
          ) : (
            <span />
          )}

          <span className="ui-pagination__status">
            Página {data.pagination.page} de {data.pagination.totalPages}
          </span>

          {data.pagination.page < data.pagination.totalPages ? (
            <a
              className="ui-pagination__link"
              href={ordersHref(data, { page: data.pagination.page + 1 })}
            >
              Siguiente
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
