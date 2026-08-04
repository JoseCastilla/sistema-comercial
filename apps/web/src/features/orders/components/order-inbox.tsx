import { OrderStatusForm } from "./order-status-form";

import type {
  OrderInboxData,
  OrderInboxItem,
  OrderSlaState,
} from "../server/get-order-inbox";

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
        "rounded-xl border p-4",
        emphasis ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white",
      ].join(" ")}
    >
      <p className="text-sm text-neutral-500">{label}</p>

      <p className="mt-1 text-2xl font-semibold text-neutral-950">{value}</p>
    </article>
  );
}

function OrderCard({ order }: { order: OrderInboxItem }) {
  return (
    <article
      className={[
        "rounded-2xl border bg-white p-5 shadow-sm",
        order.noStatusIncident
          ? "border-red-300"
          : order.sentSubstatus === "NOT_DELIVERED"
            ? "border-amber-300"
            : "border-neutral-200",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-neutral-950">
            {order.orderCode}
          </p>

          <p className="mt-1 text-sm text-neutral-500">
            {order.registeredAtLabel}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
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

          <span
            className={[
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              getSlaClasses(order.slaState),
            ].join(" ")}
          >
            {order.slaLabel}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="text-base font-semibold text-neutral-950">
          {order.holderName}
        </h2>

        <p className="mt-1 text-sm text-neutral-600">
          DNI {order.documentNumber}
          {" · "}
          {order.serviceNumber}
        </p>
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Operación</dt>

          <dd className="mt-1 font-medium text-neutral-900">
            {order.operation}
          </dd>
        </div>

        <div>
          <dt className="text-neutral-500">Estado desde</dt>

          <dd className="mt-1 font-medium text-neutral-900">
            {order.statusAgeLabel}
          </dd>
        </div>

        <div>
          <dt className="text-neutral-500">Entrega</dt>

          <dd className="mt-1 font-medium text-neutral-900">
            {order.deliveryMethodLabel}
          </dd>
        </div>

        <div>
          <dt className="text-neutral-500">Ubicación</dt>

          <dd className="mt-1 font-medium text-neutral-900">
            {order.locationLabel}
          </dd>
        </div>

        <div>
          <dt className="text-neutral-500">Agente</dt>

          <dd className="mt-1 font-medium text-neutral-900">
            {order.agentName}
          </dd>
        </div>

        <div>
          <dt className="text-neutral-500">Ventana</dt>

          <dd className="mt-1 font-medium text-neutral-900">
            {order.deliveryWindowLabel}
          </dd>
        </div>
      </dl>

      {order.deliveryObservation ? (
        <div className="mt-5 rounded-lg bg-neutral-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Observación actual
          </p>

          <p className="mt-1 text-sm text-neutral-700">
            {order.deliveryObservation}
          </p>
        </div>
      ) : null}

      <div className="mt-5 border-t border-neutral-200 pt-5">
        <OrderStatusForm
          canUpdate={order.canUpdate}
          initialObservation={order.deliveryObservation}
          initialSentSubstatus={order.sentSubstatus}
          initialStatus={order.status}
          orderId={order.id}
        />
      </div>
    </article>
  );
}

export function OrderInbox({ data }: { data: OrderInboxData }) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">
              Seguimiento de órdenes DITO
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Estados actualizados manualmente por el equipo comercial.
            </p>
          </div>

          <p className="text-xs text-neutral-500">
            Actualizado: {data.generatedAt}
          </p>
        </div>

        {data.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <h3 className="font-medium text-neutral-900">
              No hay órdenes disponibles
            </h3>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.items.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
