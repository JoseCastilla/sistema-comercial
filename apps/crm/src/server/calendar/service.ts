import "server-only";

import type { Appointment } from "@/generated/prisma/client";
import { addMinutes } from "@/lib/time";
import { audit } from "@/server/audit";
import { database } from "@/server/database";
import { publishEvent } from "@/server/events/bus";

import { addDays, dayStartUtc, localDateIso } from "./dates";
import { findSlot, generateSlots, type Slot, type SlotBooking, type SlotRule } from "./slots";

/**
 * Servicio de citas y disponibilidad (SPEC-048 como agenda; SPEC-058 BR-022
 * para cupos). Lo usan la interfaz de `/calendar`, el agente de IA y los
 * flujos. Toda función filtra por `organizationId`.
 *
 * Reglas:
 * - Los horarios salen de `BookingRule` (día de semana en la zona de la
 *   organización, «HH:MM», minutos por cita, cupo). Un horario tiene cupo
 *   mientras las citas PENDING que empiezan en él sean menos que `capacity`.
 *   Sin franjas no hay horarios.
 * - Nunca se ofrecen horarios que ya empezaron.
 * - Las citas no se editan: reprogramar crea una nueva y deja la original en
 *   RESCHEDULED apuntando a ella (`supersededById`). Cerrar una cita solo
 *   cambia su estado y añade notas.
 * - Cada alta publica `appointment.created` en el bus (el módulo de flujos
 *   programa recordatorios a partir de ahí) y deja rastro en `audit_logs`.
 */

export type { Slot } from "./slots";

export type CreatedByKind = "USER" | "AGENT_AI" | "WORKFLOW";

export type AppointmentWithContact = Appointment & {
  contact: { id: string; displayName: string | null; phone: string | null; documentNumber: string | null };
  /** Responsable de la cita, resuelto desde la membresía; nulo si está sin asignar. */
  user: { id: string; name: string } | null;
};

/** El horario pedido no existe dentro de las franjas, ya pasó o no tiene cupo. */
export class SlotUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

const APPOINTMENT_SELECT = {
  id: true,
  organizationId: true,
  contactId: true,
  opportunityId: true,
  conversationId: true,
  userId: true,
  scheduledAt: true,
  durationMinutes: true,
  status: true,
  notes: true,
  createdByKind: true,
  createdByUserId: true,
  supersededById: true,
  clientRequestId: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function loadTimezone(organizationId: string): Promise<string> {
  const organization = await database.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } });
  return organization.timezone;
}

async function loadRules(organizationId: string): Promise<SlotRule[]> {
  return database.bookingRule.findMany({
    where: { organizationId },
    select: { weekday: true, startTime: true, endTime: true, slotMinutes: true, capacity: true },
  });
}

/** Citas PENDING que empiezan en el rango [from, to). */
async function loadPendingBetween(organizationId: string, from: Date, to: Date): Promise<SlotBooking[]> {
  return database.appointment.findMany({
    where: { organizationId, status: "PENDING", scheduledAt: { gte: from, lt: to } },
    select: { scheduledAt: true, status: true },
  });
}

/**
 * Horarios de los próximos `days` días locales a partir de `from` (por defecto
 * ahora y 7 días). Con `onlyAvailable` devuelve solo los que tienen cupo.
 * Sin franjas configuradas devuelve `[]`.
 */
export async function getAvailableSlots(input: { organizationId: string; from?: Date; days?: number; onlyAvailable?: boolean }): Promise<Slot[]> {
  const now = new Date();
  const from = input.from ?? now;
  const days = Math.max(1, Math.floor(input.days ?? 7));
  const [timeZone, rules] = await Promise.all([loadTimezone(input.organizationId), loadRules(input.organizationId)]);
  if (rules.length === 0) return [];
  const firstDay = localDateIso(from, timeZone);
  const bookings = await loadPendingBetween(
    input.organizationId,
    dayStartUtc(firstDay, timeZone),
    dayStartUtc(addDays(firstDay, days + 1), timeZone),
  );
  return generateSlots({ rules, bookings, now, from, days, timeZone, onlyAvailable: input.onlyAvailable });
}

