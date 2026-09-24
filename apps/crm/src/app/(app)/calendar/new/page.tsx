import Link from "next/link";

import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import { ActionForm } from "@/components/forms/action-form";
import { formatTime } from "@/lib/time";
import { canManage, requireAccess } from "@/server/auth/access";
import { localDateIso, weekdayOf } from "@/server/calendar/dates";
import { getAvailableSlots, type Slot } from "@/server/calendar/service";
import { database } from "@/server/database";
import type { Prisma } from "@/generated/prisma/client";

import { scheduleAppointmentAction } from "../actions";
import { describeDay } from "../status";

export const dynamic = "force-dynamic";

/** Cuántos días adelante se ofrecen para agendar. */
const HORIZON_DAYS = 14;

interface Params {
  contactId?: string;
  conversationId?: string;
  opportunityId?: string;
  q?: string;
  fecha?: string;
}

function keep(params: Params, extra: Record<string, string>): string {
  const query = new URLSearchParams();
  if (params.conversationId) query.set("conversationId", params.conversationId);
  if (params.opportunityId) query.set("opportunityId", params.opportunityId);
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  return `/calendar/new?${query.toString()}`;
}

/** «lun 14 sep» a partir de la fecha de un horario. */
function dayTitle(dateIso: string): string {
  return describeDay(dateIso, weekdayOf(dateIso));
}

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<Params> }) {
  const access = await requireAccess();
  const params = await searchParams;
  const timeZone = access.timezone;

  if (access.role === "BACKOFFICE") {
    return (
      <div className="ui-page-stack">
        <PageHeader eyebrow="Calendario" title="Agendar cita" />
        <section className="ui-empty-state">
          <div>
            <h2 className="ui-empty-state__title">Tu cuenta no agenda citas</h2>
            <p className="ui-empty-state__description">El back office consulta la agenda; agendar y cerrar citas es de asesores y supervisión.</p>
            <Link className="ui-button ui-button--secondary" href="/calendar">Volver al calendario</Link>
          </div>
        </section>
      </div>
    );
  }

  const rules = await database.bookingRule.count({ where: { organizationId: access.organizationId } });
  if (rules === 0) {
    return (
      <div className="ui-page-stack">
        <PageHeader eyebrow="Calendario" title="Agendar cita" />
        <section className="ui-empty-state">
          <div>
            <h2 className="ui-empty-state__title">Todavía no hay horarios que ofrecer</h2>
            <p className="ui-empty-state__description">Define primero las franjas y cupos en Ajustes → Cupos de citas.</p>
            {canManage(access.role) ? (
              <Link className="ui-button ui-button--primary" href="/settings/booking">Ir a Cupos de citas</Link>
            ) : (
              <p className="ui-empty-state__description">Pídeselo a tu supervisor: mientras no existan franjas, nadie puede reservar una hora.</p>
            )}
          </div>
        </section>
      </div>
    );
  }

  const contact = params.contactId
    ? await database.contact.findFirst({
        where: { id: params.contactId, organizationId: access.organizationId },
        select: { id: true, displayName: true, phone: true, documentNumber: true, district: true },
      })
    : null;

  // ── Sin contacto: buscarlo por nombre, teléfono o DNI ────────────────────
  if (!contact) {
    const term = (params.q ?? "").trim();
    const digits = term.replace(/\D/g, "");
    const filters: Prisma.ContactWhereInput[] = [{ displayName: { contains: term, mode: "insensitive" } }];
    if (digits.length >= 3) {
      filters.push({ phone: { contains: digits } }, { documentNumber: { contains: digits } });
    }
    const matches = term.length >= 2
      ? await database.contact.findMany({
          where: { organizationId: access.organizationId, OR: filters },
          select: { id: true, displayName: true, phone: true, documentNumber: true, district: true },
          orderBy: [{ lastInboundAt: "desc" }, { createdAt: "desc" }],
          take: 20,
        })
      : [];

    return (
      <div className="ui-page-stack">
        <PageHeader
          description="Primero elige con quién es la cita."
          eyebrow="Calendario"
          meta={<Link className="ui-button ui-button--quiet" href="/calendar">Volver al calendario</Link>}
          title="Agendar cita"
        />
        <SectionPanel title="Buscar contacto" description="Escribe el nombre, el teléfono o el DNI.">
          <form action="/calendar/new" className="ui-form-row" method="get">
            {params.conversationId ? <input name="conversationId" type="hidden" value={params.conversationId} /> : null}
            {params.opportunityId ? <input name="opportunityId" type="hidden" value={params.opportunityId} /> : null}
            <label className="ui-field ui-form-row__grow">
              <span className="ui-field__label">Nombre, teléfono o DNI</span>
              <input className="ui-control" defaultValue={term} minLength={2} name="q" placeholder="Ana Torres, 51987…, 4567…" required />
            </label>
            <button className="ui-button ui-button--primary" type="submit">Buscar</button>
          </form>
          {term.length >= 2 ? (
            matches.length === 0 ? (
              <p className="ui-feedback" data-tone="warning">Ningún contacto coincide con «{term}». Los contactos se crean cuando escriben por WhatsApp o al registrar un pedido.</p>
            ) : (
              <ul className="grid gap-2">
                {matches.map((match) => (
                  <li key={match.id}>
                    <Link className="ui-surface ui-surface--padded flex flex-wrap items-center justify-between gap-2" href={keep(params, { contactId: match.id })}>
                      <span>
                        <span className="font-medium">{match.displayName?.trim() || match.phone || "Sin nombre"}</span>
                        <span className="block text-xs text-ui-muted">
                          {match.phone ?? "Sin teléfono"}
                          {match.documentNumber ? ` · DNI ${match.documentNumber}` : ""}
                          {match.district ? ` · ${match.district}` : ""}
                        </span>
                      </span>
                      <span className="text-sm font-medium text-ui-accent">Agendar</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </SectionPanel>
      </div>
    );
  }

  // ── Con contacto: elegir día, horario y responsable ──────────────────────
  const slots = await getAvailableSlots({ organizationId: access.organizationId, days: HORIZON_DAYS });
  const byDay = new Map<string, Slot[]>();
  for (const slot of slots) {
    const iso = localDateIso(slot.startsAt, timeZone);
    const bucket = byDay.get(iso);
    if (bucket) bucket.push(slot);
    else byDay.set(iso, [slot]);
  }
  const dayKeys = [...byDay.keys()];
  const selectedDay = params.fecha && byDay.has(params.fecha) ? params.fecha : dayKeys[0];
  const daySlots = selectedDay ? byDay.get(selectedDay) ?? [] : [];
  const firstFree = daySlots.find((slot) => slot.available);
  const defaultDuration = daySlots[0] ? Math.round((daySlots[0].endsAt.getTime() - daySlots[0].startsAt.getTime()) / 60_000) : 30;

  const members = canManage(access.role)
    ? await database.organizationMember.findMany({
        where: { organizationId: access.organizationId, role: { in: ["OWNER", "SUPERVISOR", "AGENT"] }, user: { status: "ACTIVE" } },
        select: { userId: true, user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const contactLabel = contact.displayName?.trim() || contact.phone || "Sin nombre";

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={`Con ${contactLabel}${contact.phone ? ` (${contact.phone})` : ""}. Las horas son de ${timeZone.replace("America/", "")}.`}
        eyebrow="Calendario"
        meta={
          <span className="flex flex-wrap gap-2">
            <Link className="ui-button ui-button--quiet" href={keep(params, { q: contactLabel })}>Cambiar de contacto</Link>
            <Link className="ui-button ui-button--quiet" href="/calendar">Volver al calendario</Link>
          </span>
        }
        title="Agendar cita"
      />

      {dayKeys.length === 0 ? (
        <section className="ui-empty-state">
          <div>
            <h2 className="ui-empty-state__title">No queda ningún horario en los próximos {HORIZON_DAYS} días</h2>
            <p className="ui-empty-state__description">Las franjas configuradas ya pasaron o no alcanzan hasta aquí. Amplíalas en Ajustes → Cupos de citas.</p>
            {canManage(access.role) ? <Link className="ui-button ui-button--primary" href="/settings/booking">Ir a Cupos de citas</Link> : null}
          </div>
        </section>
      ) : (
        <>
          <nav aria-label="Día de la cita" className="ui-segmented-scroll">
            <div className="ui-segmented">
              {dayKeys.map((iso) => (
                <Link
                  key={iso}
                  aria-current={iso === selectedDay ? "page" : undefined}
                  className="ui-segmented__item"
                  href={keep(params, { contactId: contact.id, fecha: iso })}
                >
                  {dayTitle(iso)}
                </Link>
              ))}
            </div>
          </nav>

          <SectionPanel
            title={selectedDay ? `Horarios del ${dayTitle(selectedDay)}` : "Horarios"}
            description="Cada horario muestra cuántas citas caben y cuántas ya están tomadas."
          >
            <ActionForm action={scheduleAppointmentAction} pendingLabel="Agendando…" submitLabel="Agendar cita">
              <input name="contactId" type="hidden" value={contact.id} />
              {params.conversationId ? <input name="conversationId" type="hidden" value={params.conversationId} /> : null}
              {params.opportunityId ? <input name="opportunityId" type="hidden" value={params.opportunityId} /> : null}

              <fieldset className="ui-field">
                <span className="ui-field__label">Horario</span>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {daySlots.map((slot) => {
                    const iso = slot.startsAt.toISOString();
                    return (
                      <label key={iso} className="flex items-center gap-2 text-sm">
                        <input defaultChecked={firstFree ? iso === firstFree.startsAt.toISOString() : false} name="scheduledAt" required type="radio" value={iso} />
                        <span>
                          {formatTime(slot.startsAt, timeZone)}
                          <span className="block text-xs text-ui-muted">
                            {slot.booked} de {slot.capacity} cupos{slot.available ? "" : " · lleno"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="ui-form-row">
                <label className="ui-field ui-form-row__fixed">
                  <span className="ui-field__label">Duración (minutos)</span>
                  <input className="ui-control" defaultValue={defaultDuration} max={240} min={5} name="durationMinutes" step={5} type="number" />
                </label>
                {canManage(access.role) ? (
                  <label className="ui-field ui-form-row__grow">
                    <span className="ui-field__label">Responsable</span>
                    <select className="ui-control ui-control--select" defaultValue={access.userId} name="userId">
                      <option value="">Sin responsable (la toma cualquier asesor)</option>
                      {members.map((member) => (
                        <option key={member.userId} value={member.userId}>{member.user.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="ui-field ui-form-row__grow text-sm text-ui-muted">La cita queda a tu nombre: la atiendes tú.</p>
                )}
              </div>

              <label className="ui-field">
                <span className="ui-field__label">Notas (opcional)</span>
                <textarea className="ui-control" maxLength={500} name="notes" placeholder="Qué se va a tratar, qué documento falta…" rows={2} />
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input name="force" type="checkbox" />
                <span>Agendar aunque el horario esté lleno. Habrá más citas que cupos a esa hora y alguien tendrá que esperar.</span>
              </label>
            </ActionForm>
          </SectionPanel>
        </>
      )}
    </div>
  );
}
