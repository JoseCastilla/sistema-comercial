/**
 * Reglas puras de difusiones (SPEC-059). Sin base de datos ni red: todo lo que
 * decide a quién se le escribe, cuándo y cuánto cuesta vive acá para poder
 * probarlo. La única excepción es la tasa de cambio, que sí mira el entorno y
 * está aislada en `usdToPen()`.
 */
import { DEFAULT_TIMEZONE, localParts } from "@/lib/time";

import type { TemplateCategory } from "@/generated/prisma/enums";

// ───────────────────────── Exclusiones (BR-003) ─────────────────────────

/**
 * Motivos por los que alguien queda fuera. El código se guarda en
 * `BroadcastRecipient.exclusionReason`; el texto es lo que ve la persona.
 */
export const EXCLUSION_REASONS = [
  "SIN_CONSENTIMIENTO",
  "BAJA_MARKETING",
  "NO_CONTACTAR",
  "MARKETING_RECIENTE",
  "LO_ATIENDE_UN_ASESOR",
  "ENVIO_FALLIDO",
  "SIN_TELEFONO",
  "FALTA_DATO",
] as const;

export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

/** Texto directo: la consecuencia operativa, no el término del dominio. */
export const EXCLUSION_TEXT: Record<ExclusionReason, string> = {
  SIN_CONSENTIMIENTO: "no aceptó recibir promociones",
  BAJA_MARKETING: "pidió que dejemos de mandarle promociones",
  NO_CONTACTAR: "está marcado como «no contactar»",
  MARKETING_RECIENTE: "ya recibió una promoción esta semana",
  LO_ATIENDE_UN_ASESOR: "la está atendiendo un asesor: escríbele desde la bandeja",
  ENVIO_FALLIDO: "su último envío falló: el número no existe o nos bloqueó",
  SIN_TELEFONO: "no tenemos su número de WhatsApp",
  FALTA_DATO: "falta un dato que la plantilla necesita",
};

export function exclusionText(reason: string | null | undefined): string {
  if (!reason) return "sin motivo registrado";
  return EXCLUSION_TEXT[reason as ExclusionReason] ?? reason;
}

/** Etiqueta que marca a quien no se le escribe nunca, venga de donde venga. */
export const DO_NOT_CONTACT_TAG = "no-contactar";

/** Tope propio de marketing por persona (SPEC-059 §5): una cada 7 días. */
export const MARKETING_COOLDOWN_DAYS = 7;

/** Si un asesor le escribió en las últimas 24 h, la difusión no se mete. */
export const ADVISOR_ACTIVITY_HOURS = 24;

/** Datos del contacto que necesitan las exclusiones. Los arma `resolveSegment`. */
export interface RecipientFacts {
  id: string;
  phone: string | null;
  tags: string[];
  /** Última decisión de marketing: `true` aceptó, `false` se dio de baja, `null` nunca dijo nada. */
  marketingConsent: boolean | null;
  /** Marca de la baja explícita de marketing. */
  marketingOptOutAt: Date | null;
  /** Cuándo recibió la última plantilla de marketing de la organización. */
  lastMarketingSentAt: Date | null;
  /** Última actividad de una conversación abierta con asesor asignado. */
  advisorActivityAt: Date | null;
  /** Su último envío falló por número inválido o bloqueo. */
  sendingBlocked: boolean;
}

export interface EvaluationContext {
  now: Date;
  marketingCooldownDays?: number;
  advisorActivityHours?: number;
}

export interface EvaluationTemplate {
  category: TemplateCategory;
}

export type Evaluation =
  | { eligible: true }
  | { eligible: false; reason: ExclusionReason; reasonText: string };

function excluded(reason: ExclusionReason): Evaluation {
  return { eligible: false, reason, reasonText: EXCLUSION_TEXT[reason] };
}

function hoursSince(from: Date | null, now: Date): number | null {
  if (!from) return null;
  return (now.getTime() - from.getTime()) / 3_600_000;
}

/**
 * ¿Le podemos escribir esta plantilla? Las exclusiones de BR-003 son fijas:
 * nadie las puede quitar desde la pantalla.
 *
 * De marketing se excluye todo lo de BR-003. De utilidad solo lo que impide
 * físicamente el envío o lo prohíbe siempre: «no contactar», sin teléfono y
 * envío previo fallido. La baja de servicio no existe en el MVP (nadie puede
 * renunciar a que le avisen de su propio pedido), así que no hay nada más que
 * comprobar.
 */
