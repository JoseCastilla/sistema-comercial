import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { formatDateTime } from "@/lib/time";
import { requireAccess } from "@/server/auth/access";
import { database } from "@/server/database";
import { ORDER_STATUS_LABELS, ORIGIN_LABELS, soles, STAGE_LABELS } from "@/server/opportunities/rules";
import { candidatesForOrder, candidateSummaries, nextOrderStatuses } from "@/server/orders/service";

import { changeOrderStatus, linkOrderToOpportunity } from "../actions";
import { statusTone } from "../tone";

export const dynamic = "force-dynamic";

const STATUS_HELP: Record<string, string> = {
  ENTREGADO: "Marca entregado cuando el chip llegó a manos del cliente.",
  ACTIVADO: "Marca activado cuando la línea ya funciona: recién ahí cuenta como venta efectiva.",
  CANCELADO: "Cancelar deja la venta fuera de los montos. Si la oportunidad estaba ganada, se marca como venta caída.",
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAccess();
  const { id } = await params;
  const order = await database.order.findFirst({
    where: { id, organizationId: access.organizationId },
    include: {
      contact: { select: { id: true, displayName: true, phone: true, documentNumber: true } },
      opportunity: { select: { id: true, stage: true, origin: true, contact: { select: { displayName: true, phone: true } } } },
    },
  });
  if (!order) notFound();

  const canRegister = access.role !== "AGENT";
  const decision = order.opportunityId
    ? { kind: "NONE" as const }
    : await candidatesForOrder(access.organizationId, { documentNumber: order.documentNumber, phone: order.phone, contactId: order.contactId });
  const candidateIds = decision.kind === "SUGGESTED" ? decision.opportunityIds : decision.kind === "AUTO" ? [decision.opportunityId] : [];
  const candidates = await candidateSummaries(access.organizationId, candidateIds);

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={`Registrado el ${formatDateTime(order.registeredAt, access.timezone)} en hora de Lima.`}
        eyebrow="Pedidos"
        meta={
          <>
            <StatusBadge tone={statusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
            <Link className="ui-button ui-button--quiet" href="/orders">
              Volver a pedidos
            </Link>
          </>
        }
        title={order.externalRef}
      />

      <SectionPanel title="Datos del pedido">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <tbody>
              <tr>
                <th scope="row">Titular</th>
                <td>{order.holderName ?? "—"}</td>
                <th scope="row">DNI</th>
                <td>{order.documentNumber ?? "—"}</td>
              </tr>
              <tr>
                <th scope="row">Teléfono</th>
                <td>{order.phone ?? "—"}</td>
                <th scope="row">Plan</th>
                <td>{order.planName ?? "—"}</td>
              </tr>
              <tr>
                <th scope="row">Cargo fijo</th>
                <td>{soles(order.fixedCharge === null ? null : Number(order.fixedCharge))}</td>
                <th scope="row">Entregado</th>
                <td>{order.deliveredAt ? formatDateTime(order.deliveredAt, access.timezone) : "—"}</td>
              </tr>
              <tr>
                <th scope="row">Activado</th>
                <td>{order.activatedAt ? formatDateTime(order.activatedAt, access.timezone) : "—"}</td>
                <th scope="row">Cancelado</th>
                <td>{order.cancelledAt ? formatDateTime(order.cancelledAt, access.timezone) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionPanel>

      {canRegister ? (
        <SectionPanel description="El estado manda: es lo que decide si la venta cuenta como pedida, confirmada o efectiva." title="Cambiar estado">
          {nextOrderStatuses(order.status).length === 0 ? (
            <p className="ui-field__hint">Un pedido cancelado ya no cambia de estado.</p>
          ) : (
            <div className="ui-form-row">
              {nextOrderStatuses(order.status).map((status) => (
                <ActionForm
                  action={changeOrderStatus}
                  className=""
                  confirm={status === "CANCELADO" ? "¿Cancelar este pedido? La venta deja de contar en los montos." : undefined}
                  key={status}
                  submitLabel={`Marcar ${ORDER_STATUS_LABELS[status].toLowerCase()}`}
                  variant={status === "CANCELADO" ? "danger" : "secondary"}
                >
                  <input name="orderId" type="hidden" value={order.id} />
                  <input name="status" type="hidden" value={status} />
                </ActionForm>
              ))}
            </div>
          )}
          <ul>
            {nextOrderStatuses(order.status).map((status) => (
              <li className="ui-field__hint" key={status}>
                {STATUS_HELP[status]}
              </li>
            ))}
          </ul>
        </SectionPanel>
      ) : null}

      <SectionPanel title="Oportunidad">
        {order.opportunity ? (
          <p>
            Vinculado a{" "}
            <Link href={`/pipeline/${order.opportunity.id}`}>
              {order.opportunity.contact.displayName ?? order.opportunity.contact.phone ?? "la oportunidad"}
            </Link>{" "}
            · {STAGE_LABELS[order.opportunity.stage]} · llegó por {ORIGIN_LABELS[order.opportunity.origin].toLowerCase()}.
            {order.linkConfidence === "CONFIRMED" ? " El vínculo está confirmado." : ""}
          </p>
        ) : candidates.length > 0 ? (
          <>
            <p className="ui-field__hint">
              Hay más de una conversación que puede ser este pedido, o solo coincide el teléfono. Elige cuál es: hasta entonces la venta no se atribuye a nadie.
            </p>
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Etapa</th>
                    <th>Origen</th>
                    <th>Última actividad</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.id}>
                      <td>
                        <Link href={`/pipeline/${candidate.id}`}>{candidate.contactName}</Link>
                        <br />
                        <small>{candidate.documentNumber ?? candidate.contactPhone ?? "Sin datos"}</small>
                      </td>
                      <td>{STAGE_LABELS[candidate.stage]}</td>
                      <td>{ORIGIN_LABELS[candidate.origin]}</td>
                      <td>{formatDateTime(candidate.lastActivityAt, access.timezone)}</td>
                      <td>
                        <ActionForm action={linkOrderToOpportunity} className="" submitLabel="Vincular" variant="secondary">
                          <input name="orderId" type="hidden" value={order.id} />
                          <input name="opportunityId" type="hidden" value={candidate.id} />
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="ui-field__hint">
            Este pedido no está vinculado a ninguna conversación: en Resultados cuenta como origen desconocido. Puedes vincularlo desde la oportunidad, escribiendo su referencia.
          </p>
        )}
      </SectionPanel>
    </div>
  );
}
