/**
 * Traducción de los estados de Meta a lenguaje directo (SPEC-053, SPEC-055).
 * Funciones puras: no leen entorno ni base de datos.
 */

export type Tone = "neutral" | "success" | "danger" | "warning" | "info";

export interface DirectStatus {
  label: string;
  tone: Tone;
  /** Consecuencia operativa, cuando hace falta explicarla. */
  detail?: string;
}

// ───────────────────────── Calidad del número ─────────────────────────

/** quality_rating de Meta: GREEN | YELLOW | RED | UNKNOWN | NA. */
export function qualityText(rating: string | null | undefined): DirectStatus {
  const value = (rating ?? "").toUpperCase();
  switch (value) {
    case "GREEN":
      return { label: "Buena", tone: "success", detail: "Las personas responden y no bloquean." };
    case "YELLOW":
      return {
        label: "En observación",
        tone: "warning",
        detail: "Hubo bloqueos o reportes: cuida a quién le escribes o Meta bajará tu límite de envío.",
      };
    case "RED":
      return {
        label: "Baja",
        tone: "danger",
        detail: "Si sigue así, Meta bajará tu límite de envío o dejará de entregar tus plantillas.",
      };
    case "":
    case "UNKNOWN":
    case "NA":
      return { label: "Sin datos aún", tone: "neutral", detail: "Meta la calcula después de los primeros envíos." };
    default:
      return { label: value, tone: "neutral" };
  }
}

// ───────────────────────── Límite de envío ─────────────────────────

const TIER_PEOPLE: Record<string, string> = {
  TIER_50: "50",
  TIER_250: "250",
  TIER_1K: "1.000",
  TIER_10K: "10.000",
  TIER_100K: "100.000",
};

/**
 * messaging_limit_tier → cuántas personas nuevas puedes contactar en 24 h.
 * El límite cuenta conversaciones que inicia el negocio, no las respuestas.
 */
export function messagingLimitText(tier: string | null | undefined): string {
  const value = (tier ?? "").toUpperCase();
  if (!value) return "Meta aún no fijó tu límite: aparecerá tras los primeros envíos.";
  if (value === "TIER_UNLIMITED" || value === "UNLIMITED") {
    return "Puedes iniciar conversaciones sin límite de personas por día.";
  }
  const people = TIER_PEOPLE[value];
  if (!people) return `Límite de envío de Meta: ${value}.`;
  return `Puedes iniciar conversaciones con hasta ${people} personas por día.`;
}

// ───────────────────────── Estado del número ─────────────────────────

/** Estado del número tal como lo guarda el sistema. */
export function numberStatusText(status: string | null | undefined): DirectStatus {
  switch ((status ?? "").toUpperCase()) {
    case "CONNECTED":
      return { label: "Conectado", tone: "success", detail: "Recibe y envía mensajes." };
    case "PENDING":
      return { label: "Falta terminar en Meta", tone: "warning", detail: "Meta todavía no lo da por listo para enviar." };
    case "RESTRICTED":
      return {
        label: "Restringido por Meta",
        tone: "danger",
        detail: "No puedes iniciar conversaciones nuevas hasta que Meta levante la restricción.",
      };
    case "DISCONNECTED":
      return { label: "Desconectado", tone: "neutral", detail: "No recibe ni envía mensajes." };
    default:
      return { label: status ?? "Sin estado", tone: "neutral" };
  }
}

/** Estado que devuelve Meta para el número (campo `status` del teléfono). */
export function metaPhoneStatusToNumberStatus(status: string | null | undefined): "PENDING" | "CONNECTED" | "RESTRICTED" {
  const value = (status ?? "").toUpperCase();
  if (value === "CONNECTED") return "CONNECTED";
  if (value === "RESTRICTED" || value === "FLAGGED" || value === "BANNED" || value === "RATE_LIMITED") return "RESTRICTED";
  return "PENDING";
}

// ───────────────────────── Estado de las plantillas ─────────────────────────

export interface TemplateStatusInput {
  status: string;
  rejectedReason?: string | null;
  pausedUntil?: Date | null;
  /** Para formatear la hora de la pausa en la zona de la organización. */
  timeZone?: string;
}

