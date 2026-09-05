/**
 * Filtros de la bandeja de recupero de ventas — SPEC-041 (fase 2 del plan de
 * Pedidos y Recupero, 05/09/2026).
 *
 * La bandeja del carril interno no tenía buscador ni filtros: con más de
 * sesenta casos abiertos, encontrar uno era recorrer la tabla. Aquí viven las
 * vistas, los estados y las etiquetas que la bandeja y sus filtros comparten,
 * para que un rótulo no pueda decir una cosa en la tabla y otra en el
 * selector.
 */

export type SalesRecoveryView = "abiertos" | "resueltos";

export const salesRecoveryViewOptions: ReadonlyArray<{
  value: SalesRecoveryView;
  label: string;
}> = [
  { value: "abiertos", label: "Abiertos" },
  { value: "resueltos", label: "Resueltos" },
];

/** Un valor desconocido cae en «abiertos»: la bandeja es la cola de trabajo. */
export function parseSalesRecoveryView(
  value: string | null | undefined,
): SalesRecoveryView {
  return String(value ?? "").trim() === "resueltos" ? "resueltos" : "abiertos";
}

export type SalesRecoveryOpenStatus =
  "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "SCHEDULED" | "WAITING";

export type SalesRecoveryResolvedStatus = "RECOVERED" | "LOST";

export const salesRecoveryOpenStatuses: ReadonlyArray<SalesRecoveryOpenStatus> =
  ["OPEN", "ASSIGNED", "IN_PROGRESS", "SCHEDULED", "WAITING"];

export const salesRecoveryResolvedStatuses: ReadonlyArray<SalesRecoveryResolvedStatus> =
  ["RECOVERED", "LOST"];

export const salesRecoveryOpenStatusOptions: ReadonlyArray<{
  value: SalesRecoveryOpenStatus;
  label: string;
}> = [
  { value: "OPEN", label: "Sin responsable" },
  { value: "ASSIGNED", label: "Asignado" },
  { value: "IN_PROGRESS", label: "En gestión" },
  { value: "SCHEDULED", label: "Agendado" },
  { value: "WAITING", label: "Esperando confirmación" },
];

export const salesRecoveryResolvedStatusOptions: ReadonlyArray<{
  value: SalesRecoveryResolvedStatus;
  label: string;
}> = [
  { value: "RECOVERED", label: "Recuperada" },
  { value: "LOST", label: "Perdida" },
];

/** SPEC-026: crítica, alta, media, condicionada. */
export type SalesRecoveryPriority =
  "CRITICA" | "ALTA" | "MEDIA" | "CONDICIONADA";

export const salesRecoveryPriorityOptions: ReadonlyArray<{
  value: SalesRecoveryPriority;
  label: string;
}> = [
  { value: "CRITICA", label: "Crítica" },
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "CONDICIONADA", label: "Condicionada" },
];

/** SPEC-030 BR-063: por qué entró la venta a recuperación. */
export type SalesRecoveryReason =
  | "NO_ENTREGADO"
  | "INCIDENCIA_LOGISTICA"
  | "PROMESA_COMERCIAL_INCORRECTA"
  | "DEUDA"
  | "ANTIGUEDAD_PORTA"
  | "OTRO";

export const salesRecoveryReasonOptions: ReadonlyArray<{
  value: SalesRecoveryReason;
  label: string;
}> = [
  { value: "NO_ENTREGADO", label: "No recibió" },
  { value: "INCIDENCIA_LOGISTICA", label: "Incidencia logística" },
  { value: "PROMESA_COMERCIAL_INCORRECTA", label: "Promesa incorrecta" },
  { value: "DEUDA", label: "Deuda" },
  { value: "ANTIGUEDAD_PORTA", label: "Antigüedad de porta" },
  { value: "OTRO", label: "Otro" },
];

/** Devuelve el valor si es una opción válida; si no, `null`. */
export function pickFilterOption<T extends string>(
  value: string | null | undefined,
  options: ReadonlyArray<{ value: T }>,
): T | null {
  const text = String(value ?? "").trim();

  return options.some((option) => option.value === text) ? (text as T) : null;
}
