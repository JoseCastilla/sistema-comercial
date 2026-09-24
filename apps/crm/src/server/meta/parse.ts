/**
 * Lectura del cuerpo de los webhooks de Meta. Todo aquí es puro: recibe el
 * JSON tal como llega y devuelve la forma normalizada que usa el sistema.
 * Nada de red ni de base de datos, para poder probarlo con payloads reales.
 *
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return null;
}

/** Meta manda el timestamp en segundos, como texto. */
export function timestampToDate(value: unknown, fallback: Date = new Date()): Date {
  const seconds = Number(asString(value));
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return new Date(seconds * 1000);
}

// ───────────────────────── Cambios del webhook ─────────────────────────

export interface WebhookChange {
  field: string;
  value: Json;
  /** WABA a la que pertenece el cambio (entry[].id). */
  entryId: string | null;
}

/** Aplana `entry[].changes[]` conservando el id de la entrada. */
export function extractChanges(body: unknown): WebhookChange[] {
  const root = asObject(body);
  if (!root) return [];
  const changes: WebhookChange[] = [];
  for (const rawEntry of asArray(root.entry)) {
    const entry = asObject(rawEntry);
    if (!entry) continue;
    const entryId = asString(entry.id);
    for (const rawChange of asArray(entry.changes)) {
      const change = asObject(rawChange);
      const value = asObject(change?.value);
      if (!change || !value) continue;
      changes.push({ field: asString(change.field) ?? "desconocido", value, entryId });
    }
  }
  return changes;
}

// ───────────────────────── Mensajes entrantes ─────────────────────────

export interface ParsedMedia {
  /** id del archivo en Meta; hay que pedir su URL antes de descargarlo. */
  mediaId: string;
  mimeType: string | null;
  sha256: string | null;
  filename: string | null;
  caption: string | null;
}

export interface ParsedInboundMessage {
  externalId: string;
  /** phone_number_id del número del negocio que recibió el mensaje. */
  phoneNumberId: string;
  waUserId: string | null;
  phone: string | null;
  profileName: string | null;
  /** text, image, audio, video, document, sticker, location, interactive, button, reaction, contacts, unsupported */
  type: string;
  body: string | null;
  payload: Json;
  media: ParsedMedia | null;
  referral: Json | null;
  timestamp: Date;
  raw: Json;
}

const MEDIA_TYPES = ["image", "audio", "video", "document", "sticker"] as const;

function parseMedia(type: string, message: Json): ParsedMedia | null {
  if (!(MEDIA_TYPES as readonly string[]).includes(type)) return null;
  const media = asObject(message[type]);
  const mediaId = media ? asString(media.id) : null;
  if (!media || !mediaId) return null;
  return {
    mediaId,
    mimeType: asString(media.mime_type),
    sha256: asString(media.sha256),
    filename: asString(media.filename),
    caption: asString(media.caption),
  };
}

