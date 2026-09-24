import type { MessageOriginKind, MessageStatus, ResponderState } from "@/generated/prisma/enums";
import { formatDate, formatTime, localParts } from "@/lib/time";

/**
 * Reglas puras de presentación de la bandeja (SPEC-054 BR-008, BR-009,
 * BR-012). Sin acceso a base ni a sesión: se prueban con Vitest y las usan
 * tanto el servidor como el navegador.
 */

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info";

/** Etiqueta del estado de quién responde, tal como la ve el asesor. */
export function responderLabel(state: ResponderState, assignedName?: string | null): { label: string; tone: BadgeTone } {
  switch (state) {
    case "IA_ACTIVA":
      return { label: "Asistente", tone: "info" };
    case "REQUIERE_ASESOR":
      return { label: "Requiere asesor", tone: "warning" };
    case "CONTROL_HUMANO":
    default:
      return { label: assignedName ? `Asesor: ${assignedName}` : "Asesor", tone: "success" };
  }
}

/** Quién escribió un mensaje saliente (BR-009). */
export function outboundOriginLabel(originKind: MessageOriginKind, senderName?: string | null): string {
  switch (originKind) {
    case "USER":
      return senderName ?? "Asesor";
    case "AGENT_AI":
      return "Asistente virtual";
    case "WORKFLOW":
      return "Flujo";
    case "BROADCAST":
      return "Difusión";
    case "SYSTEM":
      return "Sistema";
    case "CONTACT":
    default:
      return "";
  }
}

/** Estado de envío en un glifo: reloj, ✓, ✓✓, ✓✓ azul, ✗. */
export function deliveryGlyph(status: MessageStatus, errorTitle?: string | null): { glyph: string; tone: "pending" | "sent" | "read" | "failed"; title: string } {
  switch (status) {
    case "QUEUED":
      return { glyph: "🕓", tone: "pending", title: "En cola de envío" };
    case "SENT":
      return { glyph: "✓", tone: "sent", title: "Enviado" };
    case "DELIVERED":
      return { glyph: "✓✓", tone: "sent", title: "Entregado" };
    case "READ":
      return { glyph: "✓✓", tone: "read", title: "Leído" };
    case "FAILED":
      return { glyph: "✗", tone: "failed", title: errorTitle ? `No se entregó: ${errorTitle}` : "No se entregó" };
    case "CANCELLED":
      return { glyph: "✗", tone: "failed", title: "Cancelado antes de salir" };
    case "RECEIVED":
    default:
      return { glyph: "", tone: "sent", title: "" };
  }
}

/** Sustituye {nombre} y {asesor} en una respuesta rápida (BR-012). */
export function applyQuickReply(body: string, values: { nombre?: string | null; asesor?: string | null }): string {
  return body
    .replace(/\{nombre\}/gi, (values.nombre ?? "").trim())
    .replace(/\{asesor\}/gi, (values.asesor ?? "").trim())
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export interface QuickReplyOption {
  id: string;
  shortcut: string;
  body: string;
}

/** Con el atajo «/» abierto, filtra por lo escrito tras la barra. */
export function matchQuickReplies(replies: QuickReplyOption[], draft: string): QuickReplyOption[] {
  if (!draft.startsWith("/")) return [];
  const needle = draft.slice(1).trim().toLowerCase();
  if (needle.includes(" ") || needle.includes("\n")) return [];
  return replies.filter((reply) => !needle || reply.shortcut.toLowerCase().startsWith(needle) || reply.body.toLowerCase().includes(needle)).slice(0, 8);
}

/** Primer carácter del nombre para el avatar; «#» si solo hay teléfono. */
export function avatarInitial(displayName?: string | null): string {
  const letter = (displayName ?? "").trim().charAt(0);
  return letter ? letter.toUpperCase() : "#";
}

export function contactTitle(contact: { displayName?: string | null; phone?: string | null }): string {
  return contact.displayName?.trim() || formatPhone(contact.phone) || "Sin nombre";
}

export function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  return `+${phone}`;
}

// ───────────────────────── Línea de tiempo del chat ─────────────────────────

export interface TimelineMessage {
  kind: "message";
  id: string;
  createdAt: Date;
}
export interface TimelineNote {
  kind: "note";
  id: string;
  createdAt: Date;
}
export type TimelineItem<M extends TimelineMessage = TimelineMessage, N extends TimelineNote = TimelineNote> = M | N;

export interface TimelineDay<T> {
  key: string;
  label: string;
  items: T[];
}

