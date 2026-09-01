/*
 * Contrato compartido entre el servidor y la interfaz del módulo logístico.
 * No importa `server-only` porque el formulario de administración lo consume
 * desde el navegador.
 */

/**
 * Ventanas de una sincronización manual. Acotan por fecha de registro de la
 * venta: consultar solo lo reciente reduce el tráfico contra la fuente externa
 * cuando el administrador quiere una actualización rápida.
 */
export const AGR_SYNC_WINDOWS = {
  LAST_24H: { label: "Últimas 24 horas", hours: 24 },
  LAST_3D: { label: "Últimos 3 días", hours: 72 },
  LAST_7D: { label: "Últimos 7 días", hours: 168 },
  ALL: { label: "Todas las que aplican", hours: null },
} as const;

export type AgrSyncWindow = keyof typeof AGR_SYNC_WINDOWS;

export function parseAgrSyncWindow(value: unknown): AgrSyncWindow {
  return typeof value === "string" && value in AGR_SYNC_WINDOWS
    ? (value as AgrSyncWindow)
    : "ALL";
}