export function evaluateRecipient(
  contact: RecipientFacts,
  context: EvaluationContext,
  template: EvaluationTemplate,
): Evaluation {
  const isMarketing = template.category === "MARKETING";
  const cooldownDays = context.marketingCooldownDays ?? MARKETING_COOLDOWN_DAYS;
  const advisorHours = context.advisorActivityHours ?? ADVISOR_ACTIVITY_HOURS;

  if (isMarketing) {
    if (contact.marketingConsent !== true) return excluded("SIN_CONSENTIMIENTO");
    if (contact.marketingOptOutAt) return excluded("BAJA_MARKETING");
  }

  if (contact.tags.some((tag) => tag.trim().toLowerCase() === DO_NOT_CONTACT_TAG)) {
    return excluded("NO_CONTACTAR");
  }

  if (isMarketing) {
    const since = hoursSince(contact.lastMarketingSentAt, context.now);
    if (since !== null && since < cooldownDays * 24) return excluded("MARKETING_RECIENTE");

    const advisor = hoursSince(contact.advisorActivityAt, context.now);
    if (advisor !== null && advisor < advisorHours) return excluded("LO_ATIENDE_UN_ASESOR");
  }

  if (contact.sendingBlocked) return excluded("ENVIO_FALLIDO");
  if (!contact.phone?.trim()) return excluded("SIN_TELEFONO");

  return { eligible: true };
}

// ───────────────────────── Límite de envío diario ─────────────────────────

/**
 * `messaging_limit_tier` de Meta → personas nuevas por día. `null` es sin
 * límite. Si Meta todavía no fijó el tier se asume el más bajo real (250):
 * pasarse del límite hace que Meta rechace los envíos del día.
 */
export const DEFAULT_DAILY_LIMIT = 250;

const TIER_LIMITS: Record<string, number | null> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1_000,
  TIER_10K: 10_000,
  TIER_100K: 100_000,
  TIER_UNLIMITED: null,
  UNLIMITED: null,
};

/** Devuelve el tope diario; `null` significa sin límite. */
export function dailyLimitForTier(tier: string | null | undefined): number | null {
  const value = (tier ?? "").trim().toUpperCase();
  if (!value) return DEFAULT_DAILY_LIMIT;
  if (value in TIER_LIMITS) return TIER_LIMITS[value] ?? null;
  return DEFAULT_DAILY_LIMIT;
}

/** ¿El tope viene de Meta o lo asumimos nosotros? Para decirlo en pantalla. */
export function dailyLimitIsAssumed(tier: string | null | undefined): boolean {
  const value = (tier ?? "").trim().toUpperCase();
  return !value || !(value in TIER_LIMITS);
}

