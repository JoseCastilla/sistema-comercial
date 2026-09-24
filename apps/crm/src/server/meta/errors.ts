/**
 * Errores de la Graph API de Meta y su traducción a lenguaje directo.
 * Módulo puro (sin red ni base de datos) para poder probarlo.
 *
 * Códigos según https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export type MetaErrorKind = "RETRY" | "RATE_LIMIT" | "PERMANENT" | "WINDOW_CLOSED" | "MARKETING_LIMIT" | "AUTH";

export interface ClassifiedMetaError {
  kind: MetaErrorKind;
  /** Consecuencia operativa, sin jerga. */
  userMessage: string;
  code: number | null;
}

interface GraphErrorBody {
  message?: unknown;
  type?: unknown;
  code?: unknown;
  error_subcode?: unknown;
  error_data?: { details?: unknown } | null;
  fbtrace_id?: unknown;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export class MetaApiError extends Error {
  readonly code: number | null;
  readonly subcode: number | null;
  readonly details: string | null;
  readonly httpStatus: number;
  readonly type: string | null;
  readonly fbtraceId: string | null;

  constructor(input: {
    message: string;
    code?: number | null;
    subcode?: number | null;
    details?: string | null;
    httpStatus?: number;
    type?: string | null;
    fbtraceId?: string | null;
  }) {
    super(input.message);
    this.name = "MetaApiError";
    this.code = input.code ?? null;
    this.subcode = input.subcode ?? null;
    this.details = input.details ?? null;
    this.httpStatus = input.httpStatus ?? 0;
    this.type = input.type ?? null;
    this.fbtraceId = input.fbtraceId ?? null;
  }

  /** Construye el error a partir de la respuesta JSON `{ error: {...} }` de Meta. */
  static fromResponse(httpStatus: number, body: unknown): MetaApiError {
    const error: GraphErrorBody =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "object"
        ? ((body as { error: GraphErrorBody }).error ?? {})
        : {};
    return new MetaApiError({
      message: asText(error.message) ?? `Meta respondió HTTP ${httpStatus}`,
      code: asNumber(error.code),
      subcode: asNumber(error.error_subcode),
      details: asText(error.error_data?.details),
      httpStatus,
      type: asText(error.type),
      fbtraceId: asText(error.fbtrace_id),
    });
  }

  /** Fallo de red o tiempo de espera: no hubo respuesta de Meta. */
  static network(cause: unknown): MetaApiError {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return new MetaApiError({ message: `No se pudo conectar con Meta: ${reason}`, httpStatus: 0 });
  }
}

const PERMISSION_MESSAGE = "La app de Meta no tiene permiso para esta acción: revisa los permisos del token";
const NOT_ON_WHATSAPP = "El número no está en WhatsApp";
const NOT_REGISTERED = "El número no está registrado en la Cloud API: regístralo antes de enviar";

/** Tabla de códigos conocidos → tipo y mensaje directo. */
const KNOWN: Record<number, [MetaErrorKind, string]> = {
  0: ["AUTH", "Meta no reconoce el token: vuelve a conectar el número"],
  102: ["AUTH", "La sesión con Meta venció: vuelve a conectar el número"],
  190: ["AUTH", "El token de Meta venció o fue revocado"],
  3: ["AUTH", PERMISSION_MESSAGE],
  10: ["AUTH", PERMISSION_MESSAGE],
  131005: ["AUTH", PERMISSION_MESSAGE],
  1: ["RETRY", "Meta no pudo procesar la petición; se volverá a intentar"],
  2: ["RETRY", "Meta está saturado o en mantenimiento; se volverá a intentar"],
  131000: ["RETRY", "Meta falló al enviar el mensaje; se volverá a intentar"],
  131016: ["RETRY", "El servicio de Meta no está disponible; se volverá a intentar"],
  131057: ["RETRY", "La cuenta de WhatsApp está en mantenimiento; se volverá a intentar"],
  133004: ["RETRY", "El servidor de Meta no está disponible; se volverá a intentar"],
  133015: ["RETRY", "El número se borró hace poco en Meta: espera 5 minutos"],
  4: ["RATE_LIMIT", "La app llegó al límite de llamadas a Meta; se volverá a intentar en unos minutos"],
  17: ["RATE_LIMIT", "Se hicieron demasiadas llamadas a Meta; se volverá a intentar en unos minutos"],
  32: ["RATE_LIMIT", "Se hicieron demasiadas llamadas a Meta; se volverá a intentar en unos minutos"],
  613: ["RATE_LIMIT", "Se hicieron demasiadas llamadas a Meta; se volverá a intentar en unos minutos"],
  80007: ["RATE_LIMIT", "La cuenta de WhatsApp llegó a su límite de llamadas; se volverá a intentar"],
  130429: ["RATE_LIMIT", "Se envían demasiados mensajes por segundo; se volverá a intentar"],
  131056: ["RATE_LIMIT", "Se le enviaron demasiados mensajes a esta persona en poco tiempo; se volverá a intentar"],
  133008: ["RATE_LIMIT", "Demasiados intentos con el PIN: espera antes de volver a intentar"],
  133009: ["RATE_LIMIT", "Los intentos con el PIN fueron muy seguidos: espera antes de volver a intentar"],
  133016: ["RATE_LIMIT", "Demasiados registros del número en poco tiempo: Meta bloquea nuevos intentos por 72 horas"],
  131047: ["WINDOW_CLOSED", "Ya no puedes escribirle libremente: usa una plantilla"],
  131049: ["MARKETING_LIMIT", "Meta no entregó el mensaje: esta persona alcanzó su límite de marketing"],
  131050: ["MARKETING_LIMIT", "Esta persona pidió no recibir marketing por WhatsApp: no se le pueden enviar plantillas de marketing"],
  131026: ["PERMANENT", NOT_ON_WHATSAPP],
  470: ["PERMANENT", NOT_ON_WHATSAPP],
  33: ["PERMANENT", "Meta no encuentra ese número de WhatsApp: revisa el identificador"],
  100: ["PERMANENT", "Meta rechazó la petición: falta un dato o tiene un valor inválido"],
  131008: ["PERMANENT", "Meta rechazó la petición: falta un dato obligatorio"],
  131009: ["PERMANENT", "Meta rechazó la petición: un dato tiene un valor inválido"],
  131021: ["PERMANENT", "No puedes enviarle mensajes al mismo número que envía"],
  130403: ["PERMANENT", "Bloqueaste a esta persona en WhatsApp: desbloquéala para escribirle"],
  130497: ["PERMANENT", "Meta no permite que esta cuenta escriba a ese país"],
  131031: ["PERMANENT", "Meta restringió la cuenta por incumplir sus políticas"],
  368: ["PERMANENT", "Meta restringió la cuenta por incumplir sus políticas"],
  131037: ["PERMANENT", "El número no tiene un nombre visible aprobado por Meta"],
  131042: ["PERMANENT", "Hay un problema con el método de pago de la cuenta de WhatsApp"],
  131045: ["PERMANENT", NOT_REGISTERED],
  133010: ["PERMANENT", NOT_REGISTERED],
  131048: ["PERMANENT", "Meta bloqueó los envíos desde este número por su calidad"],
  131051: ["PERMANENT", "WhatsApp no admite este tipo de mensaje"],
  131052: ["PERMANENT", "No se pudo descargar el archivo que envió la persona"],
  131053: ["PERMANENT", "No se pudo subir el archivo: revisa el formato"],
  132000: ["PERMANENT", "La cantidad de variables no coincide con la plantilla"],
  132001: ["PERMANENT", "La plantilla no existe o no está aprobada en ese idioma"],
  132005: ["PERMANENT", "El texto de la plantilla es demasiado largo"],
  132007: ["PERMANENT", "La plantilla incumple las políticas de WhatsApp"],
  132012: ["PERMANENT", "Un valor de variable tiene un formato que la plantilla no admite"],
  132015: ["PERMANENT", "Meta pausó esta plantilla por baja calidad"],
  132016: ["PERMANENT", "Meta deshabilitó esta plantilla de forma definitiva"],
  133005: ["PERMANENT", "El PIN de verificación en dos pasos es incorrecto"],
  133006: ["PERMANENT", "El número necesita verificarse en Meta antes de registrarse"],
  135000: ["PERMANENT", "Meta devolvió un error desconocido: revisa los datos enviados"],
};

/** Clasifica cualquier error (de Meta o no) para decidir reintento y qué decirle a la persona. */
export function classifyMetaError(error: unknown): ClassifiedMetaError {
  if (!(error instanceof MetaApiError)) {
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "RETRY", userMessage: `Error inesperado al enviar; se volverá a intentar (${reason})`, code: null };
  }
  const code = error.code;
  if (code !== null) {
    const known = KNOWN[code];
    if (known) return { kind: known[0], userMessage: known[1], code };
    if (code >= 200 && code <= 299) return { kind: "AUTH", userMessage: PERMISSION_MESSAGE, code };
  }
  if (code === null && error.httpStatus === 0) {
    return { kind: "RETRY", userMessage: "No se pudo conectar con Meta; se volverá a intentar", code };
  }
  if (error.httpStatus >= 500) {
    return { kind: "RETRY", userMessage: "Meta respondió con un error temporal; se volverá a intentar", code };
  }
  return { kind: "PERMANENT", userMessage: `Meta rechazó la petición: ${error.details ?? error.message}`, code };
}

/** Texto para mostrar en pantalla: mensaje directo más el código, si Meta lo dio. */
export function describeMetaError(error: unknown): string {
  const classified = classifyMetaError(error);
  return classified.code === null ? classified.userMessage : `${classified.userMessage} (código ${classified.code})`;
}
