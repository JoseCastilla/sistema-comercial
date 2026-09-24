import Link from "next/link";

import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import type { OrderStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/time";
import { requireAccess } from "@/server/auth/access";
import { activePlans } from "@/server/opportunities/queries";
import { ORDER_STATUS_LABELS, soles } from "@/server/opportunities/rules";
import { listOrders } from "@/server/orders/service";

import { registerOrder } from "./actions";
import { statusTone } from "./tone";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function one(search: Search, key: string): string {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function dayStart(value: string, offsetDays = 0): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00-05:00`);
  if (Number.isNaN(date.getTime())) return null;
  return offsetDays ? new Date(date.getTime() + offsetDays * 86_400_000) : date;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await requireAccess();
  const search = await searchParams;
  const estado = one(search, "estado");
  const desde = one(search, "desde");
  const hasta = one(search, "hasta");
  const status = estado in ORDER_STATUS_LABELS ? (estado as OrderStatus) : null;

  const [orders, plans] = await Promise.all([
    listOrders({ organizationId: access.organizationId, status, from: dayStart(desde), to: dayStart(hasta, 1) }),
    activePlans(access.organizationId),
  ]);
  const canRegister = access.role !== "AGENT";

  return (
    <div className="ui-page-stack">
      <PageHeader
        description="Registro provisional de ventas para saber qué campaña las trajo. Cuando el CRM se acople al Sistema Comercial, el pedido de DITO reemplaza a esta pantalla y estos datos dejan de escribirse a mano."
        eyebrow="CRM"
        title="Pedidos"
      />

      {canRegister ? (
        <SectionPanel
          description="Con el DNI se busca al cliente y se vincula sola la oportunidad cuando no hay dudas."
          title="Registrar pedido"
        >
          <ActionForm action={registerOrder} pendingLabel="Registrando…" submitLabel="Registrar pedido">
            <div className="ui-form-row">
              <label className="ui-field ui-form-row__fixed">
                <span className="ui-field__label">Referencia</span>
                <input className="ui-control" name="externalRef" placeholder="N.º de pedido" required />
                <span className="ui-field__hint">No se puede repetir.</span>
              </label>
              <label className="ui-field ui-form-row__fixed">
                <span className="ui-field__label">DNI del titular</span>
                <input className="ui-control" inputMode="numeric" name="documentNumber" />
              </label>
              <label className="ui-field ui-form-row__grow">
                <span className="ui-field__label">Titular</span>
                <input className="ui-control" name="holderName" />
              </label>
              <label className="ui-field ui-form-row__fixed">
                <span className="ui-field__label">Teléfono</span>
                <input className="ui-control" inputMode="tel" name="phone" />
              </label>
            </div>
            <div className="ui-form-row">
              <label className="ui-field ui-form-row__grow">
                <span className="ui-field__label">Plan del catálogo</span>
                <select className="ui-control ui-control--select" name="planName">
                  <option value="">Elegir del catálogo…</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.name}>
                      {plan.name} · S/ {plan.fixedCharge.toFixed(2)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ui-field ui-form-row__grow">
                <span className="ui-field__label">O escribe el plan</span>
                <input className="ui-control" name="planFree" placeholder="Si no está en el catálogo" />
              </label>
              <label className="ui-field ui-form-row__fixed">
                <span className="ui-field__label">Cargo fijo (S/)</span>
                <input className="ui-control" min={0} name="fixedCharge" step="0.01" type="number" />
              </label>
            </div>
            <div className="ui-form-row">
              <label className="ui-field ui-form-row__fixed">
                <span className="ui-field__label">Fecha de registro</span>
                <input className="ui-control" name="registeredDate" type="date" />
                <span className="ui-field__hint">Vacío: ahora mismo.</span>
              </label>
              <label className="ui-field ui-form-row__fixed">
                <span className="ui-field__label">Hora (Lima)</span>
                <input className="ui-control" name="registeredTime" type="time" />
              </label>
            </div>
          </ActionForm>
        </SectionPanel>
      ) : null}

      <SectionPanel title={`Pedidos (${orders.length})`}>
        <form action="/orders" className="ui-form-row" method="get">
          <label className="ui-field ui-form-row__fixed">
            <span className="ui-field__label">Estado</span>
            <select className="ui-control ui-control--select" defaultValue={status ?? ""} name="estado">
              <option value="">Todos</option>
              {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((value) => (
                <option key={value} value={value}>
                  {ORDER_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field ui-form-row__fixed">
            <span className="ui-field__label">Desde</span>
            <input className="ui-control" defaultValue={desde} name="desde" type="date" />
          </label>
          <label className="ui-field ui-form-row__fixed">
            <span className="ui-field__label">Hasta</span>
            <input className="ui-control" defaultValue={hasta} name="hasta" type="date" />
          </label>
          <button className="ui-button ui-button--secondary" type="submit">
            Filtrar
          </button>
        </form>

        {orders.length === 0 ? (
          <EmptyState
            description="Registra el primer pedido con su referencia y el DNI del titular: así la venta queda pegada a la conversación que la trajo."
            title="Sin pedidos en este filtro"
          />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Titular</th>
                  <th>Plan</th>
                  <th>Cargo fijo</th>
                  <th>Estado</th>
                  <th>Registrado</th>
                  <th>Oportunidad</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium">
                      <Link href={`/orders/${order.id}`}>{order.externalRef}</Link>
                    </td>
                    <td>
                      {order.holderName ?? "—"}
                      <br />
                      <small>{order.documentNumber ?? order.phone ?? "Sin datos"}</small>
                    </td>
                    <td>{order.planName ?? "—"}</td>
                    <td>{soles(order.fixedCharge === null ? null : Number(order.fixedCharge))}</td>
                    <td>
                      <StatusBadge tone={statusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
                    </td>
                    <td>{formatDateTime(order.registeredAt, access.timezone)}</td>
                    <td>
                      {order.opportunityId ? (
                        <Link href={`/pipeline/${order.opportunityId}`}>
                          {order.opportunity?.contact.displayName ?? order.opportunity?.contact.phone ?? "Ver oportunidad"}
                        </Link>
                      ) : (
                        <Link href={`/orders/${order.id}`}>Sin vincular</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
