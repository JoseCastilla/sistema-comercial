import type { Prisma } from "@/generated/prisma/client";
import type { OrganizationRole } from "@/generated/prisma/enums";

/**
 * Quién ve qué en la bandeja (SPEC-054 BR-001). Reglas puras: reciben rol y
 * usuario, devuelven el `where` de Prisma. Sin equipos en el MVP: el asesor ve
 * lo suyo y lo que nadie tomó; el resto ve toda la organización.
 */
export interface ScopeInput {
  organizationId: string;
  role: OrganizationRole;
  userId: string;
}

export function conversationScopeWhere(access: ScopeInput): Prisma.ConversationWhereInput {
  if (access.role === "AGENT") {
    return {
      organizationId: access.organizationId,
      OR: [{ assignedUserId: access.userId }, { assignedUserId: null }],
    };
  }
  return { organizationId: access.organizationId };
}

export const INBOX_VIEWS = [
  ["mias", "Mías"],
  ["sin_tomar", "Sin tomar"],
  ["sin_atender", "Sin atender"],
  ["requiere_asesor", "Requiere asesor"],
  ["ia", "Asistente"],
  ["todas", "Todas"],
  ["cerradas", "Cerradas"],
] as const;

export type InboxView = (typeof INBOX_VIEWS)[number][0];

export function parseView(value: string | string[] | undefined, fallback: InboxView = "mias"): InboxView {
  const raw = Array.isArray(value) ? value[0] : value;
  return INBOX_VIEWS.some(([key]) => key === raw) ? (raw as InboxView) : fallback;
}

/**
 * Filtro de cada vista. «Sin atender» son las que llevan más tiempo esperando
 * que el umbral de la organización (`unattendedBefore` lo calcula quien llama).
 */
export function viewWhere(view: InboxView, input: { userId: string; unattendedBefore: Date }): Prisma.ConversationWhereInput {
  switch (view) {
    case "mias":
      return { status: "OPEN", assignedUserId: input.userId };
    case "sin_tomar":
      return { status: "OPEN", assignedUserId: null };
    case "sin_atender":
      return { status: "OPEN", responderState: { not: "IA_ACTIVA" }, unattendedSince: { lte: input.unattendedBefore } };
    case "requiere_asesor":
      return { status: "OPEN", responderState: "REQUIERE_ASESOR" };
    case "ia":
      return { status: "OPEN", responderState: "IA_ACTIVA" };
    case "cerradas":
      return { status: "CLOSED" };
    case "todas":
    default:
      return { status: "OPEN" };
  }
}

/** Búsqueda por nombre o teléfono. Con solo dígitos busca en el teléfono. */
export function searchWhere(query: string): Prisma.ConversationWhereInput {
  const q = query.trim();
  if (!q) return {};
  const digits = q.replace(/\D/g, "");
  const byPhone: Prisma.ConversationWhereInput[] = digits.length >= 3 ? [{ contact: { phone: { contains: digits } } }] : [];
  return { OR: [{ contact: { displayName: { contains: q, mode: "insensitive" } } }, ...byPhone] };
}
