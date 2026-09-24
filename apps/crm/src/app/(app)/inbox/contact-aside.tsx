import Link from "next/link";

import { StatusBadge } from "@repo/ui/status-badge";

import { ActionForm } from "@/components/forms/action-form";
import { canRespond } from "@/server/auth/access";
import type { Access } from "@/server/auth/access";
import type { ConversationDetail } from "@/server/inbox/queries";
import { setMarketingConsent, updateContact } from "@/server/inbox/actions";
import { describeConversationEvent } from "@/server/inbox/rules";
import { formatDateTime } from "@/lib/time";

import { AsideClose } from "./chat-client-bits";
import {
  APPOINTMENT_STATUS_LABELS,
  NEXT_ACTION_LABELS,
  ORDER_STATUS_LABELS,
  ORIGIN_LABELS,
  STAGE_LABELS,
} from "./labels";

/** Lee `headline` y `source_url` del referral que Meta mandó con el primer mensaje. */
function referralOf(value: unknown): { headline?: string; sourceUrl?: string; body?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const referral = value as Record<string, unknown>;
  return {
    headline: typeof referral.headline === "string" ? referral.headline : undefined,
    sourceUrl: typeof referral.source_url === "string" ? referral.source_url : undefined,
    body: typeof referral.body === "string" ? referral.body : undefined,
  };
}

