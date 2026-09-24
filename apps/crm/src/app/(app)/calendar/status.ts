import type { AppointmentStatus } from "@/generated/prisma/enums";

/** Textos y tonos de estado compartidos por las pantallas del calendario. */
export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente",
  DONE: "Atendida",
  NO_SHOW: "No contestó",
  RESCHEDULED: "Reprogramada",
  CANCELLED: "Cancelada",
};

export const STATUS_TONE: Record<AppointmentStatus, "neutral" | "success" | "danger" | "warning" | "info"> = {
  PENDING: "info",
  DONE: "success",
  NO_SHOW: "warning",
  RESCHEDULED: "neutral",
  CANCELLED: "neutral",
};

export function contactName(contact: { displayName: string | null; phone: string | null }): string {
  return contact.displayName?.trim() || contact.phone || "Sin nombre";
}

export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const DAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «lun 14 sep» a partir de «2026-09-14». */
export function describeDay(dateIso: string, weekday: number): string {
  const [, month = "1", day = "1"] = dateIso.split("-");
  return `${DAY_SHORT[weekday]} ${Number(day)} ${MONTH_SHORT[Number(month) - 1]}`;
}
