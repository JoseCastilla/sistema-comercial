import Link from "next/link";

import { StatusBadge } from "@repo/ui/status-badge";

import type { Access } from "@/server/auth/access";
import { canRespond } from "@/server/auth/access";
import type { ConversationRow, listConversations } from "@/server/inbox/queries";
import { avatarInitial, contactTitle, listTimeLabel, responderLabel } from "@/server/inbox/rules";
import { INBOX_VIEWS, type InboxView } from "@/server/inbox/scope";

import { AvailabilitySwitch } from "./availability-switch";
import { inboxHref } from "./labels";
import { NotificationPermissionButton } from "./realtime";

/**
 * Columna izquierda: quién está esperando respuesta. Las vistas y la búsqueda
 * viven en la URL para poder compartir un enlace («mira las sin tomar»).
 */
export interface ListFiltersView {
  view: InboxView;
  query: string;
  page: number;
}

export function ConversationList({
  access,
  filters,
  list,
  overview,
  activeId,
}: {
  access: Access;
  filters: ListFiltersView;
  list: Awaited<ReturnType<typeof listConversations>>;
  overview: { hasConnectedNumber: boolean; available: boolean; totalInScope: number; countByView: Record<InboxView, number> };
  activeId?: string;
}) {
  const now = new Date();
  return (
    <section aria-label="Conversaciones" className="inbox__list">
      <header className="inbox-list__header">
        <div className="inbox-list__title-row">
          <h1 className="inbox-list__title">Conversaciones</h1>
          <div className="inbox-list__tools">
            <NotificationPermissionButton />
          </div>
        </div>
        {canRespond(access.role) ? <AvailabilitySwitch available={overview.available} /> : null}
        <form action="/inbox" className="inbox-list__search" method="get">
          <input name="vista" type="hidden" value={filters.view} />
          <input aria-label="Buscar por nombre o teléfono" className="ui-search-input" defaultValue={filters.query} name="q" placeholder="Nombre o teléfono" type="search" />
          <button className="ui-button ui-button--secondary inbox-quiet-button" type="submit">Buscar</button>
        </form>
        <div className="ui-segmented-scroll inbox-list__tabs">
          <div className="ui-segmented">
            {INBOX_VIEWS.map(([view, label]) => (
              <Link
                aria-current={view === filters.view ? "page" : undefined}
                className="ui-segmented__item"
                href={inboxHref({ vista: view, q: filters.query })}
                key={view}
              >
                {label}
                <span className="inbox-list__count">{overview.countByView[view] ?? 0}</span>
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div className="inbox-list__rows">
        {!overview.hasConnectedNumber ? (
          <div className="inbox-list__empty">
            <div>
              <h2>Conecta tu número de WhatsApp para recibir conversaciones</h2>
              <p>
                Mientras no haya un número conectado, nadie puede escribirte aquí.{" "}
                <Link href="/settings/whatsapp">Conectar número</Link>
              </p>
            </div>
          </div>
        ) : overview.totalInScope === 0 ? (
          <div className="inbox-list__empty">
            <div>
              <h2>Todavía nadie te ha escrito</h2>
              <p>En cuanto alguien escriba al número conectado, la conversación aparece aquí sola.</p>
            </div>
          </div>
        ) : list.rows.length === 0 ? (
          <div className="inbox-list__empty">
            <div>
              <h2>Nada en esta vista</h2>
              <p>{filters.query ? "Ninguna conversación coincide con lo que buscaste." : "Prueba con otra pestaña, por ejemplo «Todas»."}</p>
            </div>
          </div>
        ) : (
          list.rows.map((row) => <Row activeId={activeId} filters={filters} key={row.id} now={now} row={row} timezone={access.timezone} />)
        )}
      </div>

      {list.pageCount > 1 ? (
        <nav aria-label="Páginas" className="inbox-list__pagination">
          {list.page > 1 ? (
            <Link href={inboxHref({ vista: filters.view, q: filters.query, pagina: list.page - 1 })}>Anteriores</Link>
          ) : (
            <span>Anteriores</span>
          )}
          <span>
            {list.page} de {list.pageCount} · {list.total} en total
          </span>
          {list.page < list.pageCount ? (
            <Link href={inboxHref({ vista: filters.view, q: filters.query, pagina: list.page + 1 })}>Siguientes</Link>
          ) : (
            <span>Siguientes</span>
          )}
        </nav>
      ) : null}
    </section>
  );
}

function Row({
  row,
  filters,
  activeId,
  timezone,
  now,
}: {
  row: ConversationRow;
  filters: ListFiltersView;
  activeId?: string;
  timezone: string;
  now: Date;
}) {
  const responder = responderLabel(row.responderState, row.assignedName);
  const classes = ["inbox-row"];
  if (row.id === activeId) classes.push("inbox-row--active");
  if (row.unreadCount > 0) classes.push("inbox-row--unread");
  return (
    <Link className={classes.join(" ")} href={inboxHref({ vista: filters.view, q: filters.query }, row.id)}>
      <span className="inbox-row__avatar">{avatarInitial(row.contact.displayName)}</span>
      <span className="inbox-row__body">
        <span className="inbox-row__top">
          <span className="inbox-row__name">{contactTitle(row.contact)}</span>
          <span className="inbox-row__time">{listTimeLabel(row.lastMessageAt, timezone, now)}</span>
        </span>
        <span className="inbox-row__preview">{row.lastMessagePreview ?? "Sin mensajes todavía"}</span>
        <span className="inbox-row__bottom">
          <span className="inbox-row__badges">
            <StatusBadge tone={responder.tone}>{responder.label}</StatusBadge>
            {row.originAdId ? <StatusBadge tone="info">Anuncio</StatusBadge> : null}
            {row.status === "CLOSED" ? <StatusBadge tone="neutral">Cerrada</StatusBadge> : null}
          </span>
          {row.unreadCount > 0 ? <span className="inbox-row__unread">{row.unreadCount}</span> : null}
        </span>
      </span>
    </Link>
  );
}