/** Texto que se muestra en la bandeja y con el que se detectan palabras de baja. */
function parseBody(type: string, message: Json): { body: string | null; payload: Json } {
  switch (type) {
    case "text":
      return { body: asString(asObject(message.text)?.body), payload: {} };
    case "image":
    case "audio":
    case "video":
    case "document":
    case "sticker": {
      const media = asObject(message[type]);
      return { body: media ? asString(media.caption) : null, payload: {} };
    }
    case "location": {
      const location = asObject(message.location);
      const name = location ? asString(location.name) ?? asString(location.address) : null;
      return {
        body: name,
        payload: {
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          name: location ? asString(location.name) : null,
          address: location ? asString(location.address) : null,
        },
      };
    }
    case "interactive": {
      const interactive = asObject(message.interactive);
      const kind = interactive ? asString(interactive.type) : null;
      const reply = asObject(interactive?.button_reply) ?? asObject(interactive?.list_reply);
      return {
        body: reply ? asString(reply.title) : null,
        payload: {
          interactiveKind: kind,
          replyId: reply ? asString(reply.id) : null,
          description: reply ? asString(reply.description) : null,
        },
      };
    }
    case "button": {
      // Botón de una plantilla: el texto es el que tocó la persona.
      const button = asObject(message.button);
      return {
        body: button ? asString(button.text) : null,
        payload: { payload: button ? asString(button.payload) : null },
      };
    }
    case "reaction": {
      const reaction = asObject(message.reaction);
      return {
        body: reaction ? asString(reaction.emoji) : null,
        payload: { reactedTo: reaction ? asString(reaction.message_id) : null },
      };
    }
    case "contacts": {
      const contacts = asArray(message.contacts);
      const names = contacts
        .map((item) => asString(asObject(asObject(item)?.name)?.formatted_name))
        .filter((name): name is string => Boolean(name));
      return { body: names.join(", ") || null, payload: { shared: contacts.length } };
    }
    case "order": {
      const order = asObject(message.order);
      return { body: null, payload: { catalogId: order ? asString(order.catalog_id) : null } };
    }
    default: {
      // `unsupported` trae el motivo dentro de errors[].
      const error = asObject(asArray(message.errors)[0]);
      return { body: error ? asString(error.title) : null, payload: {} };
    }
  }
}

/**
 * Convierte un cambio `messages` en los mensajes entrantes que trae.
 * Devuelve lista vacía si el cambio solo trae `statuses`.
 */
export function parseInboundMessages(value: Json): ParsedInboundMessage[] {
  const metadata = asObject(value.metadata);
  const phoneNumberId = metadata ? asString(metadata.phone_number_id) : null;
  if (!phoneNumberId) return [];

  const contact = asObject(asArray(value.contacts)[0]);
  const profile = contact ? asObject(contact.profile) : null;
  // Business-scoped user id: llega cuando la persona escribe sin exponer su número.
  const waUserId = contact ? asString(contact.user_id) : null;
  const waId = contact ? asString(contact.wa_id) : null;

  const parsed: ParsedInboundMessage[] = [];
  for (const rawMessage of asArray(value.messages)) {
    const message = asObject(rawMessage);
    const externalId = message ? asString(message.id) : null;
    if (!message || !externalId) continue;
    const type = asString(message.type) ?? "unsupported";
    const { body, payload } = parseBody(type, message);
    parsed.push({
      externalId,
      phoneNumberId,
      waUserId: waUserId && waUserId !== waId ? waUserId : null,
      phone: waId ?? asString(message.from),
      profileName: profile ? asString(profile.name) : null,
      type,
      body,
      payload,
      media: parseMedia(type, message),
      referral: asObject(message.referral),
      timestamp: timestampToDate(message.timestamp),
      raw: message,
    });
  }
  return parsed;
}

// ───────────────────────── Estados de entrega ─────────────────────────

export interface ParsedStatus {
  wamid: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  /** Estado crudo de Meta, por si llega uno que no mapeamos (p. ej. `deleted`). */
  rawStatus: string;
  at: Date;
  recipientPhone: string | null;
  errorCode: string | null;
  errorTitle: string | null;
  /** Objeto `conversation` de Meta (categoría y origen de la conversación). */
  conversation: Json | null;
  /** Objeto `pricing`: si se cobró y en qué categoría. */
  pricing: Json | null;
}

const STATUS_MAP: Record<string, ParsedStatus["status"]> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

export function parseStatuses(value: Json): ParsedStatus[] {
  const parsed: ParsedStatus[] = [];
  for (const rawStatusItem of asArray(value.statuses)) {
    const item = asObject(rawStatusItem);
    const wamid = item ? asString(item.id) : null;
    const rawStatus = item ? asString(item.status) : null;
    if (!item || !wamid || !rawStatus) continue;
    const mapped = STATUS_MAP[rawStatus.toLowerCase()];
    if (!mapped) continue;
    const error = asObject(asArray(item.errors)[0]);
    parsed.push({
      wamid,
      status: mapped,
      rawStatus,
      at: timestampToDate(item.timestamp),
      recipientPhone: asString(item.recipient_id),
      errorCode: error ? asString(error.code) : null,
      errorTitle: error
        ? asString(error.title) ?? asString(asObject(error.error_data)?.details) ?? asString(error.message)
        : null,
      conversation: asObject(item.conversation),
      pricing: asObject(item.pricing),
    });
  }
  return parsed;
}

