import "server-only";

import { MetaApiError } from "./errors";

/**
 * Cliente de la Graph API de Meta (WhatsApp Cloud API).
 *
 * Único lugar del sistema que habla con `graph.facebook.com`. Todas las
 * funciones reciben el token ya descifrado; el token nunca sale al navegador.
 *
 * Referencias:
 * - Mensajes: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 * - Números:  https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers
 * - Medios:   https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
 * - Plantillas: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/
 */

const DEFAULT_VERSION = "v24.0";
const GRAPH_HOST = "https://graph.facebook.com";
/** Ninguna llamada a Meta debe colgar un bucle de fondo ni una acción de pantalla. */
const TIMEOUT_MS = 20_000;

export function graphVersion(): string {
  const configured = process.env.META_GRAPH_API_VERSION?.trim();
  if (!configured) return DEFAULT_VERSION;
  return configured.startsWith("v") ? configured : `v${configured}`;
}

function graphUrl(path: string, query?: Record<string, string | undefined>): string {
  const url = new URL(`${GRAPH_HOST}/${graphVersion()}/${path.replace(/^\//, "")}`);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, value);
  }
  return url.toString();
}

async function readBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

async function graphFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw MetaApiError.network(error);
  }
}

interface RequestInput {
  token: string;
  path: string;
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string | undefined>;
  body?: unknown;
}