/** El horario en que empieza `at`, con su cupo actual, o null si no existe o ya pasó. */
async function resolveSlot(organizationId: string, at: Date, timeZone: string, now: Date): Promise<Slot | null> {
  const rules = await loadRules(organizationId);
  if (rules.length === 0) return null;
  const day = localDateIso(at, timeZone);
  const bookings = await loadPendingBetween(organizationId, dayStartUtc(day, timeZone), dayStartUtc(addDays(day, 2), timeZone));
  return findSlot({ rules, bookings, now, at, timeZone });
}

function unavailableMessage(slot: Slot | null, at: Date, now: Date): string {
  if (slot) return `El horario ${slot.label} ya no tiene cupo (${slot.booked} de ${slot.capacity}).`;
  if (at.getTime() <= now.getTime()) return "Ese horario ya pasó.";
  return "Ese horario no está dentro de las franjas de atención.";
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

/**
 * Crea una cita en un horario con cupo.
 * - Idempotente por `clientRequestId`: si ya existe devuelve la misma con `created: false`.
 * - Si el horario no existe, ya pasó o está lleno lanza `SlotUnavailableError`,
 *   salvo `force: true` (solo lo usan asesores desde la interfaz, con aviso).
 * - Si `userId` viene vacío y hay `conversationId`, hereda el asesor asignado a la conversación.
 * - `durationMinutes` por defecto: la duración del horario, o 30 si se fuerza fuera de franja.
 */
export async function createAppointment(input: {
  organizationId: string;
  contactId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  userId?: string | null;
  opportunityId?: string | null;
  conversationId?: string | null;
  notes?: string | null;
  createdByKind: CreatedByKind;
  createdByUserId?: string | null;
  clientRequestId?: string | null;
  force?: boolean;
}): Promise<{ appointment: Appointment; created: boolean }> {
  const { organizationId } = input;
  const clientRequestId = input.clientRequestId?.trim() || null;
  if (clientRequestId) {
    const existing = await database.appointment.findUnique({
      where: { organizationId_clientRequestId: { organizationId, clientRequestId } },
      select: APPOINTMENT_SELECT,
    });
    if (existing) return { appointment: existing, created: false };
  }
  if (Number.isNaN(input.scheduledAt.getTime())) throw new Error("La fecha y hora de la cita no es válida.");

  const contact = await database.contact.findFirst({ where: { id: input.contactId, organizationId }, select: { id: true } });
  if (!contact) throw new Error("El contacto no existe en esta empresa.");

  let userId = input.userId ?? null;
  const conversationId = input.conversationId ?? null;
  if (conversationId) {
    const conversation = await database.conversation.findFirst({ where: { id: conversationId, organizationId }, select: { assignedUserId: true } });
    if (!conversation) throw new Error("La conversación no existe en esta empresa.");
    if (!userId) userId = conversation.assignedUserId;
  }
  const opportunityId = input.opportunityId ?? null;
  if (opportunityId) {
    const opportunity = await database.opportunity.findFirst({ where: { id: opportunityId, organizationId }, select: { id: true } });
    if (!opportunity) throw new Error("La oportunidad no existe en esta empresa.");
  }
  if (userId) {
    const member = await database.organizationMember.findFirst({ where: { organizationId, userId }, select: { id: true } });
    if (!member) throw new Error("El responsable no pertenece a esta empresa.");
  }

  const now = new Date();
  const timeZone = await loadTimezone(organizationId);
  const slot = await resolveSlot(organizationId, input.scheduledAt, timeZone, now);
  const forced = !slot || !slot.available;
  if (forced && !input.force) throw new SlotUnavailableError(unavailableMessage(slot, input.scheduledAt, now));

  const durationMinutes = input.durationMinutes ?? (slot ? Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000) : 30);
  const data = {
    organizationId,
    contactId: contact.id,
    opportunityId,
    conversationId,
    userId,
    scheduledAt: input.scheduledAt,
    durationMinutes,
    notes: input.notes?.trim() || null,
    createdByKind: input.createdByKind,
    createdByUserId: input.createdByUserId ?? null,
    clientRequestId,
  };

  let appointment: Appointment;
  try {
    appointment = await database.appointment.create({ data, select: APPOINTMENT_SELECT });
  } catch (error) {
    // Dos peticiones con el mismo clientRequestId llegaron a la vez: la segunda devuelve la primera.
    if (clientRequestId && isUniqueViolation(error)) {
      const existing = await database.appointment.findUnique({
        where: { organizationId_clientRequestId: { organizationId, clientRequestId } },
        select: APPOINTMENT_SELECT,
      });
      if (existing) return { appointment: existing, created: false };
    }
    throw error;
  }

  await announceCreated(appointment, { forced, createdByKind: input.createdByKind, actorUserId: input.createdByUserId ?? null });
  return { appointment, created: true };
}