// ───────────────────────── Plantillas ─────────────────────────

export interface ParsedTemplateUpdate {
  field: string;
  externalId: string | null;
  name: string | null;
  language: string | null;
  /** APPROVED | REJECTED | PAUSED | DISABLED | PENDING… tal como lo manda Meta. */
  event: string | null;
  rejectedReason: string | null;
  /** Categoría nueva cuando Meta reclasifica la plantilla. */
  newCategory: string | null;
  previousCategory: string | null;
  qualityScore: string | null;
  pausedUntil: Date | null;
  /** Momento del evento, para la clave de idempotencia. */
  at: Date;
}

function pausedUntilFrom(value: Json): Date | null {
  // Meta manda la duración de la pausa en `other_info` o en `disable_info`.
  const other = asObject(value.other_info);
  const expiration = asString(other?.expiration) ?? asString(asObject(value.disable_info)?.disable_date);
  if (expiration) {
    const seconds = Number(expiration);
    if (Number.isFinite(seconds) && seconds > 1_000_000_000) return new Date(seconds * 1000);
    const parsedDate = new Date(expiration);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
  }
  return null;
}

export function parseTemplateUpdate(field: string, value: Json): ParsedTemplateUpdate | null {
  const externalId = asString(value.message_template_id);
  const name = asString(value.message_template_name);
  if (!externalId && !name) return null;
  const quality = asString(value.new_quality_score) ?? asString(asObject(value.new_quality_score)?.score);
  const event = asString(value.event);
  return {
    field,
    externalId,
    name,
    language: asString(value.message_template_language),
    event,
    rejectedReason: asString(value.reason) ?? asString(value.rejected_reason),
    newCategory: asString(value.new_category) ?? asString(value.correct_category),
    previousCategory: asString(value.previous_category),
    qualityScore: quality,
    pausedUntil: event?.toUpperCase() === "PAUSED" ? pausedUntilFrom(value) : null,
    at: timestampToDate(value.timestamp),
  };
}

// ───────────────────────── Número y cuenta ─────────────────────────

export interface ParsedNumberUpdate {
  field: string;
  displayPhoneNumber: string | null;
  /** Para `phone_number_quality_update`: UPGRADE | DOWNGRADE | FLAGGED | UNFLAGGED. */
  event: string | null;
  currentLimit: string | null;
  /** Para `account_update`: la cuenta quedó restringida o baneada. */
  restricted: boolean;
  at: Date;
}

const RESTRICTING_EVENTS = ["ACCOUNT_RESTRICTION", "ACCOUNT_VIOLATION", "DISABLED_UPDATE", "ACCOUNT_DELETED", "FLAGGED"];

/** Meta manda `restriction_info` como lista o como objeto según el aviso. */
function hasInfo(value: unknown): boolean {
  return Boolean(asObject(value)) || asArray(value).length > 0;
}

export function parseNumberUpdate(field: string, value: Json): ParsedNumberUpdate {
  const event = asString(value.event);
  return {
    field,
    displayPhoneNumber: asString(value.display_phone_number),
    event,
    currentLimit: asString(value.current_limit),
    restricted:
      Boolean(event && RESTRICTING_EVENTS.includes(event.toUpperCase())) || hasInfo(value.restriction_info) || hasInfo(value.ban_info),
    at: timestampToDate(value.timestamp),
  };
}

/** El límite llega como «TIER_1K» o como «TIER_1K» dentro de current_limit. */
export function limitTierFrom(currentLimit: string | null): string | null {
  if (!currentLimit) return null;
  const upper = currentLimit.toUpperCase();
  return upper.startsWith("TIER_") ? upper : `TIER_${upper}`;
}