function dayKey(date: Date, timeZone: string): string {
  const parts = localParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** «Hoy», «Ayer» o la fecha corta en la zona de la organización. */
export function dayLabel(date: Date, timeZone: string, now: Date = new Date()): string {
  const key = dayKey(date, timeZone);
  if (key === dayKey(now, timeZone)) return "Hoy";
  if (key === dayKey(new Date(now.getTime() - 86_400_000), timeZone)) return "Ayer";
  return formatDate(date, timeZone);
}

/**
 * Color de la barra de ventana: rojo si ya no se puede escribir libre, ámbar
 * si queda menos de 2 h (BR-011), neutro el resto del tiempo.
 */
export function windowTone(lastInboundAt: Date | null | undefined, now: Date = new Date()): "neutral" | "warning" | "danger" {
  if (!lastInboundAt) return "danger";
  const minutesLeft = (lastInboundAt.getTime() + 24 * 3_600_000 - now.getTime()) / 60_000;
  if (minutesLeft <= 0) return "danger";
  return minutesLeft < 120 ? "warning" : "neutral";
}

/** Hora en la fila de la lista: hoy la hora, ayer «Ayer», antes la fecha corta. */
export function listTimeLabel(date: Date | null | undefined, timeZone: string, now: Date = new Date()): string {
  if (!date) return "";
  const label = dayLabel(date, timeZone, now);
  return label === "Hoy" ? formatTime(date, timeZone) : label;
}

/**
 * Mezcla mensajes y notas internas en orden cronológico y los agrupa por día
 * local. Los mensajes llegan con la misma marca de tiempo ordenados por id
 * estable para que dos refrescos no los muevan.
 */
export function groupTimelineByDay<T extends { createdAt: Date; id: string }>(items: T[], timeZone: string, now: Date = new Date()): TimelineDay<T>[] {
  const sorted = [...items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const days: TimelineDay<T>[] = [];
  for (const item of sorted) {
    const key = dayKey(item.createdAt, timeZone);
    const last = days[days.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      days.push({ key, label: dayLabel(item.createdAt, timeZone, now), items: [item] });
    }
  }
  return days;
}

// ───────────────────────── Historial en lenguaje directo ─────────────────────────

export interface EventLike {
  type: string;
  actorUserId?: string | null;
  detail?: unknown;
}

function detailOf(event: EventLike): Record<string, unknown> {
  return event.detail && typeof event.detail === "object" && !Array.isArray(event.detail) ? (event.detail as Record<string, unknown>) : {};
}

/** Qué pasó, dicho como lo diría el supervisor. `names` traduce ids a nombres. */
export function describeConversationEvent(event: EventLike, names: Map<string, string>): string {
  const detail = detailOf(event);
  const actor = event.actorUserId ? names.get(event.actorUserId) ?? "Alguien del equipo" : null;
  const reason = typeof detail.reason === "string" && detail.reason ? ` · ${detail.reason}` : "";
  const nameOf = (id: unknown) => (typeof id === "string" ? names.get(id) ?? "otro asesor" : null);
  switch (event.type) {
    case "OPENED":
      return detail.origin === "AD" ? "Empezó desde un anuncio" : "Empezó a escribir";
    case "ASSIGNED": {
      const to = nameOf(detail.to);
      return to ? `Asignada a ${to}${actor && actor !== to ? ` por ${actor}` : ""}${reason}` : `Asignada${reason}`;
    }
    case "TRANSFERRED": {
      const from = nameOf(detail.from);
      const to = nameOf(detail.to);
      return `${actor ?? "El sistema"} la pasó ${from ? `de ${from} ` : ""}a ${to ?? "otro asesor"}${reason}`;
    }
    case "RETURNED":
      return `${actor ?? "El sistema"} la devolvió a la cola${reason}`;
    case "TOOK_CONTROL": {
      const cancelled = typeof detail.cancelledPending === "number" && detail.cancelledPending > 0 ? ` · se cancelaron ${detail.cancelledPending} envío(s) automático(s)` : "";
      return `${actor ?? "Un asesor"} tomó el control${reason}${cancelled}`;
    }
    case "HANDED_BACK":
      return `${actor ?? "El sistema"} la devolvió al asistente${reason}`;
    case "REQUIRES_ADVISOR":
      return `Necesita un asesor${reason}`;
    case "CLOSED":
      return `${actor ?? "El sistema"} la cerró${reason}`;
    case "REOPENED":
      return `${actor ?? "El sistema"} la reabrió${reason}`;
    case "UNATTENDED":
      return typeof detail.minutes === "number" ? `Sin respuesta del asesor durante ${detail.minutes} min` : "Sin respuesta del asesor";
    case "WORKFLOW":
      return typeof detail.summary === "string" ? detail.summary : "Un flujo actuó sobre la conversación";
    case "AI":
      return typeof detail.summary === "string" ? detail.summary : "El asistente actuó";
    default:
      return event.type.toLowerCase().replace(/_/g, " ");
  }
}
