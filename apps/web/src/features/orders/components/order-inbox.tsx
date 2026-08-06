"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@repo/ui/empty-state";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { Surface } from "@repo/ui/surface";

import { OrderStatusForm } from "./order-status-form";
import { OrderAssignmentResolution } from "./order-assignment-resolution";
import { OrderCorrectionForm } from "./order-correction-form";
import { OrderRealtimeStatus } from "./order-realtime-status";

import type {
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
    value: "INCIDENTS",
    label: "Incidencias",
  },
  {
    value: "RECOVERY",
    label: "Recuperación",
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
  { value: "WEEK", label: "Semana" },
  { value: "MONTH", label: "Mes actual" },
];

function ordersHref(
  data: OrderInboxData,
  overrides: {
    period?: OrderInboxData["period"];
    filter?: OrderFilter;
    search?: string;
    page?: number;
  } = {},
): string {
  const period = overrides.period ?? data.period;
  const filter = overrides.filter ?? data.filter;
  const search = overrides.search ?? data.search;
  const page = overrides.page ?? 1;
  const parameters = new URLSearchParams({ period });
  if (filter !== "ALL") parameters.set("status", filter);
  if (search) parameters.set("q", search);
  if (page > 1) parameters.set("page", String(page));
  return `/orders?${parameters.toString()}`;
}

function PeriodNavigation({ data }: { data: OrderInboxData }) {
  return (
    <Surface className="ui-period-bar" raised>
      <div>
        <p className="ui-period-bar__eyebrow">Período de ventas</p>
        <p className="ui-period-bar__label">{data.periodLabel}</p>
      </div>

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

        <a
          aria-current={data.period === "HISTORY" ? "page" : undefined}
          className="ui-period-navigation__history"
          href={ordersHref(data, { period: "HISTORY" })}
        >
          Histórico
        </a>
      </nav>
    </Surface>
  );
}

function getStatusClasses(status: string): string {
  switch (status) {
    case "OPEN":
      return "border-sky-200 bg-sky-50 text-sky-700";

    case "SENT":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "CLOSED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "CANCELLED":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-neutral-200 bg-neutral-100 text-neutral-600";
  }
}

function getSlaClasses(state: OrderSlaState): string {
  switch (state) {
    case "OVERDUE":
      return "border-red-200 bg-red-50 text-red-700";

    case "DUE_SOON":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "ON_TIME":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "PENDING_SHIFT":
      return "border-sky-200 bg-sky-50 text-sky-700";

    case "CLOSED":
      return "border-neutral-200 bg-neutral-100 text-neutral-600";

    default:
      return "border-violet-200 bg-violet-50 text-violet-700";
  }
}

function StatusBadge({ order }: { order: OrderInboxItem }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span
        className={[
          "rounded-full border px-2.5 py-1 text-xs font-medium",
          getStatusClasses(order.status),
        ].join(" ")}
      >
        {order.statusLabel}
      </span>

      {order.sentSubstatusLabel ? (
        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700">
          {order.sentSubstatusLabel}
        </span>
      ) : null}

      {order.noStatusIncident ? (
        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
          Incidencia +10 min
        </span>
      ) : null}
    </div>
  );
}

function SlaBadge({ order }: { order: OrderInboxItem }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        getSlaClasses(order.slaState),
      ].join(" ")}
    >
      {order.slaLabel}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </dt>

      <dd className="mt-1 text-sm font-medium text-neutral-900">
        {value || "No registrado"}
      </dd>
    </div>
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