/** Día calendario en la zona de la organización, «2026-09-12». */
export function dayKey(date: Date, timezone = DEFAULT_TIMEZONE): string {
  const parts = localParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Días en que se puede enviar: lunes a sábado (BR-006, domingo fuera). */
export const SEND_WEEKDAYS = [1, 2, 3, 4, 5, 6];
export const SEND_START_MINUTE = 9 * 60;
export const SEND_END_MINUTE = 20 * 60;

/** ¿Ese instante cae en la franja permitida? Lunes a sábado, 9:00 a 20:00 Lima. */
export function withinSendWindow(date: Date, timezone = DEFAULT_TIMEZONE): boolean {
  const parts = localParts(date, timezone);
  if (!SEND_WEEKDAYS.includes(parts.weekday)) return false;
  const minutes = parts.hour * 60 + parts.minute;
  return minutes >= SEND_START_MINUTE && minutes < SEND_END_MINUTE;
}

export interface DayBucket {
  /** Día calendario en Lima, «2026-09-12». */
  day: string;
  count: number;
}

export interface DailyPlan {
  /** Día → contactos que salen ese día. Es lo que se guarda en el segmento. */
  schedule: Record<string, string[]>;
  days: DayBucket[];
}

/**
 * Reparte los destinatarios en días respetando el tope diario del número.
 * Empieza el día de `startDate` y salta los domingos, que están fuera de la
 * franja de envío. Con tope nulo (sin límite) todos salen el primer día.
 */
export function splitByDailyLimit(
  recipientIds: string[],
  dailyLimit: number | null,
  startDate: Date,
  timezone = DEFAULT_TIMEZONE,
): DailyPlan {
  const schedule: Record<string, string[]> = {};
  const days: DayBucket[] = [];
  if (!recipientIds.length) return { schedule, days };

  const perDay = dailyLimit === null ? recipientIds.length : Math.max(1, Math.floor(dailyLimit));
  let cursor = new Date(startDate.getTime());
  let index = 0;
  // Cota de seguridad: nunca más de mil días de reparto.
  for (let guard = 0; index < recipientIds.length && guard < 1_000; guard += 1) {
    while (!SEND_WEEKDAYS.includes(localParts(cursor, timezone).weekday)) {
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    const key = dayKey(cursor, timezone);
    const slice = recipientIds.slice(index, index + perDay);
    schedule[key] = slice;
    days.push({ day: key, count: slice.length });
    index += slice.length;
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return { schedule, days };
}

// ───────────────────────── Freno automático (BR-009) ─────────────────────────

/** Umbrales del freno. Con menos volumen que el mínimo no se evalúa. */
export const BRAKE_BLOCK_RATE = 0.02;
export const BRAKE_BLOCK_MIN_DELIVERED = 50;
export const BRAKE_FAILURE_RATE = 0.1;
export const BRAKE_FAILURE_MIN_SENT = 20;

export interface BrakeCounters {
  delivered: number;
  failed: number;
  optOuts: number;
  blocked: number;
  /** Total que salió. Si no se pasa, se asume entregados + fallidos. */
  sent?: number;
}

export type BrakeDecision = { pause: false } | { pause: true; reason: string };

/**
 * Pausa la difusión cuando la gente la está rechazando o Meta no la entrega.
 * Los mínimos evitan pausar por dos bloqueos sobre diez envíos.
 */
export function brakeDecision(counters: BrakeCounters): BrakeDecision {
  const sent = counters.sent ?? counters.delivered + counters.failed;

  const rejections = counters.blocked + counters.optOuts;
  if (counters.delivered >= BRAKE_BLOCK_MIN_DELIVERED && rejections > counters.delivered * BRAKE_BLOCK_RATE) {
    const percent = ((rejections / counters.delivered) * 100).toFixed(1);
    return {
      pause: true,
      reason: `${rejections} de ${counters.delivered} personas la bloquearon o se dieron de baja (${percent} %). Si sigue, Meta baja la calidad del número.`,
    };
  }

  if (sent >= BRAKE_FAILURE_MIN_SENT && counters.failed > sent * BRAKE_FAILURE_RATE) {
    const percent = ((counters.failed / sent) * 100).toFixed(1);
    return {
      pause: true,
      reason: `${counters.failed} de ${sent} envíos fallaron (${percent} %). Revisa los números antes de seguir.`,
    };
  }

  return { pause: false };
}

// ───────────────────────── Costo estimado (BR-007) ─────────────────────────

/**
 * Tarifa por mensaje en dólares, Perú, plantillas de WhatsApp.
 * Fuente: SPEC-055 §fuentes (lista de precios por categoría de Meta).
 * Es una constante del código a propósito: cuando Meta cambie la lista se
 * cambia acá y se anota la fecha, en vez de dejarlo en una tabla que nadie
 * mantiene. Los códigos de acceso se cobran como utilidad en el MVP.
 */
export const RATE_USD_BY_CATEGORY: Record<TemplateCategory, number> = {
  MARKETING: 0.0809,
  UTILITY: 0.023,
  AUTHENTICATION: 0.023,
};

/** Tipo de cambio para mostrar el costo en soles. Es una aproximación. */
export const DEFAULT_USD_TO_PEN = 3.7;

export function usdToPen(): number {
  const raw = process.env.BROADCAST_USD_TO_PEN ?? process.env.AI_USD_TO_PEN;
  const value = Number.parseFloat(raw ?? "");
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_USD_TO_PEN;
}

export interface CostEstimate {
  count: number;
  ratePerMessageUsd: number;
  usd: number;
  pen: number;
  usdToPen: number;
}

/** Costo aproximado de mandar `count` mensajes de esa categoría. */
export function estimateCost(count: number, category: TemplateCategory, rate = usdToPen()): CostEstimate {
  const ratePerMessageUsd = RATE_USD_BY_CATEGORY[category] ?? RATE_USD_BY_CATEGORY.UTILITY;
  const usd = Math.max(0, count) * ratePerMessageUsd;
  return {
    count: Math.max(0, count),
    ratePerMessageUsd,
    usd: Number(usd.toFixed(4)),
    pen: Number((usd * rate).toFixed(2)),
    usdToPen: rate,
  };
}

// ───────────────────────── Estados en texto directo ─────────────────────────

export const BROADCAST_STATUS_TEXT: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger"; detail: string }> = {
  DRAFT: { label: "Borrador", tone: "neutral", detail: "Todavía no se le escribe a nadie." },
  SCHEDULED: { label: "Programada", tone: "info", detail: "Los destinatarios ya están congelados y espera su hora." },
  SENDING: { label: "Enviando", tone: "info", detail: "Sale de a pocos dentro del horario permitido." },
  PAUSED: { label: "Pausada", tone: "warning", detail: "No sale nada más hasta que el dueño la reanude." },
  DONE: { label: "Terminada", tone: "success", detail: "Ya salió todo lo que tenía que salir." },
  CANCELLED: { label: "Cancelada", tone: "neutral", detail: "Se detuvo y no se retoma." },
};

export const RECIPIENT_STATUS_TEXT: Record<string, string> = {
  PENDING: "Por enviar",
  EXCLUDED: "Excluido",
  QUEUED: "En cola",
  SENT: "Enviado",
  DELIVERED: "Le llegó",
  READ: "Lo leyó",
  REPLIED: "Respondió",
  FAILED: "No le llegó",
  CANCELLED: "Cancelado",
};