// ───────────────────────── Preferencias de la persona ─────────────────────────

export interface ParsedUserPreference {
  waId: string;
  /** marketing_messages */
  category: string | null;
  /** stop | resume */
  value: string | null;
  detail: string | null;
  at: Date;
}

export function parseUserPreferences(value: Json): ParsedUserPreference[] {
  const items = asArray(value.user_preferences);
  const parsed: ParsedUserPreference[] = [];
  for (const rawItem of items) {
    const item = asObject(rawItem);
    const waId = item ? asString(item.wa_id) : null;
    if (!item || !waId) continue;
    parsed.push({
      waId,
      category: asString(item.category),
      value: asString(item.value),
      detail: asString(item.detail),
      at: timestampToDate(item.timestamp),
    });
  }
  return parsed;
}

/** ¿Esta preferencia es una baja de marketing? */
export function isMarketingOptOut(preference: ParsedUserPreference): boolean {
  const category = (preference.category ?? "marketing_messages").toLowerCase();
  return category.includes("marketing") && (preference.value ?? "").toLowerCase() === "stop";
}

// ───────────────────────── Claves de idempotencia ─────────────────────────

/**
 * Un `WebhookEvent` por ítem, no por petición: Meta reenvía el mismo lote
 * cuando no recibe el 200 a tiempo y no se puede procesar dos veces.
 */
export function externalIdsFor(change: WebhookChange): { externalId: string; item: Json }[] {
  const { field, value } = change;
  const ids: { externalId: string; item: Json }[] = [];

  for (const message of parseInboundMessages(value)) {
    ids.push({ externalId: `msg:${message.externalId}`, item: value });
  }
  for (const status of parseStatuses(value)) {
    ids.push({ externalId: `status:${status.wamid}:${status.rawStatus}`, item: value });
  }
  if (ids.length) return ids;

  if (field.includes("template")) {
    const update = parseTemplateUpdate(field, value);
    if (update) {
      const key = update.externalId ?? `${update.name}:${update.language}`;
      const event = update.event ?? update.newCategory ?? update.qualityScore ?? "update";
      return [{ externalId: `template:${key}:${event}:${Math.floor(update.at.getTime() / 1000)}`, item: value }];
    }
  }
  if (field === "phone_number_quality_update" || field === "phone_number_name_update" || field === "account_update") {
    const update = parseNumberUpdate(field, value);
    const who = update.displayPhoneNumber ?? change.entryId ?? "cuenta";
    return [{ externalId: `phone:${who}:${update.event ?? field}:${Math.floor(update.at.getTime() / 1000)}`, item: value }];
  }
  if (field === "user_preferences") {
    return parseUserPreferences(value).map((preference) => ({
      externalId: `preference:${preference.waId}:${preference.value ?? "cambio"}:${Math.floor(preference.at.getTime() / 1000)}`,
      item: value,
    }));
  }

  // Cualquier otro cambio se guarda una vez, con la WABA y el momento de llegada.
  return [{ externalId: `${field}:${change.entryId ?? "sin-entrada"}:${Math.floor(timestampToDate(value.timestamp).getTime() / 1000)}`, item: value }];
}

/** phone_number_id al que apunta un cambio de tipo `messages`, si lo trae. */
export function phoneNumberIdOf(value: Json): string | null {
  return asString(asObject(value.metadata)?.phone_number_id);
}

/** Extensión del archivo a partir del tipo MIME que informa Meta. */
export function extensionForMime(mimeType: string | null | undefined, fallback = "bin"): string {
  const clean = (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/amr": "amr",
    "audio/aac": "aac",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
  };
  const match = known[clean];
  if (match) return match;
  const subtype = clean.split("/")[1];
  if (subtype && /^[a-z0-9]{1,6}$/.test(subtype)) return subtype;
  return fallback;
}
