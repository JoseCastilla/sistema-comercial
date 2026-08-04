"use client";

import { useMemo, useState } from "react";

import { OrderStatusForm } from "./order-status-form";

import type {
  OrderInboxData,
  OrderInboxItem,
  OrderSlaState,
} from "../order-inbox.types";

type OrderFilter =
  "ACTIVE" | "INCIDENTS" | "RECOVERY" | "DELIVERED" | "FINAL" | "ALL";

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

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchesFilter(order: OrderInboxItem, filter: OrderFilter): boolean {
  switch (filter) {
    case "ACTIVE":
      return order.status !== "CLOSED" && order.status !== "CANCELLED";

    case "INCIDENTS":
      return (
        order.noStatusIncident ||
        order.sentSubstatus === "REJECTED" ||
        order.slaState === "OVERDUE"
      );

    case "RECOVERY":
      return (
        order.sentSubstatus === "NOT_DELIVERED" ||
        order.sentSubstatus === "REJECTED"
      );

    case "DELIVERED":
      return order.sentSubstatus === "DELIVERED" || order.status === "CLOSED";

    case "FINAL":
      return order.status === "CLOSED" || order.status === "CANCELLED";

    case "ALL":
      return true;
  }
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

function OrderDetails({ order }: { order: OrderInboxItem }) {
  const formKey = [
    order.id,
    order.status,
    order.sentSubstatus ?? "none",
    order.deliveryObservation ?? "none",
  ].join(":");

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
      </div>

      <div>
        <h3 className="text-lg font-semibold text-neutral-950">
          {order.holderName}
        </h3>

        <p className="mt-1 text-sm text-neutral-600">
          DNI {order.documentNumber}
          {" · "}
          {order.serviceNumber}
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

function SummaryCard({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <article
      className={[
        "rounded-2xl border p-4 shadow-sm",
        emphasis ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white",
      ].join(" ")}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-neutral-950">{value}</p>
    </article>
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
            <button
              className={[
                "grid w-full grid-cols-[140px_minmax(220px,1.5fr)_minmax(150px,1fr)_220px_120px] items-center gap-3 px-4 py-3 text-left transition",
                selected ? "bg-neutral-100" : "hover:bg-neutral-50",
                order.noStatusIncident
                  ? "border-l-4 border-l-red-500"
                  : "border-l-4 border-l-transparent",
              ].join(" ")}
              key={order.id}
              onClick={() => {
                onSelect(order.id);
              }}
              type="button"
            >
              <span className="font-mono text-xs font-semibold text-neutral-700">
                {order.orderCode}
              </span>

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
          );
        })}
      </div>
    </div>
  );
}

export function OrderInbox({ data }: { data: OrderInboxData }) {
  const [filter, setFilter] = useState<OrderFilter>("ACTIVE");

  const [search, setSearch] = useState("");

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    data.items[0]?.id ?? null,
  );

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);

    return data.items.filter((order) => {
      if (!matchesFilter(order, filter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableContent = normalizeSearch(
        [
          order.orderCode,
          order.holderName,
          order.documentNumber,
          order.serviceNumber,
          order.agentName,
          order.locationLabel,
          order.statusLabel,
          order.sentSubstatusLabel ?? "",
        ].join(" "),
      );

      return searchableContent.includes(normalizedSearch);
    });
  }, [data.items, filter, search]);

  const selectedOrder =
    filteredItems.find((order) => {
      return order.id === selectedOrderId;
    }) ??
    filteredItems[0] ??
    null;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-medium text-neutral-500">
          Operación comercial
        </p>

        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Seguimiento de órdenes
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              Revisa incidencias, recupera pedidos y actualiza manualmente el
              avance informado por Integratel.
            </p>
          </div>

          <p className="text-xs text-neutral-500">
            Actualizado: {data.generatedAt}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <SummaryCard label="Órdenes visibles" value={data.totals.visible} />

        <SummaryCard
          emphasis={data.totals.incidents > 0}
          label="Incidencias"
          value={data.totals.incidents}
        />

        <SummaryCard label="No entregados" value={data.totals.notDelivered} />

        <SummaryCard label="Entregados" value={data.totals.delivered} />

        <SummaryCard
          emphasis={data.totals.overdue > 0}
          label="Fuera de plazo"
          value={data.totals.overdue}
        />
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {filterOptions.map((option) => {
                const active = option.value === filter;

                return (
                  <button
                    className={[
                      "rounded-full px-3 py-2 text-sm font-medium transition",
                      active
                        ? "bg-neutral-950 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                    ].join(" ")}
                    key={option.value}
                    onClick={() => {
                      setFilter(option.value);
                      setExpandedOrderId(null);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="relative block w-full xl:max-w-sm">
            <span className="sr-only">Buscar pedidos</span>

            <input
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              onChange={(event) => {
                setSearch(event.target.value);
                setExpandedOrderId(null);
              }}
              placeholder="Buscar orden, cliente, teléfono o asesor"
              type="search"
              value={search}
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-neutral-500">
          {filteredItems.length} órdenes encontradas
        </p>
      </section>

      {filteredItems.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
          <h2 className="font-medium text-neutral-900">
            No se encontraron órdenes
          </h2>

          <p className="mt-2 text-sm text-neutral-500">
            Cambia el filtro o utiliza otra búsqueda.
          </p>
        </section>
      ) : (
        <>
          <section className="space-y-3 lg:hidden">
            {filteredItems.map((order) => {
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
              items={filteredItems}
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
    </div>
  );
}