async function graphRequest<T>(input: RequestInput): Promise<T> {
  if (!input.token) {
    throw new MetaApiError({ message: "Falta el token de Meta para esta llamada", code: 190, httpStatus: 401 });
  }
  const response = await graphFetch(graphUrl(input.path, input.query), {
    method: input.method ?? "GET",
    headers: {
      authorization: `Bearer ${input.token}`,
      ...(input.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const body = await readBody(response);
  if (!response.ok) throw MetaApiError.fromResponse(response.status, body);
  return body as T;
}

// ───────────────────────── Números ─────────────────────────

export interface MetaPhoneNumber {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  /** GREEN | YELLOW | RED | UNKNOWN | NA */
  quality_rating?: string;
  /** TIER_50 | TIER_250 | TIER_1K | TIER_10K | TIER_100K | TIER_UNLIMITED */
  messaging_limit_tier?: string;
  /** CONNECTED | PENDING | FLAGGED | RESTRICTED | MIGRATED | BANNED… */
  status?: string;
}

const PHONE_FIELDS = "display_phone_number,verified_name,quality_rating,messaging_limit_tier,status";

export function getPhoneNumber(token: string, phoneNumberId: string): Promise<MetaPhoneNumber> {
  return graphRequest<MetaPhoneNumber>({ token, path: phoneNumberId, query: { fields: PHONE_FIELDS } });
}

export interface MetaWaba {
  id: string;
  name?: string;
  currency?: string;
  timezone_id?: string;
  /** APPROVED | PENDING | REJECTED */
  account_review_status?: string;
  message_template_namespace?: string;
}

export function getWaba(token: string, wabaId: string): Promise<MetaWaba> {
  return graphRequest<MetaWaba>({
    token,
    path: wabaId,
    query: { fields: "id,name,currency,timezone_id,account_review_status,message_template_namespace" },
  });
}

/**
 * Suscribe la app a los webhooks de la WABA. Sin esto Meta no envía nada.
 * POST /<WABA_ID>/subscribed_apps
 */
export async function subscribeApp(token: string, wabaId: string): Promise<void> {
  const response = await graphRequest<{ success?: boolean }>({ token, path: `${wabaId}/subscribed_apps`, method: "POST" });
  if (response?.success === false) {
    throw new MetaApiError({ message: "Meta no aceptó suscribir la app a esta cuenta de WhatsApp", httpStatus: 200 });
  }
}

/**
 * Registra el número en la Cloud API con un PIN de verificación en dos pasos.
 * POST /<PHONE_NUMBER_ID>/register
 */
export async function registerPhone(token: string, phoneNumberId: string, pin: string): Promise<void> {
  await graphRequest<{ success?: boolean }>({
    token,
    path: `${phoneNumberId}/register`,
    method: "POST",
    body: { messaging_product: "whatsapp", pin },
  });
}

// ───────────────────────── Mensajes ─────────────────────────

export interface MetaTextPayload {
  type: "text";
  to: string;
  text: { body: string; preview_url?: boolean };
}

export interface MetaTemplateParameter {
  type: "text";
  text: string;
}

export interface MetaTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string;
  parameters: MetaTemplateParameter[];
}

export interface MetaTemplatePayload {
  type: "template";
  to: string;
  template: {
    name: string;
    language: { code: string };
    components?: MetaTemplateComponent[];
  };
}

export interface MetaInteractivePayload {
  type: "interactive";
  to: string;
  interactive: {
    type: "button";
    body: { text: string };
    action: { buttons: { type: "reply"; reply: { id: string; title: string } }[] };
  };
}

export type MetaMessagePayload = MetaTextPayload | MetaTemplatePayload | MetaInteractivePayload;

interface SendMessageResponse {
  messages?: { id?: string; message_status?: string }[];
}

/** Envía un mensaje y devuelve el wamid que Meta asigna. */
export async function sendMessage(token: string, phoneNumberId: string, payload: MetaMessagePayload): Promise<string> {
  const response = await graphRequest<SendMessageResponse>({
    token,
    path: `${phoneNumberId}/messages`,
    method: "POST",
    body: { messaging_product: "whatsapp", recipient_type: "individual", ...payload },
  });
  const wamid = response.messages?.[0]?.id;
  if (!wamid) {
    throw new MetaApiError({ message: "Meta aceptó el mensaje pero no devolvió su identificador", httpStatus: 200 });
  }
  return wamid;
}

/** Marca un mensaje entrante como leído (doble check azul). Best effort. */
export async function markAsRead(token: string, phoneNumberId: string, wamid: string): Promise<void> {
  await graphRequest<{ success?: boolean }>({
    token,
    path: `${phoneNumberId}/messages`,
    method: "POST",
    body: { messaging_product: "whatsapp", status: "read", message_id: wamid },
  });
}

// ───────────────────────── Medios ─────────────────────────

export interface MetaMedia {
  id?: string;
  url: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
}

/** Paso 1: la URL de descarga vive 5 minutos y exige el mismo token. */
export function getMediaUrl(token: string, mediaId: string): Promise<MetaMedia> {
  return graphRequest<MetaMedia>({ token, path: mediaId });
}

/** Paso 2: descarga el archivo. La URL ya viene firmada pero pide el token igual. */
export async function downloadMedia(token: string, url: string): Promise<Buffer> {
  const response = await graphFetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw MetaApiError.fromResponse(response.status, await readBody(response));
  return Buffer.from(await response.arrayBuffer());
}

// ───────────────────────── Plantillas ─────────────────────────

export interface MetaTemplateComponentDefinition {
  type: string;
  format?: string;
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: { type: string; text: string; url?: string }[];
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  /** MARKETING | UTILITY | AUTHENTICATION */
  category?: string;
  /** APPROVED | PENDING | REJECTED | PAUSED | DISABLED | IN_APPEAL… */
  status?: string;
  rejected_reason?: string;
  quality_score?: { score?: string; reasons?: string[] };
  components?: MetaTemplateComponentDefinition[];
}

/** Lista todas las plantillas de la WABA, siguiendo la paginación. */
export async function listTemplates(token: string, wabaId: string): Promise<MetaTemplate[]> {
  const all: MetaTemplate[] = [];
  let after: string | undefined;
  // Tope de seguridad: 20 páginas de 100 alcanzan de sobra para una WABA.
  for (let page = 0; page < 20; page += 1) {
    const response = await graphRequest<{ data?: MetaTemplate[]; paging?: { cursors?: { after?: string }; next?: string } }>({
      token,
      path: `${wabaId}/message_templates`,
      query: {
        fields: "id,name,language,category,status,rejected_reason,quality_score,components",
        limit: "100",
        after,
      },
    });
    all.push(...(response.data ?? []));
    after = response.paging?.next ? response.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return all;
}

export interface CreateTemplateBody {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: MetaTemplateComponentDefinition[];
}

export interface CreateTemplateResponse {
  id: string;
  status?: string;
  category?: string;
}

export function createTemplate(token: string, wabaId: string, body: CreateTemplateBody): Promise<CreateTemplateResponse> {
  return graphRequest<CreateTemplateResponse>({ token, path: `${wabaId}/message_templates`, method: "POST", body });
}

/** Borra la plantilla en todos sus idiomas. Meta la elimina por nombre. */
export async function deleteTemplate(token: string, wabaId: string, name: string): Promise<void> {
  await graphRequest<{ success?: boolean }>({
    token,
    path: `${wabaId}/message_templates`,
    method: "DELETE",
    query: { name },
  });
}

// ───────────────────────── OAuth (Embedded Signup) ─────────────────────────

export interface ExchangedToken {
  accessToken: string;
  /** Segundos de vida; los tokens de Embedded Signup suelen ser de larga duración. */
  expiresIn: number | null;
}

/**
 * Canjea el `code` de Embedded Signup por un token de negocio.
 * GET /oauth/access_token?client_id&client_secret&code (sin redirect_uri).
 */
export async function exchangeCodeForToken(code: string): Promise<ExchangedToken> {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new MetaApiError({ message: "Faltan META_APP_ID y META_APP_SECRET: no se puede completar la conexión", httpStatus: 0 });
  }
  const url = graphUrl("oauth/access_token", { client_id: appId, client_secret: appSecret, code });
  const response = await graphFetch(url, { method: "GET" });
  const body = await readBody(response);
  if (!response.ok) throw MetaApiError.fromResponse(response.status, body);
  const parsed = body as { access_token?: string; expires_in?: number };
  if (!parsed?.access_token) {
    throw new MetaApiError({ message: "Meta no devolvió el token de acceso", httpStatus: response.status });
  }
  return { accessToken: parsed.access_token, expiresIn: typeof parsed.expires_in === "number" ? parsed.expires_in : null };
}