async function announceCreated(appointment: Appointment, detail: { forced: boolean; createdByKind: CreatedByKind; actorUserId: string | null; rescheduledFromId?: string; reason?: string | null }) {
  await audit({
    organizationId: appointment.organizationId,
    actorUserId: detail.actorUserId,
    action: detail.rescheduledFromId ? "appointment.rescheduled" : "appointment.created",
    targetKind: "appointment",
    targetId: appointment.id,
    detail: {
      scheduledAt: appointment.scheduledAt.toISOString(),
      contactId: appointment.contactId,
      userId: appointment.userId,
      createdByKind: detail.createdByKind,
      forced: detail.forced,
      ...(detail.rescheduledFromId ? { rescheduledFromId: detail.rescheduledFromId, reason: detail.reason ?? null } : {}),
    },
  });
  publishEvent({
    type: "appointment.created",
    organizationId: appointment.organizationId,
    appointmentId: appointment.id,
    contactId: appointment.contactId,
    scheduledAt: appointment.scheduledAt.toISOString(),
  });
}

async function loadPending(organizationId: string, appointmentId: string): Promise<Appointment> {
  const appointment = await database.appointment.findFirst({ where: { id: appointmentId, organizationId }, select: APPOINTMENT_SELECT });
  if (!appointment) throw new Error("La cita no existe.");
  if (appointment.status !== "PENDING") throw new Error(`Esta cita ya cambió (${STATUS_LABEL[appointment.status]}). Recarga la agenda.`);
  return appointment;
}

const STATUS_LABEL: Record<Appointment["status"], string> = {
  PENDING: "pendiente",
  DONE: "atendida",
  NO_SHOW: "no contestó",
  RESCHEDULED: "reprogramada",
  CANCELLED: "cancelada",
};

/**
 * Reprograma: crea una cita nueva en un horario con cupo (hereda contacto,
 * oportunidad, conversación, responsable y duración) y deja la original en
 * RESCHEDULED con `supersededById` hacia la nueva. Devuelve la nueva.
 * Lanza `SlotUnavailableError` si el horario no existe o está lleno.
 */
