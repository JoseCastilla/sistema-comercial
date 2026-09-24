"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAccess, type Access } from "@/server/auth/access";
import { localDateIso } from "@/server/calendar/dates";
import { createAppointment, rescheduleAppointment, setAppointmentStatus, SlotUnavailableError } from "@/server/calendar/service";
import { canChangeAppointment } from "@/server/calendar/visibility";
import { database } from "@/server/database";
import { checkbox, failure, integer, optionalText, text, type ActionState } from "@/server/forms";

/** El back office consulta el calendario; agendar y cerrar citas es de asesores y supervisores. */
async function requireScheduler(): Promise<Access> {
  const access = await requireAccess();
  if (access.role === "BACKOFFICE") throw new Error("El back office consulta el calendario, pero no agenda ni cambia citas.");
  return access;
}

/** Un asesor solo cambia sus citas o las que aún no tienen responsable. */
async function assertCanChange(access: Access, appointmentId: string): Promise<void> {
  if (!appointmentId) throw new Error("Falta la cita.");
  const appointment = await database.appointment.findFirst({ where: { id: appointmentId, organizationId: access.organizationId }, select: { userId: true } });
  if (!appointment) throw new Error("La cita no existe.");
  if (!canChangeAppointment({ userId: access.userId, role: access.role }, appointment)) {
    throw new Error("Esta cita es de otro asesor: solo puedes cambiar las tuyas o las que no tienen responsable.");
  }
}

function instant(formData: FormData, name: string): Date {
  const value = text(formData, name);
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Elige un horario.");
  return date;
}

function slotFailure(error: unknown, hint: string): ActionState {
  if (error instanceof SlotUnavailableError) return { ok: false, error: `${error.message} ${hint}` };
  return failure(error);
}

export async function scheduleAppointmentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let week: string;
  try {
    const access = await requireScheduler();
    const contactId = text(formData, "contactId");
    if (!contactId) throw new Error("Elige un contacto.");
    const scheduledAt = instant(formData, "scheduledAt");
    const userId = access.role === "AGENT" ? access.userId : optionalText(formData, "userId");
    const durationMinutes = Math.min(240, Math.max(5, integer(formData, "durationMinutes", 30)));
    const { appointment } = await createAppointment({
      organizationId: access.organizationId,
      contactId,
      scheduledAt,
      durationMinutes,
      userId,
      opportunityId: optionalText(formData, "opportunityId"),
      conversationId: optionalText(formData, "conversationId"),
      notes: optionalText(formData, "notes"),
      createdByKind: "USER",
      createdByUserId: access.userId,
      force: checkbox(formData, "force"),
    });
    week = localDateIso(appointment.scheduledAt, access.timezone);
  } catch (error) {
    return slotFailure(error, "Elige otro horario o marca la casilla para agendar igual.");
  }
  revalidatePath("/calendar");
  redirect(`/calendar?semana=${week}`);
}

export async function rescheduleAppointmentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let week: string;
  try {
    const access = await requireScheduler();
    const appointmentId = text(formData, "appointmentId");
    await assertCanChange(access, appointmentId);
    const replacement = await rescheduleAppointment({
      organizationId: access.organizationId,
      appointmentId,
      scheduledAt: instant(formData, "scheduledAt"),
      actorUserId: access.userId,
      reason: text(formData, "reason"),
      createdByKind: "USER",
    });
    week = localDateIso(replacement.scheduledAt, access.timezone);
  } catch (error) {
    return slotFailure(error, "Elige otro horario con cupo.");
  }
  revalidatePath("/calendar");
  redirect(`/calendar?semana=${week}`);
}

const OUTCOMES = {
  DONE: "Cita marcada como atendida.",
  NO_SHOW: "Registrado: el contacto no contestó.",
  CANCELLED: "Cita cancelada: el contacto ya no tiene hora reservada.",
} as const;

export async function recordOutcomeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireScheduler();
    const status = text(formData, "status") as keyof typeof OUTCOMES;
    if (!(status in OUTCOMES)) throw new Error("Resultado inválido.");
    const appointmentId = text(formData, "appointmentId");
    await assertCanChange(access, appointmentId);
    await setAppointmentStatus({
      organizationId: access.organizationId,
      appointmentId,
      status,
      actorUserId: access.userId,
      notes: optionalText(formData, "notes"),
    });
    revalidatePath("/calendar");
    return { ok: true, message: OUTCOMES[status] };
  } catch (error) {
    return failure(error);
  }
}
