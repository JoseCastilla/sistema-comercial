/** Textos de la ficha en lenguaje directo: se dice qué pasa, no el nombre del enum. */
export const STAGE_LABELS: Record<string, string> = {
  NUEVO: "Nuevo",
  EN_CONTACTO: "En contacto",
  CALIFICADO: "Calificado",
  PROPUESTA: "Con propuesta",
  EN_CIERRE: "En cierre",
  GANADA: "Ganada",
  PERDIDA: "Perdida",
};

export const NEXT_ACTION_LABELS: Record<string, string> = {
  LLAMAR: "Llamar",
  CITA: "Cita",
  ESPERAR_RESPUESTA: "Esperar respuesta",
  COMPLETAR_DATOS: "Completar datos",
};

export const ORIGIN_LABELS: Record<string, string> = {
  AD: "Anuncio",
  BROADCAST: "Difusión",
  REFERRAL: "Referido",
  ADVISOR: "Lo trajo un asesor",
  ORGANIC: "Escribió por su cuenta",
  UNKNOWN: "Sin origen conocido",
};

export const ORDER_STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "success" | "danger" | "warning" | "info" }> = {
  INGRESADO: { label: "Ingresado", tone: "info" },
  ENTREGADO: { label: "Entregado", tone: "success" },
  ACTIVADO: { label: "Activado", tone: "success" },
  CANCELADO: { label: "Cancelado", tone: "danger" },
};

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  RESCHEDULED: "Reprogramada",
  DONE: "Hecha",
  NO_SHOW: "No asistió",
  CANCELLED: "Cancelada",
};

export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Promocional",
  UTILITY: "De servicio",
  AUTHENTICATION: "Código",
};

/**
 * Ruta de un adjunto servido con sesión (SPEC-062 M-05). El tipo ya no viaja
 * en la URL: la ruta usa el que se guardó al recibir el adjunto.
 */
export function mediaUrl(mediaPath: string): string {
  const path = mediaPath.split("/").map(encodeURIComponent).join("/");
  return `/api/media/${path}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function inboxHref(params: { vista?: string; q?: string; pagina?: number }, conversationId?: string): string {
  const search = new URLSearchParams();
  if (params.vista) search.set("vista", params.vista);
  if (params.q) search.set("q", params.q);
  if (params.pagina && params.pagina > 1) search.set("pagina", String(params.pagina));
  const query = search.toString();
  const base = conversationId ? `/inbox/${conversationId}` : "/inbox";
  return query ? `${base}?${query}` : base;
}
