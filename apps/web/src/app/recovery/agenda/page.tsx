import Link from "next/link";
import {
  getLimaIsoDate,
  recoveryAgendaViewLabels,
  recoveryAgendaViews,
  summarizeRecoveryAgendaByDay,
} from "@repo/validation";

import { Button } from "@/components/ui/button";
import { AdvisorCampaignNav } from "@/features/recovery/components/advisor-campaign-nav";
import { AgendaCommitmentList } from "@/features/recovery/components/agenda-commitment-list";
import { AgendaDateJump } from "@/features/recovery/components/agenda-date-jump";
import { CampaignDraftProvider } from "@/features/recovery/components/campaign-draft-context";
import { QueueFilters } from "@/features/recovery/components/queue-filters";
import {
  agendaHref,
  agendaStateFilters,
  getAgenda,
} from "@/features/recovery/server/get-agenda";
import { requireCommercialAccess } from "@/server/auth/access";

import { formatCount, formatLimaMonth } from "@repo/ui/format";
import { PageHeader } from "@repo/ui/page-header";

const dayHeadingFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});

const noon = (day: Date) => new Date(day.getTime() + 12 * 3600 * 1000);

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Mi agenda — SPEC-048 y SPEC-066. Solo las llamadas que el asesor acordó con
 * sus clientes, de campaña y de ventas caídas: las tareas automáticas viven
 * en la cola y en «Mi día». «Próximas» es una lista por día que cabe en el
 * celular; «Mes» sirve para planear. Las vencidas se ven siempre arriba.
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
  const { query, period, todayIso } = agenda;
  const tomorrowIso = getLimaIsoDate(
    new Date(new Date(`${todayIso}T12:00:00-05:00`).getTime() + 24 * 3600 * 1000),
  );

  function dayHeading(iso: string, day: Date): string {
    const label = dayHeadingFormatter.format(noon(day));
    if (iso === todayIso) return `Hoy · ${label}`;
    if (iso === tomorrowIso) return `Mañana · ${label}`;
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const periodLabel =
    query.view === "mes" && period.monthStart
      ? formatLimaMonth(noon(period.monthStart))
      : `${dayHeadingFormatter.format(noon(period.days[0] as Date))} al ${dayHeadingFormatter.format(noon(period.days.at(-1) as Date))}`;

  // Las vencidas van en su grupo, arriba; los días muestran el resto.
  const upcoming = agenda.periodEntries.filter(
    (entry) => entry.state !== "vencida",
  );
  const days = period.days
    .map((day) => {
      const iso = getLimaIsoDate(day);
      return {
        iso,
        day,
        entries: upcoming.filter((entry) => entry.dayIso === iso),
      };
    })
    .filter((group) => group.entries.length > 0);

  const livePeriod = agenda.periodEntries.filter((entry) => entry.isPending);
  const summaryLine = [
    `${plural(livePeriod.length, "llamada acordada", "llamadas acordadas")} ${
      query.view === "mes" ? "este mes" : "en estos 14 días"
    }`,
    agenda.overdue.length > 0
      ? plural(agenda.overdue.length, "vencida", "vencidas")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const monthSummary = summarizeRecoveryAgendaByDay(
    agenda.periodEntries.map((entry) => ({
      dayIso: entry.dayIso,
      timed: true,
      overdue: entry.state === "vencida",
    })),
  );
  const monthWeeks: Date[][] = [];
  if (query.view === "mes") {
    for (let index = 0; index < period.days.length; index += 7) {
      monthWeeks.push(period.days.slice(index, index + 7));
    }
  }

  const baseQuery = new URLSearchParams();
  if (query.view !== "proximas") baseQuery.set("view", query.view);
  if (query.q) baseQuery.set("q", query.q);
  if (query.state) baseQuery.set("estado", query.state);

  const openCommitmentId = agenda.commitmentFound ? query.commitmentId : "";
  const hasFilters = Boolean(query.q || query.state);

  return (
    <div className="ui-page-stack">
      {/* Sin subtítulo (SPEC-066 BR-011): la línea de cifras dice lo que hay. */}
      <PageHeader eyebrow="Campañas" title="Mi agenda" />

      <AdvisorCampaignNav current="agenda" />

      {query.commitmentId && !agenda.commitmentFound ? (
        <p
          className="rounded-lg border border-ui-border bg-ui-surface px-4 py-3 text-sm text-ui-muted"
          role="status"
        >
          Esa cita no está en tu agenda: no existe o el caso ya no está a tu
          cargo.
        </p>
      ) : null}

      {/* BR-012 y BR-013: dos vistas, flechas compactas y la fecha sin «Ir». */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link
              aria-label="Período anterior"
              href={agendaHref(query, { date: period.previous })}
            >
              ‹
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              href={agendaHref(query, {
                date: new Date(`${todayIso}T00:00:00-05:00`),
              })}
            >
              Hoy
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link
              aria-label="Período siguiente"
              href={agendaHref(query, { date: period.next })}
            >
              ›
            </Link>
          </Button>
        </div>
        <span className="text-sm font-medium text-ui-text">{periodLabel}</span>
        <AgendaDateJump
          baseQuery={baseQuery.toString()}
          value={getLimaIsoDate(query.date)}
        />
      </div>

      <QueueFilters
        basePath="/recovery/agenda"
        options={{
          extras: [
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
        resultLabel={summaryLine}
        values={{
          q: query.q,
          view: query.view === "proximas" ? undefined : query.view,
          team: "",
          department: "",
          plan: "",
          extra: {
            estado: query.state,
            fecha: getLimaIsoDate(query.date),
          },
        }}
      />

      <CampaignDraftProvider>
        {/* SPEC-048 BR-014: las vencidas siempre a la vista, con su fecha. */}
        {agenda.overdue.length > 0 ? (
          <section aria-labelledby="agenda-vencidas" className="grid gap-2">
            <h2
              className="flex items-baseline gap-2 text-sm font-semibold text-ui-danger"
              id="agenda-vencidas"
            >
              Vencidas
              <span className="text-xs font-medium">
                {formatCount(agenda.overdue.length)}
              </span>
            </h2>
            <AgendaCommitmentList
              entries={agenda.overdue}
              openCommitmentId={openCommitmentId}
              showDate
            />
          </section>
        ) : null}

        {query.view === "mes" ? (
          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="ui-table">
              <thead>
                <tr>
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(
                    (label) => (
                      <th key={label}>{label}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {monthWeeks.map((week) => (
                  <tr key={getLimaIsoDate(week[0] as Date)}>
                    {week.map((day) => {
                      const iso = getLimaIsoDate(day);
                      const inMonth =
                        period.monthStart !== undefined &&
                        period.monthEnd !== undefined &&
                        day.getTime() >= period.monthStart.getTime() &&
                        day.getTime() < period.monthEnd.getTime();
                      const summary = monthSummary[iso];
                      return (
                        <td
                          className={`align-top ${inMonth ? "" : "opacity-50"}`}
                          key={iso}
                        >
                          <Link
                            className={`block rounded-lg px-1 py-1 text-xs hover:bg-ui-surface-muted ${
                              iso === todayIso
                                ? "font-semibold text-ui-accent"
                                : "text-ui-text"
                            }`}
                            href={agendaHref(query, {
                              view: "proximas",
                              date: day,
                            })}
                          >
                            <span className="block">
                              {Number(iso.slice(8, 10))}
                            </span>
                            {summary && summary.commitments > 0 ? (
                              <span
                                className={`block ${
                                  summary.overdue > 0 ? "text-ui-danger" : ""
                                }`}
                              >
                                <span className="sm:hidden">
                                  {summary.commitments}
                                </span>
                                <span className="hidden sm:inline">
                                  {plural(summary.commitments, "llamada", "llamadas")}
                                  {summary.overdue > 0
                                    ? ` · ${plural(summary.overdue, "vencida", "vencidas")}`
                                    : ""}
                                </span>
                              </span>
                            ) : null}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : days.length > 0 ? (
          days.map((group) => (
            <section
              aria-labelledby={`agenda-${group.iso}`}
              className="grid gap-2"
              key={group.iso}
            >
              <h2
                className="flex items-baseline gap-2 text-sm font-semibold text-ui-text"
                id={`agenda-${group.iso}`}
              >
                {dayHeading(group.iso, group.day)}
                <span className="text-xs font-medium text-ui-soft">
                  {formatCount(group.entries.length)}
                </span>
              </h2>
              <AgendaCommitmentList
                entries={group.entries}
                openCommitmentId={openCommitmentId}
              />
            </section>
          ))
        ) : (
          // BR-008: sin citas, una línea que dice cómo agendar; no una
          // cuadrícula vacía.
          <p className="rounded-lg border border-ui-border bg-ui-surface px-4 py-6 text-center text-sm text-ui-muted">
            {hasFilters
              ? "Ninguna llamada acordada coincide con lo que buscas."
              : "No tienes llamadas acordadas en estos días. Para agendar una, registra «Agenda una próxima llamada» al gestionar un cliente en Mi día o en tu cola."}
          </p>
        )}
      </CampaignDraftProvider>
    </div>
  );
}
