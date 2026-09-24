import Link from "next/link";

import { StatusBadge } from "@repo/ui/status-badge";

import { formatTime } from "@/lib/time";
import type { AppointmentWithContact } from "@/server/calendar/service";

import { OutcomeForm } from "./outcome-form";
import { RescheduleForm, type SlotOption } from "./reschedule-form";
import { contactName, STATUS_LABEL, STATUS_TONE } from "./status";

/**
 * Una cita en la agenda: hora, con quién es, quién la atiende y en qué quedó.
 * Los botones solo aparecen mientras la cita sigue pendiente y quien mira
 * puede cambiarla (el back office consulta; el asesor toca las suyas).
 */
export function AppointmentCard({
  appointment,
  timeZone,
  canChange,
  slots,
}: {
  appointment: AppointmentWithContact;
  timeZone: string;
  canChange: boolean;
  slots: SlotOption[];
}) {
  const name = contactName(appointment.contact);
  const open = appointment.status === "PENDING" && canChange;
  return (
    <article className="ui-surface ui-surface--padded grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold">{formatTime(appointment.scheduledAt, timeZone)}</p>
        <StatusBadge tone={STATUS_TONE[appointment.status]}>{STATUS_LABEL[appointment.status]}</StatusBadge>
      </div>
      <div className="min-w-0">
        {appointment.conversationId ? (
          <Link className="font-medium underline" href={`/inbox/${appointment.conversationId}`}>{name}</Link>
        ) : (
          <p className="font-medium">{name}</p>
        )}
        <p className="text-xs text-ui-muted">
          {appointment.contact.phone ?? "Sin teléfono"} · {appointment.durationMinutes} min
        </p>
      </div>
      <p className="text-xs text-ui-muted">
        {appointment.user ? `Atiende ${appointment.user.name}` : "Sin responsable: la puede tomar cualquier asesor"}
      </p>
      {appointment.notes ? <p className="text-xs whitespace-pre-line">{appointment.notes}</p> : null}
      {appointment.status === "RESCHEDULED" ? <p className="text-xs text-ui-muted">Se movió a otro horario.</p> : null}
      {open ? (
        <>
          <OutcomeForm appointmentId={appointment.id} />
          <RescheduleForm appointmentId={appointment.id} slots={slots} />
        </>
      ) : null}
    </article>
  );
}