export async function rescheduleAppointment(input: {
  organizationId: string;
  appointmentId: string;
  scheduledAt: Date;
  actorUserId?: string | null;
  reason?: string;
  createdByKind?: CreatedByKind;
}): Promise<Appointment> {
  const { organizationId } = input;
  if (Number.isNaN(input.scheduledAt.getTime())) throw new Error("La fecha y hora de la cita no es válida.");
  const original = await loadPending(organizationId, input.appointmentId);
  if (original.scheduledAt.getTime() === input.scheduledAt.getTime()) throw new Error("La cita ya está en ese horario.");

  const now = new Date();
  const timeZone = await loadTimezone(organizationId);
  const slot = await resolveSlot(organizationId, input.scheduledAt, timeZone, now);
  if (!slot || !slot.available) throw new SlotUnavailableError(unavailableMessage(slot, input.scheduledAt, now));

  const reason = input.reason?.trim() || null;
  const createdByKind = input.createdByKind ?? "USER";
  const replacement = await database.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        organizationId,
        contactId: original.contactId,
        opportunityId: original.opportunityId,
        conversationId: original.conversationId,
        userId: original.userId,
        scheduledAt: input.scheduledAt,
        durationMinutes: original.durationMinutes,
        notes: appendNote(original.notes, reason ? `Reprogramada: ${reason}` : null),
        createdByKind,
        createdByUserId: input.actorUserId ?? null,
      },
      select: APPOINTMENT_SELECT,
    });
    const moved = await tx.appointment.updateMany({
      where: { id: original.id, organizationId, status: "PENDING" },
      data: { status: "RESCHEDULED", supersededById: created.id },
    });
    if (moved.count !== 1) throw new Error("Esta cita ya cambió. Recarga la agenda.");
    return created;
  });

  await announceCreated(replacement, { forced: false, createdByKind, actorUserId: input.actorUserId ?? null, rescheduledFromId: original.id, reason });
  return replacement;
}

function appendNote(existing: string | null, addition: string | null): string | null {
  if (!addition) return existing;
  return existing ? `${existing}\n${addition}` : addition;
}

/** Cierra una cita pendiente: atendida, no contestó o cancelada. Las notas se añaden, no reemplazan. */
export async function setAppointmentStatus(input: {
  organizationId: string;
  appointmentId: string;
  status: "DONE" | "NO_SHOW" | "CANCELLED";
  actorUserId?: string | null;
  notes?: string | null;
}): Promise<Appointment> {
  const { organizationId } = input;
  const current = await loadPending(organizationId, input.appointmentId);
  const notes = appendNote(current.notes, input.notes?.trim() || null);
  const updated = await database.appointment.updateMany({
    where: { id: current.id, organizationId, status: "PENDING" },
    data: { status: input.status, notes },
  });
  if (updated.count !== 1) throw new Error("Esta cita ya cambió. Recarga la agenda.");
  await audit({
    organizationId,
    actorUserId: input.actorUserId ?? null,
    action: `appointment.${input.status.toLowerCase()}`,
    targetKind: "appointment",
    targetId: current.id,
    detail: { scheduledAt: current.scheduledAt.toISOString(), contactId: current.contactId, userId: current.userId, notes: input.notes?.trim() || null },
  });
  return { ...current, status: input.status, notes };
}

/**
 * Citas que empiezan en [from, to), en todos los estados (incluidas las
 * RESCHEDULED, que apuntan a su reemplazo). `userId` filtra por responsable;
 * `contactId` por contacto. Ordenadas por hora.
 */
export async function listAppointments(input: {
  organizationId: string;
  from: Date;
  to: Date;
  userId?: string | null;
  contactId?: string | null;
}): Promise<AppointmentWithContact[]> {
  const rows = await database.appointment.findMany({
    where: {
      organizationId: input.organizationId,
      scheduledAt: { gte: input.from, lt: input.to },
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.contactId ? { contactId: input.contactId } : {}),
    },
    select: {
      ...APPOINTMENT_SELECT,
      contact: { select: { id: true, displayName: true, phone: true, documentNumber: true } },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
  });
  const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))];
  const members = userIds.length
    ? await database.organizationMember.findMany({
        where: { organizationId: input.organizationId, userId: { in: userIds } },
        select: { userId: true, user: { select: { name: true } } },
      })
    : [];
  const names = new Map(members.map((member) => [member.userId, member.user.name]));
  return rows.map((row) => ({
    ...row,
    user: row.userId ? { id: row.userId, name: names.get(row.userId) ?? "Cuenta retirada" } : null,
  }));
}

/** Cuánto dura una cita, como instante de fin. Útil para recordatorios y solapes. */
export function appointmentEndsAt(appointment: Pick<Appointment, "scheduledAt" | "durationMinutes">): Date {
  return addMinutes(appointment.scheduledAt, appointment.durationMinutes);
}
