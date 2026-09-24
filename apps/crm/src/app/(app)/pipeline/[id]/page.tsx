import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";
import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import type { OpportunityStage } from "@/generated/prisma/enums";
import { formatDateTime, localParts } from "@/lib/time";
import { requireAccess } from "@/server/auth/access";
import { actorLabel, describeOpportunityEvent } from "@/server/opportunities/describe";
import { activePlans, assignableMembers, getOpportunityDetail, memberNames } from "@/server/opportunities/queries";
import {
  canTransition,
  daysInStage,
  lostReasonLabel,
  LOST_REASONS,
  manualTargets,
  NEXT_ACTION_LABELS,
  ORDER_STATUS_LABELS,
  ORIGIN_LABELS,
  RELATION_LABELS,
  soles,
  STAGE_HINTS,
  STAGE_LABELS,
} from "@/server/opportunities/rules";

import { assignOpportunity, linkOrderByReference, moveStage, saveNextAction, unlinkOrderFromOpportunity } from "../actions";
import { ProposalForm } from "../proposal-form";

import "../pipeline.css";

export const dynamic = "force-dynamic";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="pipeline-facts__label">{label}</p>
      <p className="pipeline-facts__value">{value}</p>
    </div>
  );
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAccess();
  const { id } = await params;
  const opportunity = await getOpportunityDetail(access, id);
  if (!opportunity) notFound();

  const [names, plans, members] = await Promise.all([
    memberNames(access.organizationId),
    activePlans(access.organizationId),
    access.role === "OWNER" || access.role === "SUPERVISOR" ? assignableMembers(access.organizationId) : Promise.resolve([]),
  ]);

  const canWork = access.role !== "BACKOFFICE";
  const targets = canWork ? manualTargets(opportunity.stage) : [];
  const simpleTargets = targets.filter((stage) => stage !== "PERDIDA" && !requiresReason(opportunity.stage, stage));
  const backTargets = targets.filter((stage) => stage !== "PERDIDA" && requiresReason(opportunity.stage, stage));
  const canLose = targets.includes("PERDIDA");

  const nextAt = opportunity.nextActionAt ? localParts(opportunity.nextActionAt, access.timezone) : null;
  const nextDate = nextAt ? `${nextAt.year}-${String(nextAt.month).padStart(2, "0")}-${String(nextAt.day).padStart(2, "0")}` : "";
  const nextTime = nextAt ? `${String(nextAt.hour).padStart(2, "0")}:${String(nextAt.minute).padStart(2, "0")}` : "";

  const contactName = opportunity.contact.displayName ?? opportunity.contact.phone ?? "Sin nombre";
  const agendaHref = `/calendar/new?contactId=${opportunity.contactId}&opportunityId=${opportunity.id}${opportunity.conversationId ? `&conversationId=${opportunity.conversationId}` : ""}`;

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={STAGE_HINTS[opportunity.stage]}
        eyebrow="Embudo"
        meta={
          <>
            <StatusBadge tone={opportunity.stage === "GANADA" ? "success" : opportunity.stage === "PERDIDA" ? "danger" : "info"}>
              {STAGE_LABELS[opportunity.stage]}
            </StatusBadge>
            <Link className="ui-button ui-button--quiet" href="/pipeline">
              Volver al embudo
            </Link>
          </>
        }
        title={contactName}
      />

      <div className="pipeline-detail">
        <div className="pipeline-detail__column">
          <SectionPanel description="Los cambios quedan en el historial con autor y hora." title="Etapa">
            {opportunity.stage === "PERDIDA" ? (
              <p className="ui-feedback" data-tone="danger">
                Cerrada como perdida: {lostReasonLabel(opportunity.lostReason).toLowerCase()}.{opportunity.lostDetail ? ` ${opportunity.lostDetail}` : ""}
              </p>
            ) : null}
            {opportunity.stage === "GANADA" ? (
              <p className="ui-feedback" data-tone="success">
                Ganada el {formatDateTime(opportunity.wonAt, access.timezone)}.{opportunity.orderDropped ? " El pedido se canceló después: cuenta como venta caída." : ""}
              </p>
            ) : null}
            {!canWork ? <p className="ui-field__hint">El back office consulta el embudo pero no mueve oportunidades.</p> : null}
            {simpleTargets.length > 0 ? (
              <div className="ui-form-row">
                {simpleTargets.map((stage) => (
                  <ActionForm action={moveStage} className="" key={stage} submitLabel={`Mover a ${STAGE_LABELS[stage]}`} variant="secondary">
                    <input name="id" type="hidden" value={opportunity.id} />
                    <input name="stage" type="hidden" value={stage} />
                  </ActionForm>
                ))}
              </div>
            ) : null}
            {backTargets.length > 0 ? (
              <ActionForm action={moveStage} submitLabel={opportunity.stage === "PERDIDA" ? "Reabrir" : "Retroceder"} variant="quiet">
                <input name="id" type="hidden" value={opportunity.id} />
                <div className="ui-form-row">
                  <label className="ui-field ui-form-row__fixed">
                    <span className="ui-field__label">Etapa</span>
                    <select className="ui-control ui-control--select" name="stage">
                      {backTargets.map((stage) => (
                        <option key={stage} value={stage}>
                          {STAGE_LABELS[stage]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-field ui-form-row__grow">
                    <span className="ui-field__label">Motivo</span>
                    <input className="ui-control" name="reason" required />
                  </label>
                </div>
              </ActionForm>
            ) : null}
            {canLose ? (
              <ActionForm action={moveStage} submitLabel="Cerrar como perdida" variant="danger">
                <input name="id" type="hidden" value={opportunity.id} />
                <input name="stage" type="hidden" value="PERDIDA" />
                <div className="ui-form-row">
                  <label className="ui-field ui-form-row__fixed">
                    <span className="ui-field__label">Motivo</span>
                    <select className="ui-control ui-control--select" name="lostReason">
                      {LOST_REASONS.map((reason) => (
                        <option key={reason.code} value={reason.code}>
                          {reason.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-field ui-form-row__grow">
                    <span className="ui-field__label">Detalle</span>
                    <input className="ui-control" name="lostDetail" />
                  </label>
                </div>
              </ActionForm>
            ) : null}
          </SectionPanel>

          {canWork ? (
            <SectionPanel description="De aquí sale el cargo fijo que se compara luego con el pedido." title="Propuesta">
              <ProposalForm
                fixedCharge={opportunity.proposalFixedCharge === null ? null : Number(opportunity.proposalFixedCharge)}
                lines={opportunity.proposalLines}
                opportunityId={opportunity.id}
                planId={opportunity.proposalPlanId}
                plans={plans}
              />
            </SectionPanel>
          ) : null}

          <SectionPanel description="Al vincular un pedido la oportunidad queda ganada." title={`Pedidos (${opportunity.orders.length})`}>
            {opportunity.orders.length === 0 ? (
              <p className="ui-field__hint">Sin pedidos vinculados todavía.</p>
            ) : (
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Plan</th>
                      <th>Cargo fijo</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {opportunity.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/orders/${order.id}`}>{order.externalRef}</Link>
                        </td>
                        <td>{order.planName ?? "—"}</td>
                        <td>{soles(order.fixedCharge === null ? null : Number(order.fixedCharge))}</td>
                        <td>
                          <StatusBadge tone={order.status === "ACTIVADO" ? "success" : order.status === "CANCELADO" ? "danger" : "neutral"}>
                            {ORDER_STATUS_LABELS[order.status]}
                          </StatusBadge>
                        </td>
                        <td>
                          <ActionForm action={unlinkOrderFromOpportunity} className="" submitLabel="Desvincular" variant="quiet">
                            <input name="id" type="hidden" value={opportunity.id} />
                            <input name="orderId" type="hidden" value={order.id} />
                            <input aria-label="Motivo" className="ui-control" name="reason" placeholder="Motivo" required />
                          </ActionForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ActionForm action={linkOrderByReference} submitLabel="Vincular pedido" variant="secondary">
              <input name="id" type="hidden" value={opportunity.id} />
              <label className="ui-field">
                <span className="ui-field__label">Vincular un pedido ya registrado</span>
                <input className="ui-control" name="externalRef" placeholder="Referencia del pedido" required />
                <span className="ui-field__hint">Si el pedido todavía no existe, regístralo en Pedidos.</span>
              </label>
            </ActionForm>
          </SectionPanel>

          <SectionPanel description="Solo se añaden líneas: nada se edita ni se borra." title="Historial">
            <ol className="pipeline-timeline">
              {opportunity.events.map((event) => (
                <li className="pipeline-timeline__item" key={event.id}>
                  <p className="pipeline-timeline__text">{describeOpportunityEvent(event)}</p>
                  <p className="pipeline-timeline__meta">
                    {actorLabel(event, names)} · {formatDateTime(event.createdAt, access.timezone)}
                  </p>
                </li>
              ))}
            </ol>
          </SectionPanel>
        </div>

        <div className="pipeline-detail__column">
          <SectionPanel
            aside={
              opportunity.conversationId ? (
                <Link className="ui-button ui-button--quiet" href={`/inbox/${opportunity.conversationId}`}>
                  Ver conversación
                </Link>
              ) : null
            }
            title="Cliente"
          >
            <div className="pipeline-facts">
              <Fact label="Teléfono" value={opportunity.contact.phone ?? "—"} />
              <Fact label="DNI" value={opportunity.contact.documentNumber ?? "—"} />
              <Fact label="Distrito" value={opportunity.contact.district ?? "—"} />
              <Fact label="Operador actual" value={opportunity.contact.currentCarrier ?? "—"} />
              <Fact label="Origen" value={ORIGIN_LABELS[opportunity.origin]} />
              <Fact label="Relación" value={RELATION_LABELS[opportunity.customerRelation]} />
              <Fact label="Días en la etapa" value={String(daysInStage(opportunity.stageChangedAt))} />
              <Fact label="Responsable" value={opportunity.assignedUserId ? (names.get(opportunity.assignedUserId) ?? "—") : "Sin responsable"} />
            </div>
          </SectionPanel>

          {canWork ? (
            <SectionPanel
              aside={
                <Link className="ui-button ui-button--quiet" href={agendaHref}>
                  Agendar
                </Link>
              }
              description="Qué toca hacer y cuándo. La fecha vencida sale en rojo en el tablero."
              title="Siguiente acción"
            >
              <ActionForm action={saveNextAction} submitLabel="Guardar">
                <input name="id" type="hidden" value={opportunity.id} />
                <label className="ui-field">
                  <span className="ui-field__label">Qué toca</span>
                  <select className="ui-control ui-control--select" defaultValue={opportunity.nextActionKind ?? ""} name="kind">
                    <option value="">Nada pendiente</option>
                    {(Object.keys(NEXT_ACTION_LABELS) as (keyof typeof NEXT_ACTION_LABELS)[]).map((kind) => (
                      <option key={kind} value={kind}>
                        {NEXT_ACTION_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="ui-form-row">
                  <label className="ui-field ui-form-row__grow">
                    <span className="ui-field__label">Fecha (Lima)</span>
                    <input className="ui-control" defaultValue={nextDate} name="date" type="date" />
                  </label>
                  <label className="ui-field ui-form-row__fixed">
                    <span className="ui-field__label">Hora</span>
                    <input className="ui-control" defaultValue={nextTime} name="time" type="time" />
                  </label>
                </div>
              </ActionForm>
            </SectionPanel>
          ) : null}

          {members.length > 0 ? (
            <SectionPanel title="Responsable">
              <ActionForm action={assignOpportunity} submitLabel="Cambiar responsable" variant="secondary">
                <input name="id" type="hidden" value={opportunity.id} />
                <label className="ui-field">
                  <span className="ui-field__label">Quién la trabaja</span>
                  <select className="ui-control ui-control--select" defaultValue={opportunity.assignedUserId ?? ""} name="userId">
                    <option value="">Sin responsable</option>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              </ActionForm>
            </SectionPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function requiresReason(from: OpportunityStage, to: OpportunityStage): boolean {
  const verdict = canTransition(from, to, "USER");
  return verdict.allowed && verdict.requiresReason;
}
