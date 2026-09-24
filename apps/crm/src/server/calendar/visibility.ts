import type { OrganizationRole } from "@/generated/prisma/enums";

/**
 * Quién ve y quién cambia una cita. Reglas puras: la pantalla y las acciones
 * de servidor usan las mismas, para que nadie vea en la agenda algo que luego
 * no puede tocar (ni al revés).
 */
export interface CalendarViewer {
  userId: string;
  role: OrganizationRole;
}

/** El asesor ve las suyas y las que aún no tienen responsable; el resto ve todas. */
export function canSeeAppointment(viewer: CalendarViewer, appointment: { userId: string | null }): boolean {
  if (viewer.role !== "AGENT") return true;
  return appointment.userId === null || appointment.userId === viewer.userId;
}

/** El back office consulta la agenda pero no la cambia. */
export function canChangeAppointment(viewer: CalendarViewer, appointment: { userId: string | null }): boolean {
  if (viewer.role === "BACKOFFICE") return false;
  return canSeeAppointment(viewer, appointment);
}
