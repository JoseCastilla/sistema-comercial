import Link from "next/link";
import {
  getLimaIsoDate,
  recoveryAgeBuckets,
  recoveryAgendaGridHours,
  recoveryAgendaViewLabels,
  recoveryAgendaViews,
} from "@repo/validation";

import { AdvisorCampaignNav } from "@/features/recovery/components/advisor-campaign-nav";
import { CancelCommitmentForm } from "@/features/recovery/components/cancel-commitment-form";
import { QueueFilters } from "@/features/recovery/components/queue-filters";
import { RegisterAttemptForm } from "@/features/recovery/components/register-attempt-form";
import { RescheduleCommitmentForm } from "@/features/recovery/components/reschedule-commitment-form";
import {
  agendaBaseHref,
  agendaKindFilters,
  agendaStateFilters,
  commitmentPanelHref,
  getAgenda,
} from "@/features/recovery/server/get-agenda";
import { getAgendaCommitment } from "@/features/recovery/server/get-agenda-commitment";
import { requireCommercialAccess } from "@/server/auth/access";

import { formatCount } from "@repo/ui/format";
import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";
import { SectionPanel } from "@repo/ui/section-panel";

import type { AgendaEntry, AgendaQuery } from "@/features/recovery/server/get-agenda";
import type { RecoveryAgendaView } from "@repo/validation";

const weekdayFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

const longDayFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const stateTone: Record<AgendaEntry["state"], string> = {
  pendiente: "border-ui-border",
  vencida: "border-ui-danger bg-ui-danger-soft",
  atendida: "border-ui-border opacity-70",
  reprogramada: "border-ui-border opacity-70",
  cancelada: "border-ui-border opacity-70",
};

function agendaHref(
  query: AgendaQuery,
  overrides: Partial<{ view: RecoveryAgendaView; date: Date }>,
): string {
  const params = new URLSearchParams();
  const view = overrides.view ?? query.view;
  const date = overrides.date ?? query.date;
  if (view !== "semana") params.set("view", view);
  params.set("fecha", getLimaIsoDate(date));
  if (query.q) params.set("q", query.q);
  if (query.age) params.set("age", query.age);
  if (query.kind) params.set("tipo", query.kind);
  if (query.state) params.set("estado", query.state);

  return `/recovery/agenda?${params.toString()}`;
}

/**
 * Mi agenda — SPEC-048 fase 2 (CAM-F08). Semana, día y lista sobre los
 * compromisos y tareas del asesor autenticado, con los vencidos siempre a
 * la vista aunque su fecha quede fuera del período (BR-014).
 */