function InlineCopyValue({ label, value }: { label: string; value: string }) {
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
        "rounded px-0.5 font-medium underline decoration-dotted underline-offset-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
        copyState === "COPIED"
          ? "bg-emerald-50 text-emerald-700 decoration-emerald-400"
          : copyState === "ERROR"
            ? "bg-red-50 text-red-700 decoration-red-400"
            : "text-neutral-700 decoration-neutral-400 hover:bg-neutral-100 hover:text-neutral-950",
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

function OrderDetails({ order }: { order: OrderInboxItem }) {
  const formKey = [
    order.id,
    order.status,
    order.sentSubstatus ?? "none",
    order.deliveryObservation ?? "none",
  ].join(":");

  const hasDitoDetails = Boolean(
    order.salesCode ||
    order.billingCycleDay ||
    order.paymentDueDay ||
    order.deliveryContactPhone !== order.serviceNumber ||
    order.deliveryTimeRange ||
    order.deliveryAddress ||
    order.deliveryReference ||
    order.deliveryLatitude ||
    order.deliveryLongitude,
  );

  const coordinates =
    order.deliveryLatitude && order.deliveryLongitude
      ? `${order.deliveryLatitude}, ${order.deliveryLongitude}`
      : null;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm font-semibold text-neutral-950">
              {order.orderCode}
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              Registrado {order.registeredAtLabel}
            </p>
          </div>

          <SlaBadge order={order} />
        </div>

        <div className="mt-3">
          <StatusBadge order={order} />
        </div>

        {order.parseStatus !== "PARSED" ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
            Datos incompletos: vuelve a capturar con el detalle DITO desplegado
            o corrige manualmente.
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-neutral-950">
          {order.holderName}
        </h3>

        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-neutral-600">
          <span>DNI</span>
          <InlineCopyValue label="DNI" value={order.documentNumber} />
          <span aria-hidden="true">·</span>
          <InlineCopyValue
            label="número de operación"
            value={order.serviceNumber}
          />
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailItem label="Operación" value={order.operation} />

        <DetailItem label="Estado desde" value={order.statusAgeLabel} />

        <DetailItem label="Agente" value={order.agentName} />

        <DetailItem label="Ubicación" value={order.locationLabel} />

        <DetailItem label="Tipo de entrega" value={order.deliveryMethodLabel} />

        <DetailItem label="Ventana" value={order.deliveryWindowLabel} />

        <DetailItem
          label="Hora límite"
          value={order.deliveryDueAtLabel ?? "Sin plazo calculado"}
        />

        <DetailItem label="Estado de asociación" value={order.matchStatus} />
      </dl>

      {order.canResolveAssignment ? (
        <OrderAssignmentResolution order={order} />
      ) : null}

      {hasDitoDetails ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <h4 className="text-sm font-semibold text-sky-950">Datos DITO</h4>

          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
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

            <DetailItem
              label="Teléfono de contacto"
              value={order.deliveryContactPhone}
            />

            {order.deliveryAddress ? (
              <DetailItem
                label="Dirección de entrega"
                value={order.deliveryAddress}
              />
            ) : null}

            {order.deliveryReference ? (
              <DetailItem label="Referencia" value={order.deliveryReference} />
            ) : null}

            {coordinates ? (
              <DetailItem label="Coordenadas" value={coordinates} />
            ) : null}
          </dl>
        </div>
      ) : null}

      {order.deliveryObservation ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Observación actual
          </p>

          <p className="mt-2 text-sm leading-6 text-neutral-700">
            {order.deliveryObservation}
          </p>
        </div>
      ) : null}

      {order.canCorrect ? <OrderCorrectionForm order={order} /> : null}

      <div className="border-t border-neutral-200 pt-5">
        <h4 className="mb-4 text-sm font-semibold text-neutral-900">
          Actualizar seguimiento
        </h4>

        <OrderStatusForm
          key={formKey}
          canUpdate={order.canUpdate}
          initialObservation={order.deliveryObservation}
          initialSentSubstatus={order.sentSubstatus}
          initialStatus={order.status}
          orderId={order.id}
        />
      </div>
    </div>
  );
}

function MobileOrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: OrderInboxItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={[
        "overflow-hidden rounded-2xl border bg-white shadow-sm",
        order.noStatusIncident
          ? "border-red-300"
          : order.sentSubstatus === "NOT_DELIVERED"
            ? "border-amber-300"
            : "border-neutral-200",
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
            <p className="font-mono text-xs font-semibold text-neutral-500">
              {order.orderCode}
            </p>

            <h3 className="mt-1 truncate text-base font-semibold text-neutral-950">
              {order.holderName}
            </h3>

            <p className="mt-1 text-sm text-neutral-600">
              {order.serviceNumber}
              {" · "}
              {order.district || order.province}
            </p>
          </div>

          <span className="shrink-0 text-xl text-neutral-400">
            {expanded ? "−" : "+"}
          </span>
        </div>

        <div className="mt-3">
          <StatusBadge order={order} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-neutral-500">
            {order.agentName}
            {" · "}
            {order.statusAgeLabel}
          </p>

          <SlaBadge order={order} />
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-neutral-200 p-4">
          <OrderDetails order={order} />
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
        "group flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-2 font-mono text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
        copyState === "COPIED"
          ? "bg-emerald-50 text-emerald-700"
          : copyState === "ERROR"
            ? "bg-red-50 text-red-700"
            : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950",
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
}: {
  items: OrderInboxItem[];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="grid grid-cols-[140px_minmax(220px,1.5fr)_minmax(150px,1fr)_220px_120px] gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
        <span>Orden</span>
        <span>Cliente</span>
        <span>Asesor</span>
        <span>Estado</span>
        <span>SLA</span>
      </div>

      <div className="max-h-[calc(100vh-300px)] divide-y divide-neutral-100 overflow-y-auto">
        {items.map((order) => {
          const selected = selectedOrderId === order.id;

          return (
            <div
              className={[
                "grid w-full grid-cols-[140px_minmax(220px,1.5fr)_minmax(150px,1fr)_220px_120px] items-center gap-3 px-4 py-3 text-left transition",
                selected ? "bg-neutral-100" : "hover:bg-neutral-50",
                order.noStatusIncident
                  ? "border-l-4 border-l-red-500"
                  : "border-l-4 border-l-transparent",
              ].join(" ")}
              key={order.id}
            >
              <CopyOrderCodeButton
                onSelect={() => {
                  onSelect(order.id);
                }}
                orderCode={order.orderCode}
                selected={selected}
              />

              <button
                aria-pressed={selected}
                className="col-span-4 grid min-w-0 grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_220px_120px] items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                onClick={() => {
                  onSelect(order.id);
                }}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-neutral-950">
                    {order.holderName}
                  </span>

                  <span className="mt-0.5 block truncate text-xs text-neutral-500">
                    {order.serviceNumber}
                    {" · "}
                    {order.district || order.province}
                  </span>
                </span>

                <span className="truncate text-sm text-neutral-700">
                  {order.agentName}
                </span>

                <span>
                  <StatusBadge order={order} />
                </span>

                <span>
                  <SlaBadge order={order} />
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrderInbox({ data }: { data: OrderInboxData }) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    data.items[0]?.id ?? null,
  );

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const selectedOrder =
    data.items.find((order) => {
      return order.id === selectedOrderId;
    }) ??
    data.items[0] ??
    null;

  return (
    <div className="ui-page-stack">
      <PageHeader
        description="Revisa incidencias, recupera pedidos y actualiza el avance informado por Integratel."
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

      <MetricGroup>
        <Metric
          label={`Ventas · ${data.periodLabel}`}
          value={data.totals.visible}
        />
        <Metric
          label="Incidencias"
          tone={data.totals.incidents > 0 ? "danger" : "neutral"}
          value={data.totals.incidents}
        />
        <Metric label="No entregados" value={data.totals.notDelivered} />
        <Metric label="Entregados" value={data.totals.delivered} />
        <Metric
          label="Fuera de plazo"
          tone={data.totals.overdue > 0 ? "danger" : "neutral"}
          value={data.totals.overdue}
        />
      </MetricGroup>

      {data.pendingBeforeMonth > 0 && data.period !== "HISTORY" ? (
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
        <form className="flex gap-2 lg:hidden" method="get">
          <input name="period" type="hidden" value={data.period} />
          {data.search ? (
            <input name="q" type="hidden" value={data.search} />
          ) : null}
          <label className="min-w-0 flex-1">
            <span className="sr-only">Filtrar pedidos</span>
            <select
              className="ui-filter-select"
              defaultValue={data.filter}
              name="status"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="ui-filter-submit" type="submit">
            Aplicar
          </button>
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

        <form className="ui-order-search" method="get">
          <input name="period" type="hidden" value={data.period} />
          {data.filter !== "ALL" ? (
            <input name="status" type="hidden" value={data.filter} />
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
          <button className="ui-filter-submit" type="submit">
            Buscar
          </button>
        </form>

        <p className="text-xs text-neutral-600 md:basis-full">
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
            data.totals.visible > 0
              ? "No hay ventas que coincidan con este estado o búsqueda."
              : data.period === "TODAY"
                ? "No se registraron ventas hoy."
                : data.period === "WEEK"
                  ? "No se registraron ventas esta semana."
                  : data.period === "MONTH"
                    ? "No se registraron ventas en el mes actual."
                    : "No se encontraron ventas en el histórico."
          }
          title={
            data.totals.visible > 0
              ? "No hay coincidencias"
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
                  expanded={expanded}
                  key={order.id}
                  onToggle={() => {
                    setExpandedOrderId(expanded ? null : order.id);
                  }}
                  order={order}
                />
              );
            })}
          </section>

          <section className="hidden grid-cols-[minmax(0,1fr)_420px] gap-5 lg:grid">
            <DesktopOrderList
              items={data.items}
              onSelect={setSelectedOrderId}
              selectedOrderId={selectedOrder?.id ?? null}
            />

            <aside className="sticky top-8 max-h-[calc(100vh-64px)] self-start overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              {selectedOrder ? (
                <OrderDetails key={selectedOrder.id} order={selectedOrder} />
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