/** Ficha del cliente: todo lo que el sistema ya sabe, sin salir del chat. */
export function ContactAside({ access, detail }: { access: Access; detail: ConversationDetail }) {
  const { conversation, contact, opportunity, orders, appointments, events, names, marketingConsent } = detail;
  const editable = canRespond(access.role);
  const referral = referralOf(conversation.originReferral);
  const scheduleHref = `/calendar/new?contactId=${contact.id}&conversationId=${conversation.id}${opportunity ? `&opportunityId=${opportunity.id}` : ""}`;

  return (
    <aside className="inbox__aside" data-open="false" id="inbox-aside">
      <div className="inbox-aside__header">
        <h2>Ficha del cliente</h2>
        <AsideClose />
      </div>
      <div className="inbox-aside__scroll">
        <section className="inbox-aside__section">
          <p className="inbox-aside__title">Datos</p>
          {editable ? (
            <ActionForm action={updateContact} pendingLabel="Guardando…" submitLabel="Guardar datos" variant="secondary">
              <input name="contactId" type="hidden" value={contact.id} />
              <label className="ui-field">
                <span className="ui-field__label">Nombre</span>
                <input className="ui-control" defaultValue={contact.displayName ?? ""} name="displayName" placeholder="Como quiere que le llamen" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Documento</span>
                <input className="ui-control" defaultValue={contact.documentNumber ?? ""} name="documentNumber" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Distrito</span>
                <input className="ui-control" defaultValue={contact.district ?? ""} name="district" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Operador actual</span>
                <input className="ui-control" defaultValue={contact.currentCarrier ?? ""} name="currentCarrier" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Correo</span>
                <input className="ui-control" defaultValue={contact.email ?? ""} name="email" type="email" />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Etiquetas</span>
                <input className="ui-control" defaultValue={contact.tags.join(", ")} name="tags" placeholder="separadas por coma" />
              </label>
            </ActionForm>
          ) : (
            <dl className="inbox-aside__dl">
              <div><dt>Nombre</dt><dd>{contact.displayName ?? "Sin nombre"}</dd></div>
              <div><dt>Teléfono</dt><dd>{contact.phone ? `+${contact.phone}` : "Sin teléfono"}</dd></div>
              <div><dt>Documento</dt><dd>{contact.documentNumber ?? "—"}</dd></div>
              <div><dt>Distrito</dt><dd>{contact.district ?? "—"}</dd></div>
              <div><dt>Operador</dt><dd>{contact.currentCarrier ?? "—"}</dd></div>
              <div><dt>Correo</dt><dd>{contact.email ?? "—"}</dd></div>
              <div><dt>Etiquetas</dt><dd>{contact.tags.length ? contact.tags.join(", ") : "—"}</dd></div>
            </dl>
          )}
        </section>

        <section className="inbox-aside__section">
          <p className="inbox-aside__title">Promociones</p>
          <p className="inbox-aside__muted">
            {contact.marketingOptIn ? "Acepta recibir promociones." : "No recibirá promociones."}
            {marketingConsent ? ` Última vez: ${formatDateTime(marketingConsent.createdAt, access.timezone)}.` : ""}
          </p>
          {editable ? (
            <ActionForm action={setMarketingConsent} pendingLabel="Registrando…" submitLabel="Registrar" variant="secondary">
              <input name="contactId" type="hidden" value={contact.id} />
              <label className="inbox-switch">
                <input defaultChecked={contact.marketingOptIn} name="granted" type="checkbox" />
                <span>Acepta recibir promociones</span>
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Evidencia</span>
                <input className="ui-control" name="evidenceText" placeholder="Qué dijo o dónde aceptó" required />
              </label>
            </ActionForm>
          ) : null}
        </section>

        <section className="inbox-aside__section">
          <p className="inbox-aside__title">De dónde vino</p>
          <dl className="inbox-aside__dl">
            <div><dt>Origen</dt><dd>{ORIGIN_LABELS[contact.initialOrigin] ?? contact.initialOrigin}</dd></div>
            {conversation.originAdId ? <div><dt>Anuncio</dt><dd>{conversation.originAdId}</dd></div> : null}
            {referral.headline ? <div><dt>Titular</dt><dd>{referral.headline}</dd></div> : null}
            {referral.body ? <div><dt>Texto</dt><dd>{referral.body}</dd></div> : null}
            {referral.sourceUrl ? (
              <div>
                <dt>Publicación</dt>
                <dd><a className="inbox-aside__link" href={referral.sourceUrl} rel="noreferrer noopener" target="_blank">Ver el anuncio</a></dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="inbox-aside__section">
          <p className="inbox-aside__title">Oportunidad abierta</p>
          {opportunity ? (
            <>
              <dl className="inbox-aside__dl">
                <div><dt>Etapa</dt><dd>{STAGE_LABELS[opportunity.stage] ?? opportunity.stage}</dd></div>
                <div>
                  <dt>Siguiente acción</dt>
                  <dd>
                    {opportunity.nextActionAt
                      ? `${NEXT_ACTION_LABELS[opportunity.nextActionKind ?? ""] ?? "Pendiente"} · ${formatDateTime(opportunity.nextActionAt, access.timezone)}`
                      : "Sin definir"}
                  </dd>
                </div>
                <div><dt>Origen</dt><dd>{ORIGIN_LABELS[opportunity.origin] ?? opportunity.origin}</dd></div>
                {opportunity.proposalPlan ? <div><dt>Propuesta</dt><dd>{opportunity.proposalPlan.name}</dd></div> : null}
              </dl>
              <p className="inbox-aside__muted">
                <Link className="inbox-aside__link" href={`/pipeline/${opportunity.id}`}>Abrir en el embudo</Link>
              </p>
            </>
          ) : (
            <p className="inbox-aside__muted">
              {conversation.isOrderInquiry ? "Es una consulta sobre un pedido: no abre oportunidad." : "No hay ninguna oportunidad abierta con esta persona."}
            </p>
          )}
        </section>

        <section className="inbox-aside__section">
          <p className="inbox-aside__title">Pedidos</p>
          {orders.length ? (
            <ul className="inbox-aside__list">
              {orders.map((order) => {
                const status = ORDER_STATUS_LABELS[order.status] ?? { label: order.status, tone: "neutral" as const };
                return (
                  <li key={order.id}>
                    <span>
                      <Link className="inbox-aside__link" href="/orders">{order.externalRef}</Link>
                      {order.planName ? ` · ${order.planName}` : ""}
                    </span>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="inbox-aside__muted">Todavía no hay pedidos de esta persona.</p>
          )}
        </section>

        <section className="inbox-aside__section">
          <p className="inbox-aside__title">Próximas citas</p>
          {appointments.length ? (
            <ul className="inbox-aside__list">
              {appointments.map((appointment) => (
                <li key={appointment.id}>
                  <span>{formatDateTime(appointment.scheduledAt, access.timezone)}</span>
                  <StatusBadge tone={appointment.status === "PENDING" ? "info" : "neutral"}>
                    {APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="inbox-aside__muted">Sin citas pendientes.</p>
          )}
          {editable ? (
            <p className="inbox-aside__muted">
              <Link className="inbox-aside__link" href={scheduleHref}>Agendar</Link>
            </p>
          ) : null}
        </section>

        <details className="inbox-aside__section">
          <summary>Qué pasó en esta conversación</summary>
          {events.length ? (
            <ul className="inbox-aside__timeline">
              {[...events].reverse().map((event) => (
                <li key={event.id}>
                  <time dateTime={event.createdAt.toISOString()}>{formatDateTime(event.createdAt, access.timezone)}</time>
                  {describeConversationEvent(event, names)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="inbox-aside__muted">Nada todavía.</p>
          )}
        </details>
      </div>
    </aside>
  );
}