export default async function RecoveryAgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, membership } = await requireCommercialAccess();
  const parameters = await searchParams;
  const now = new Date();

  const agenda = await getAgenda(
    membership.organization.id,
    session.user.id,
    parameters,
    now,
  );
  const { query, period } = agenda;

  // CAM-F09: el panel de una cita se abre en la misma página (`cita=<id>`),
  // con el caso, su contexto y las acciones; el resto de la agenda sigue
  // debajo para no perder el sitio.
  const openCommitmentId = (parameters.cita ?? "").trim().slice(0, 40);
  const openCommitment = openCommitmentId
    ? await getAgendaCommitment(
        membership.organization.id,
        session.user.id,
        openCommitmentId,
        now,
      )
    : null;
  const closePanelHref = agendaBaseHref(query);

  const periodLabel =
    query.view === "dia"
      ? longDayFormatter.format(new Date(period.start.getTime() + 12 * 3600 * 1000))
      : `${weekdayFormatter.format(new Date(period.start.getTime() + 12 * 3600 * 1000))} → ${weekdayFormatter.format(new Date(period.end.getTime() - 12 * 3600 * 1000))}`;

  const entriesByDay = new Map<string, AgendaEntry[]>();
  for (const entry of agenda.periodEntries) {
    if (!entry.dayIso) continue;
    const list = entriesByDay.get(entry.dayIso) ?? [];
    list.push(entry);
    entriesByDay.set(entry.dayIso, list);
  }
  const gridHours = recoveryAgendaGridHours(
    agenda.periodEntries
      .filter((entry) => entry.timed && entry.hour !== null)
      .map((entry) => entry.hour as number),
  );

  return (
    <div className="ui-page-stack">
      <PageHeader
        eyebrow="Campañas"
        title="Mi agenda"
        description="Tus llamadas acordadas ocupan su hora; lo demás son tareas del día. Todo en hora de Lima."
      />

      <AdvisorCampaignNav current="agenda" />

      {openCommitmentId && !openCommitment ? (
        <SectionPanel
          title="Esta cita no está en tu agenda"
          description="No existe o el caso ya no está a tu cargo."
        >
          <Link
            className="text-ui-accent underline-offset-2 hover:underline"
            href={closePanelHref}
          >
            Cerrar
          </Link>
        </SectionPanel>
      ) : null}

      {openCommitment ? (
        <SectionPanel
          title={`Llamada acordada con ${openCommitment.holderName}`}
          description={`${openCommitment.scheduledAtLabel} · ${openCommitment.stateLabel} · caso ${openCommitment.caseStatusLabel.toLowerCase()}${
            openCommitment.phone ? ` · ${openCommitment.phone}` : ""
          }`}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 text-sm">
              <p className="flex flex-wrap gap-3">
                <Link
                  className="text-ui-accent underline-offset-2 hover:underline"
                  href={`/recovery/campaigns/${openCommitment.caseId}?from=agenda&cita=${openCommitment.id}&fecha=${getLimaIsoDate(query.date)}${query.view !== "semana" ? `&view=${query.view}` : ""}`}
                >
                  Abrir ficha del cliente
                </Link>
                <Link
                  className="text-ui-muted underline-offset-2 hover:underline"
                  href={closePanelHref}
                >
                  Cerrar el panel
                </Link>
                {openCommitment.supersededById ? (
                  <Link
                    className="text-ui-accent underline-offset-2 hover:underline"
                    href={commitmentPanelHref(openCommitment.supersededById, query)}
                  >
                    Ver la cita que la reemplazó
                  </Link>
                ) : null}
              </p>
              {openCommitment.reason ? (
                <p className="text-ui-muted">Motivo: {openCommitment.reason}</p>
              ) : null}

              <div>
                <p className="ui-label-eyebrow">Últimas gestiones</p>
                {openCommitment.attempts.length === 0 ? (
                  <p className="text-ui-muted">Sin gestión registrada.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {openCommitment.attempts.map((attempt) => (
                      <li key={attempt.id}>
                        <span className="font-medium text-ui-text">
                          {attempt.resultLabel}
                        </span>
                        <span className="ml-2 text-xs text-ui-muted">
                          {attempt.createdAtLabel} · {attempt.actorName}
                        </span>
                        {attempt.observation ? (
                          <span className="block text-xs text-ui-muted">
                            {attempt.observation}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="ui-label-eyebrow">Historial de la cita</p>
                <ul className="mt-1 space-y-1">
                  {openCommitment.history.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium text-ui-text">
                        {item.scheduledAtLabel}
                      </span>
                      <span className="ml-2 text-xs text-ui-muted">
                        {item.stateLabel} · acordada el {item.createdAtLabel} ·{" "}
                        {item.createdByName}
                        {item.closedAtLabel ? ` · cerrada el ${item.closedAtLabel}` : ""}
                      </span>
                      {item.reason ? (
                        <span className="block text-xs text-ui-muted">
                          {item.reason}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {openCommitment.isPending ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-ui-border p-3">
                  <p className="ui-label-eyebrow">Registrar el resultado de la llamada</p>
                  <p className="mb-2 text-xs text-ui-muted">
                    Atender la cita es registrar qué pasó; no existe «marcar como
                    hecha».
                  </p>
                  <RegisterAttemptForm
                    caseId={openCommitment.caseId}
                    returnTo={closePanelHref}
                  />
                </div>
                <div className="rounded-xl border border-ui-border p-3">
                  <p className="ui-label-eyebrow">Reprogramar</p>
                  <RescheduleCommitmentForm commitmentId={openCommitment.id} />
                </div>
                <div className="rounded-xl border border-ui-border p-3">
                  <p className="ui-label-eyebrow">Cancelar y definir qué sigue</p>
                  <CancelCommitmentForm commitmentId={openCommitment.id} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-ui-muted">
                Esta cita ya no está pendiente; se conserva como historial.
              </p>
            )}
          </div>
        </SectionPanel>
      ) : null}

      <MetricGroup>
        <Metric
          emphasis="hero"
          label="Llamadas acordadas en el período"
          value={agenda.counts.commitments}
        />
        <Metric label="Tareas en el período" value={agenda.counts.tasks} />
        <Metric
          hideWhenZero
          label="Llamadas vencidas"
          tone="danger"
          value={agenda.counts.overdue}
        />
        <Metric
          hideWhenZero
          href="/recovery/campaigns"
          label="Sin gestión aún"
          tone="warning"
          value={agenda.noDateCount}
        />
        <Metric
          hideWhenZero
          hint="Dos o más citas en el mismo tramo de 15 minutos; se avisa, no se mueve nada."
          label="A la misma hora"
          tone="warning"
          value={agenda.periodEntries.filter((entry) => entry.clash).length}
        />
      </MetricGroup>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Vista" className="ui-segmented-scroll">
          <div className="ui-segmented">
            {recoveryAgendaViews.map((view) => (
              <Link
                aria-current={view === query.view ? "page" : undefined}
                className="ui-segmented__item"
                href={agendaHref(query, { view })}
                key={view}
              >
                {recoveryAgendaViewLabels[view]}
              </Link>
            ))}
          </div>
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <Link
            className="ui-button ui-button--quiet"
            href={agendaHref(query, { date: period.previous })}
          >
            ← Anterior
          </Link>
          <Link
            className="ui-button ui-button--quiet"
            href={agendaHref(query, {
              date: new Date(`${agenda.todayIso}T00:00:00-05:00`),
            })}
          >
            Hoy
          </Link>
          <Link
            className="ui-button ui-button--quiet"
            href={agendaHref(query, { date: period.next })}
          >
            Siguiente →
          </Link>
          <span className="font-medium text-ui-text">{periodLabel}</span>
        </div>

        <form action="/recovery/agenda" className="flex items-end gap-2" method="get">
          {query.view !== "semana" ? (
            <input name="view" type="hidden" value={query.view} />
          ) : null}
          {query.q ? <input name="q" type="hidden" value={query.q} /> : null}
          {query.age ? <input name="age" type="hidden" value={query.age} /> : null}
          {query.kind ? <input name="tipo" type="hidden" value={query.kind} /> : null}
          {query.state ? (
            <input name="estado" type="hidden" value={query.state} />
          ) : null}
          <label className="block text-sm">
            <span className="ui-label-eyebrow">Elegir fecha</span>
            <input
              className="mt-1 block rounded-lg border border-ui-border-strong bg-ui-surface px-2 py-2 text-sm text-ui-text"
              defaultValue={getLimaIsoDate(query.date)}
              name="fecha"
              type="date"
            />
          </label>
          <button className="ui-button ui-button--quiet" type="submit">
            Ir
          </button>
        </form>
      </div>

      <QueueFilters
        basePath="/recovery/agenda"
        options={{
          ages: recoveryAgeBuckets,
          extras: [
            {
              key: "tipo",
              label: "Tipo",
              options: agendaKindFilters.map((filter) => ({
                value: filter.value,
                label: filter.label,
              })),
            },
            {
              key: "estado",
              label: "Estado",
              options: agendaStateFilters.map((filter) => ({
                value: filter.value,
                label: filter.label,
              })),
            },
          ],
        }}
        resultLabel={`${formatCount(agenda.periodEntries.length)} elemento(s) en el período.`}
        values={{
          q: query.q,
          view: query.view === "semana" ? undefined : query.view,
          team: "",
          department: "",
          plan: "",
          age: query.age ?? "",
          extra: {
            tipo: query.kind,
            estado: query.state,
            fecha: getLimaIsoDate(query.date),
          },
        }}
      />

      {agenda.overdueCommitments.length > 0 ? (
        <SectionPanel
          title="Compromisos vencidos"
          description="Llamadas acordadas cuya hora ya pasó. Siguen pendientes, con su fecha original, hasta que registres el resultado."
        >
          <EntryList entries={agenda.overdueCommitments} showDate />
        </SectionPanel>
      ) : null}

      {agenda.untimedDue.length > 0 ? (
        <SectionPanel
          title="Tareas del día sin hora acordada"
          description="Reintentos, seguimientos, habilitaciones y ventas por completar que tocan hoy o quedaron de días anteriores."
        >
          <EntryList entries={agenda.untimedDue} showDate />
        </SectionPanel>
      ) : null}

      <SectionPanel
        title={
          query.view === "lista"
            ? "Próximas acciones"
            : query.view === "dia"
              ? "El día"
              : "La semana"
        }
        description={
          query.view === "lista"
            ? "Siete días desde la fecha elegida, en orden."
            : "Las llamadas acordadas en su hora; las tareas sin hora, arriba de cada día."
        }
      >
        {agenda.periodEntries.length === 0 ? (
          <p className="text-sm text-ui-muted">
            Nada en este período.{" "}
            {query.kind || query.state || query.q || query.age
              ? "Prueba con menos filtros."
              : "Puedes agendar desde tu cola registrando «Agenda una próxima llamada»."}
          </p>
        ) : query.view === "lista" ? (
          <EntryList entries={agenda.periodEntries} showDate />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="ui-table">
              <thead>
                <tr>
                  <th className="w-16">Hora</th>
                  {period.days.map((day) => {
                    const iso = getLimaIsoDate(day);
                    return (
                      <th
                        className={iso === agenda.todayIso ? "text-ui-accent" : undefined}
                        key={iso}
                      >
                        <Link href={agendaHref(query, { view: "dia", date: day })}>
                          {weekdayFormatter.format(
                            new Date(day.getTime() + 12 * 3600 * 1000),
                          )}
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="align-top text-xs text-ui-muted">Sin hora</th>
                  {period.days.map((day) => {
                    const iso = getLimaIsoDate(day);
                    const items = (entriesByDay.get(iso) ?? []).filter(
                      (entry) => !entry.timed,
                    );
                    return (
                      <td className="align-top" key={iso}>
                        <EntryCards entries={items} />
                      </td>
                    );
                  })}
                </tr>
                {gridHours.map((hour) => (
                  <tr key={hour}>
                    <th className="align-top text-xs text-ui-muted">
                      {String(hour).padStart(2, "0")}:00
                    </th>
                    {period.days.map((day) => {
                      const iso = getLimaIsoDate(day);
                      const items = (entriesByDay.get(iso) ?? []).filter(
                        (entry) => entry.timed && entry.hour === hour,
                      );
                      return (
                        <td className="align-top" key={iso}>
                          <EntryCards entries={items} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      {agenda.verification.length > 0 ? (
        <SectionPanel
          title="Pendientes de verificación"
          description="Reportados como ya activos en Movistar. No ocupan horario ni exigen llamada mientras se verifica."
        >
          <EntryList entries={agenda.verification} />
        </SectionPanel>
      ) : null}
    </div>
  );
}

function EntryCards({ entries }: { entries: AgendaEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <ul className="space-y-1">
      {entries.map((entry) => (
        <li key={entry.key}>
          <Link
            className={`block rounded-lg border px-2 py-1 text-xs hover:bg-ui-surface-muted ${stateTone[entry.state]}`}
            href={entry.href}
            title={`${entry.kindLabel} · ${entry.originLabel}`}
          >
            {entry.timeLabel ? (
              <span className="font-medium">{entry.timeLabel} · </span>
            ) : null}
            <span className="font-medium text-ui-text">{entry.holderName}</span>
            <span className="block text-ui-muted">{entry.kindLabel}</span>
            {entry.clash ? (
              <span className="block text-ui-warning">⚠ a la misma hora</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EntryList({
  entries,
  showDate = false,
}: {
  entries: AgendaEntry[];
  showDate?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ui-border">
      <table className="ui-table">
        <thead>
          <tr>
            {showDate ? <th>Cuándo</th> : null}
            <th>Cliente</th>
            <th>Qué toca</th>
            <th>Estado</th>
            <th>Última tipificación</th>
            <th>Oportunidad</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.key}>
              {showDate ? (
                <td className="whitespace-nowrap">
                  {entry.atLabel ?? "—"}
                </td>
              ) : null}
              <td>
                <Link
                  className="font-medium text-ui-accent underline-offset-2 hover:underline"
                  href={entry.href}
                >
                  {entry.holderName}
                </Link>
                {entry.phone ? (
                  <span className="block text-xs text-ui-muted">{entry.phone}</span>
                ) : null}
              </td>
              <td>
                {entry.kindLabel}
                <span className="block text-xs text-ui-muted">
                  {entry.originLabel}
                </span>
              </td>
              <td
                className={
                  entry.state === "vencida" ? "text-ui-danger" : undefined
                }
              >
                {entry.stateLabel}
              </td>
              <td>
                {entry.lastResultLabel ?? "Sin gestión"}
                {entry.lastObservation ? (
                  <span className="block max-w-xs truncate text-xs text-ui-muted">
                    {entry.lastObservation}
                  </span>
                ) : null}
              </td>
              <td className="text-xs text-ui-muted">{entry.recencyLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
