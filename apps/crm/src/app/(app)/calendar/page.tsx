import Link from "next/link";

import { Metric, MetricGroup } from "@repo/ui/metric";
import { PageHeader } from "@repo/ui/page-header";

import { requireAccess } from "@/server/auth/access";
import { addDays, dayStartUtc, isDateIso, localDateIso, startOfWeekIso, weekdayOf } from "@/server/calendar/dates";
import { getAvailableSlots, listAppointments, type AppointmentWithContact } from "@/server/calendar/service";
import { canChangeAppointment, canSeeAppointment } from "@/server/calendar/visibility";

import { AppointmentCard } from "./appointment-card";
import type { SlotOption } from "./reschedule-form";
import { describeDay, DAY_SHORT } from "./status";

export const dynamic = "force-dynamic";

/** Cuántos días hacia adelante se ofrecen al mover una cita. */
const RESCHEDULE_DAYS = 14;

function slotOptions(slots: Awaited<ReturnType<typeof getAvailableSlots>>): SlotOption[] {
  return slots.map((slot) => {
    const free = slot.capacity - slot.booked;
    return { value: slot.startsAt.toISOString(), label: `${slot.label} · ${free === 1 ? "queda 1 cupo" : `quedan ${free} cupos`}` };
  });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; ver?: string }>;
}) {
  const access = await requireAccess();
  const params = await searchParams;
  const timeZone = access.timezone;
  const viewer = { userId: access.userId, role: access.role };
  const canChange = access.role !== "BACKOFFICE";

  const todayIso = localDateIso(new Date(), timeZone);
  const weekStart = startOfWeekIso(isDateIso(params.semana) ? params.semana : todayIso);
  const onlyMine = params.ver === "mias";

  const [weekRows, todayRows, slots] = await Promise.all([
    listAppointments({
      organizationId: access.organizationId,
      from: dayStartUtc(weekStart, timeZone),
      to: dayStartUtc(addDays(weekStart, 7), timeZone),
    }),
    listAppointments({
      organizationId: access.organizationId,
      from: dayStartUtc(todayIso, timeZone),
      to: dayStartUtc(addDays(todayIso, 1), timeZone),
    }),
    canChange ? getAvailableSlots({ organizationId: access.organizationId, days: RESCHEDULE_DAYS, onlyAvailable: true }) : Promise.resolve([]),
  ]);

  const freeSlots = slotOptions(slots);
  const inScope = (row: AppointmentWithContact) =>
    canSeeAppointment(viewer, row) && (!onlyMine || row.userId === access.userId);
  const visible = weekRows.filter(inScope);

  const days = Array.from({ length: 7 }, (_, offset) => {
    const iso = addDays(weekStart, offset);
    return {
      iso,
      weekday: weekdayOf(iso),
      isToday: iso === todayIso,
      items: visible.filter((row) => localDateIso(row.scheduledAt, timeZone) === iso),
    };
  });

  // Las reprogramadas se cuentan en su horario nuevo: sumar las dos sería contar la misma cita dos veces.
  const scheduled = visible.filter((row) => row.status !== "RESCHEDULED").length;
  const pendingToday = todayRows.filter((row) => inScope(row) && row.status === "PENDING").length;
  const noShow = visible.filter((row) => row.status === "NO_SHOW").length;

  const link = (semana: string, mine = onlyMine) => `/calendar?semana=${semana}${mine ? "&ver=mias" : ""}`;
  const weekLabel = `${describeDay(weekStart, weekdayOf(weekStart))} – ${describeDay(addDays(weekStart, 6), weekdayOf(addDays(weekStart, 6)))}`;
  const options: { href: string; label: string; current: boolean }[] = [
    { href: link(weekStart, false), label: access.role === "AGENT" ? "Mías y sin asignar" : "Todo el equipo", current: !onlyMine },
    { href: link(weekStart, true), label: "Solo mis citas", current: onlyMine },
  ];

  return (
    <div className="ui-page-stack">
      <PageHeader
        description={`Semana del ${weekLabel}. Las horas son de ${timeZone.replace("America/", "")}.`}
        eyebrow="CRM"
        meta={
          canChange ? (
            <Link className="ui-button ui-button--primary" href="/calendar/new">Agendar cita</Link>
          ) : (
            <span className="text-xs text-ui-muted">El back office consulta la agenda, no la cambia.</span>
          )
        }
        title="Calendario"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Semana" className="ui-segmented-scroll">
          <div className="ui-segmented">
            <Link className="ui-segmented__item" href={link(addDays(weekStart, -7))}>← Semana anterior</Link>
            <Link aria-current={weekStart === startOfWeekIso(todayIso) ? "page" : undefined} className="ui-segmented__item" href={link(startOfWeekIso(todayIso))}>Esta semana</Link>
            <Link className="ui-segmented__item" href={link(addDays(weekStart, 7))}>Semana siguiente →</Link>
          </div>
        </nav>
        <nav aria-label="Qué citas se muestran" className="ui-segmented-scroll">
          <div className="ui-segmented">
            {options.map((option) => (
              <Link key={option.label} aria-current={option.current ? "page" : undefined} className="ui-segmented__item" href={option.href}>{option.label}</Link>
            ))}
          </div>
        </nav>
      </div>

      <MetricGroup label="Cifras de la semana">
        <Metric emphasis="hero" hint="cuenta también las horas que ya pasaron" label="Por atender hoy" value={pendingToday} />
        <Metric hint="sin contar las que se movieron" label="Citas de la semana" value={scheduled} />
        <Metric hint="esta semana" label="No contestaron" tone={noShow > 0 ? "warning" : "neutral"} value={noShow} />
      </MetricGroup>

      {visible.length === 0 ? (
        <section className="ui-empty-state">
          <div>
            <h2 className="ui-empty-state__title">Ninguna cita esta semana</h2>
            <p className="ui-empty-state__description">
              {onlyMine
                ? "No tienes citas en esta semana. Mira las del equipo o agenda una nueva."
                : "Nadie tiene citas en esta semana. Agenda la primera desde una conversación o con el buscador de contactos."}
            </p>
            {canChange ? <Link className="ui-button ui-button--primary" href="/calendar/new">Agendar cita</Link> : null}
          </div>
        </section>
      ) : (
        <div className="grid gap-3 lg:grid-cols-7 lg:items-start">
          {days.map((day) => (
            // En móvil la agenda es una lista: los días sin citas no ocupan pantalla.
            <section key={day.iso} className={`grid gap-2 ${day.items.length === 0 ? "max-lg:hidden" : ""}`}>
              <header className="flex items-baseline justify-between gap-2 border-b border-ui-border pb-1">
                <h2 className="text-sm font-semibold capitalize">
                  {DAY_SHORT[day.weekday]} {Number(day.iso.split("-")[2])}
                  {day.isToday ? <span className="ml-1 text-xs font-normal text-ui-accent">hoy</span> : null}
                </h2>
                <span className="text-xs text-ui-muted">{day.items.length}</span>
              </header>
              {day.items.length === 0 ? (
                <p className="text-xs text-ui-muted">Sin citas</p>
              ) : (
                day.items.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    canChange={canChangeAppointment(viewer, appointment)}
                    slots={freeSlots}
                    timeZone={timeZone}
                  />
                ))
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