/** Motivos de rechazo de Meta en español. */
export function rejectionReasonText(reason: string | null | undefined): string | null {
  const value = (reason ?? "").trim().toUpperCase();
  switch (value) {
    case "ABUSIVE_CONTENT":
      return "el contenido incumple las políticas de WhatsApp";
    case "INCORRECT_CATEGORY":
      return "la categoría no corresponde al contenido";
    case "INVALID_FORMAT":
      return "el formato o los ejemplos de las variables no son válidos";
    case "SCAM":
      return "Meta la tomó por engañosa";
    case "PROMOTIONAL":
      return "tiene contenido promocional y estaba marcada como utilidad";
    case "TAG_CONTENT_MISMATCH":
      return "el contenido no coincide con la etiqueta elegida";
    case "NONE":
    case "":
      return null;
    default:
      return value.toLowerCase().replace(/_/g, " ");
  }
}

export function templateStatusText(input: TemplateStatusInput): DirectStatus {
  const status = input.status.toUpperCase();
  switch (status) {
    case "DRAFT":
      return { label: "Borrador", tone: "neutral", detail: "Todavía no se envió a revisión de Meta." };
    case "PENDING":
      return { label: "En revisión", tone: "info", detail: "Meta suele responder en minutos; a veces tarda hasta 24 horas." };
    case "APPROVED":
      return { label: "Aprobada", tone: "success", detail: "Ya puedes enviarla aunque la ventana de 24 horas esté cerrada." };
    case "REJECTED": {
      const reason = rejectionReasonText(input.rejectedReason);
      return {
        label: reason ? `Rechazada: ${reason}` : "Rechazada",
        tone: "danger",
        detail: "Corrige el texto y créala de nuevo: Meta no la enviará.",
      };
    }
    case "PAUSED": {
      const until = input.pausedUntil
        ? new Intl.DateTimeFormat("es-PE", {
            timeZone: input.timeZone ?? "America/Lima",
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(input.pausedUntil)
        : null;
      return {
        label: until ? `Pausada hasta ${until}` : "Pausada por baja calidad",
        tone: "warning",
        detail: "Muchas personas la bloquearon o la reportaron. Mientras esté pausada no se envía.",
      };
    }
    case "DISABLED":
      return { label: "Desactivada por Meta", tone: "danger", detail: "No se puede volver a usar: crea otra con texto distinto." };
    case "RETIRED":
      return { label: "Ya no existe en Meta", tone: "neutral", detail: "Alguien la borró desde WhatsApp Manager." };
    default:
      return { label: input.status, tone: "neutral" };
  }
}

/** Calidad de la plantilla (`quality_score.score`): GREEN | YELLOW | RED | UNKNOWN. */
export function templateQualityText(score: string | null | undefined): DirectStatus {
  switch ((score ?? "").toUpperCase()) {
    case "GREEN":
    case "HIGH":
      return { label: "Buena", tone: "success" };
    case "YELLOW":
    case "MEDIUM":
      return { label: "En observación", tone: "warning", detail: "Si empeora, Meta la pausa." };
    case "RED":
    case "LOW":
      return { label: "Baja", tone: "danger", detail: "Meta está por pausarla: cámbiale el texto o deja de usarla." };
    default:
      return { label: "Sin datos aún", tone: "neutral" };
  }
}

/** Estado que devuelve Meta para una plantilla → estado del sistema. */
export function metaTemplateStatusToLocal(status: string | null | undefined): "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "PAUSED":
      return "PAUSED";
    case "DISABLED":
      return "DISABLED";
    default:
      // PENDING, IN_APPEAL, PENDING_DELETION, SUBMITTED… siguen a la espera de Meta.
      return "PENDING";
  }
}

/** Categoría en lenguaje directo, con la consecuencia de costo. */
export function categoryText(category: string | null | undefined): DirectStatus {
  switch ((category ?? "").toUpperCase()) {
    case "MARKETING":
      return { label: "Marketing", tone: "info", detail: "Ofertas o retomar a alguien que no compró. Siempre se cobra." };
    case "UTILITY":
      return { label: "Utilidad", tone: "info", detail: "Avisos sobre algo que la persona ya pidió. Gratis si la ventana de 24 horas está abierta." };
    case "AUTHENTICATION":
      return { label: "Códigos de acceso", tone: "info", detail: "Claves de un solo uso." };
    default:
      return { label: category ?? "Sin categoría", tone: "neutral" };
  }
}
