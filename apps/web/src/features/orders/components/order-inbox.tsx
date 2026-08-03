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
        order.slaState === "OVERDUE"
          ? "border-red-300"
          : order.matchStatus === "NEEDS_REVIEW"
            ? "border-violet-300"
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
          {order.matchStatus === "NEEDS_REVIEW" ? (
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
              Revisar duplicado
            </span>
          ) : (
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
              Sin asociar
            </span>
          )}

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
          <dt className="text-neutral-500">Ventana de entrega</dt>

          <dd className="mt-1 font-medium text-neutral-900">
            {order.deliveryWindowLabel}
          </dd>
        </div>

        <div>
          <dt className="text-neutral-500">Hora límite</dt>

          <dd
            className={[
              "mt-1 font-medium",
              order.slaState === "OVERDUE"
                ? "text-red-700"
                : "text-neutral-900",
            ].join(" ")}
          >
            {order.deliveryDueAtLabel ?? "Pendiente"}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="text-xs text-neutral-500">
          Aprobación: {order.approvedAtLabel}
        </p>
      </div>
    </article>
  );
}

export function OrderInbox({ data }: { data: OrderInboxData }) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Pedidos visibles" value={data.totals.visible} />

        <SummaryCard
          label="Requieren revisión"
          value={data.totals.needsReview}
        />

        <SummaryCard
          emphasis={data.totals.overdue > 0}
          label="Fuera de plazo"
          value={data.totals.overdue}
        />

        <SummaryCard label="Express" value={data.totals.express} />

        <SummaryCard label="Turno pendiente" value={data.totals.pendingShift} />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">
              Pedidos pendientes de asociación
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Máximo 50 registros, ordenados por revisión y urgencia.
            </p>
          </div>

          <p className="text-xs text-neutral-500">
            Actualizado: {data.generatedAt}
          </p>
        </div>

        {data.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <h3 className="font-medium text-neutral-900">
              No hay pedidos pendientes
            </h3>

            <p className="mt-2 text-sm text-neutral-500">
              Las nuevas órdenes DITO aparecerán automáticamente en esta
              bandeja.
            </p>
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
