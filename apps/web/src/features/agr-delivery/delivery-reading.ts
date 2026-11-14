/**
 * SPEC-089: la lectura de la foto de Máximo para la ficha del pedido y la de
 * Recupero de ventas. Módulo puro: se prueba sin base de datos ni red.
 *
 * Desde el 23/10/2026 la foto guarda `historial`, los eventos que devuelve
 * Máximo (ver `order-history.ts`). SPEC-075 BR-007 lo ocultaba porque «los
 * eventos ya se resumen en Recorrido»; José (13/11/2026) pidió ver cada
 * visita con lo que anotó quien la hizo: «no debemos guiarnos solo por lo que
 * dice el motorizado».
 *
 * `usuario`, `distancia`, `tiempo_hrs` y `comentario` son textos libres que
 * nadie ha visto con datos reales: se muestran tal cual, recortados, y lo
 * vacío se omite. No se convierten a número ni se les supone unidad.
 */

import { parseAgrDateTime, readString } from "./order-history";

/** Un evento del historial, listo para mostrar. */
export interface AgrDeliveryStep {
  seq: number;
  /** Estado de Máximo como texto de la plataforma: «No entregado». */
  stateLabel: string;
  /** Fecha en hora de Lima; el texto original si no se pudo leer. */
  dateLabel: string | null;
  /** «MOTIVO · SUBMOTIVO» tal como llegan. */
  reason: string | null;
  comment: string | null;
  /** «Registró X · distancia Y · tiempo Z», solo con lo que venga. */
  meta: string | null;
}

export interface AgrDeliveryReading {
  stateLabel: string;
  /** Cuándo fue el último movimiento. */
  lastMovementLabel: string | null;
  /** Motivo y submotivo finales, en una línea. */
  reason: string | null;
  /** El número de pedido de Máximo, para reagendar. */
  pedido: string | null;
  /** La foto trae eventos (fotos del 23/10/2026 en adelante). */
  hasHistory: boolean;
  /** «2 visitas fallidas» o «Máximo dice 3 visitas; registra 2». */
  visitsSummary: string | null;
  /** El motivo final afirma más visitas de las que registra el historial. */
  visitsMismatch: boolean;
  /** Una entrada por cada NO ENTREGADO, en orden. */
  visits: AgrDeliveryStep[];
  /** Cómo terminó: rechazo, cancelación o entrega. */
  closure: AgrDeliveryClosure | null;
  /** La secuencia completa, para «Ver todos los movimientos». */
  movements: AgrDeliveryStep[];
}

export interface AgrDeliveryClosure {
  /** «Precancelado → Cancelado», «Rechazado», «Entregado». */
  stateLabel: string;
  dateLabel: string | null;
  reason: string | null;
  comments: string[];
  meta: string | null;
}

/** Claves de la foto que este bloque ya muestra con su propia forma. */
export const agrDeliveryReadingKeys: ReadonlySet<string> = new Set([
  "estado_pedido",
  "motivo_rechazo",
  "submotivo_rechazo",
  "ultimo_intento_fallido",
  "intentos_no_entregado",
  "recorrido",
  "ultima_actualizacion",
  "pedido",
]);

const visitState = "NO ENTREGADO";
/** Estados que cierran la entrega: lo que pasó después de las visitas. */
const closingStates = new Set([
  "RECHAZADO",
  "CANCELADO",
  "PRECANCELADO",
  "ENTREGADO",
]);

/* Límites de recorte: la ficha mide ~258 px y también se usa en celular. */
const visitCommentLimit = 200;
const movementCommentLimit = 400;
const shortTextLimit = 40;

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

interface HistoryEvent {
  seq: number;
  estado: string;
  fecha: string | null;
  motivo: string | null;
  submotivo: string | null;
  usuario: string | null;
  tiempo_hrs: string | null;
  distancia: string | null;
  comentario: string | null;
}

/** Espacios repetidos fuera; si pasa del límite, se corta en una palabra. */
export function clipAgrText(value: unknown, limit: number): string | null {
  const text = readString(value)?.replace(/\s+/g, " ");
  if (!text) return null;
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** «NO ENTREGADO» → «No entregado». Lo desconocido, con la misma regla. */
export function formatAgrStateLabel(state: string): string {
  const text = state.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-PE");
  return text
    ? `${text.charAt(0).toLocaleUpperCase("es-PE")}${text.slice(1)}`
    : state;
}

/**
 * Fecha de Máximo («nov 11, 2026 12:21 a.m.») con el formato del resto de la
 * ficha («11/11/2026, 00:21»). Si no se puede leer, el texto original.
 */
export function formatAgrDate(value: unknown): string | null {
  const text = readString(value);
  if (!text) return null;
  const date = parseAgrDateTime(text);
  if (!date) return clipAgrText(text, shortTextLimit);
  return /\d{1,2}:\d{2}/.test(text)
    ? dateTimeFormatter.format(date)
    : dateFormatter.format(date);
}

function readHistory(raw: Record<string, unknown> | null): HistoryEvent[] | null {
  const value = raw?.historial;
  if (!Array.isArray(value)) return null;
  return value
    .map((item, index): HistoryEvent | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const event = item as Record<string, unknown>;
      const estado = readString(event.estado);
      if (!estado) return null;
      const seq =
        typeof event.seq === "number" && Number.isFinite(event.seq)
          ? event.seq
          : index + 1;
      return {
        seq,
        estado: estado.toUpperCase(),
        fecha: readString(event.fecha),
        motivo: readString(event.motivo),
        submotivo: readString(event.submotivo),
        usuario: readString(event.usuario),
        // La foto guarda `tiempo_hrs`; la fuente lo manda como `tiempoHrs`.
        tiempo_hrs: readString(event.tiempo_hrs ?? event.tiempoHrs),
        distancia: readString(event.distancia),
        comentario: readString(event.comentario),
      };
    })
    .filter((event): event is HistoryEvent => event !== null)
    .sort((left, right) => left.seq - right.seq);
}

function joinReason(
  motivo: string | null | undefined,
  submotivo: string | null | undefined,
): string | null {
  return (
    [motivo, submotivo]
      .map((value) => readString(value))
      .filter(Boolean)
      .join(" · ") || null
  );
}

function describeMeta(event: HistoryEvent): string | null {
  const usuario = clipAgrText(event.usuario, shortTextLimit);
  const distancia = clipAgrText(event.distancia, shortTextLimit);
  const tiempo = clipAgrText(event.tiempo_hrs, shortTextLimit);
  return (
    [
      usuario ? `Registró ${usuario}` : null,
      distancia ? `distancia ${distancia}` : null,
      tiempo ? `tiempo ${tiempo}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null
  );
}

function toStep(event: HistoryEvent, commentLimit: number): AgrDeliveryStep {
  return {
    seq: event.seq,
    stateLabel: formatAgrStateLabel(event.estado),
    dateLabel: formatAgrDate(event.fecha),
    reason: joinReason(event.motivo, event.submotivo),
    comment: clipAgrText(event.comentario, commentLimit),
    meta: describeMeta(event),
  };
}

/**
 * Cuántas visitas fallidas registra Máximo y cuántas afirma el motivo final.
 * Hoy el único motivo que afirma un número es «CLIENTE AUSENTE EXCEDE 3
 * VISITAS»: de 80 pedidos con ese motivo en noviembre, 72 tenían 2.
 */
export function compareAgrVisits(
  events: ReadonlyArray<{ estado: string }>,
  finalReason: string | null | undefined,
): { registered: number; claimed: number | null; mismatch: boolean } {
  const registered = events.filter(
    (event) => event.estado.trim().toUpperCase() === visitState,
  ).length;
  const match = finalReason?.match(/EXCEDE\s+(\d+)\s+VISITAS?/i);
  const claimed = match ? Number(match[1]) : null;
  return {
    registered,
    claimed,
    mismatch: claimed !== null && registered < claimed,
  };
}

/** La frase de hechos, sin juicio. `null` si no hay nada que contar. */
export function describeAgrVisits(
  events: ReadonlyArray<{ estado: string }>,
  finalReason: string | null | undefined,
): string | null {
  const { registered, claimed, mismatch } = compareAgrVisits(
    events,
    finalReason,
  );
  if (mismatch && claimed !== null) {
    return `Máximo dice ${claimed} ${claimed === 1 ? "visita" : "visitas"}; registra ${registered}`;
  }
  if (registered === 0) return null;
  return registered === 1
    ? "1 visita fallida"
    : `${registered} visitas fallidas`;
}

function readClosure(events: HistoryEvent[]): AgrDeliveryClosure | null {
  const last = events.at(-1);
  if (!last || !closingStates.has(last.estado)) return null;
  const lastVisitIndex = events
    .map((event) => event.estado)
    .lastIndexOf(visitState);
  // Un precancelado después de la última visita es parte del mismo cierre.
  const steps = events
    .slice(lastVisitIndex + 1)
    .filter(
      (event) =>
        event === last ||
        (event.estado === "PRECANCELADO" && last.estado === "CANCELADO"),
    );
  const reasonSource =
    [...steps].reverse().find((event) => event.motivo || event.submotivo) ??
    last;
  const comments = [
    ...new Set(
      steps
        .map((event) => clipAgrText(event.comentario, visitCommentLimit))
        .filter((comment): comment is string => Boolean(comment)),
    ),
  ];
  const users = [
    ...new Set(
      steps
        .map((event) => clipAgrText(event.usuario, shortTextLimit))
        .filter((user): user is string => Boolean(user)),
    ),
  ];
  const distancia = clipAgrText(last.distancia, shortTextLimit);
  const tiempo = clipAgrText(last.tiempo_hrs, shortTextLimit);
  return {
    stateLabel: steps
      .map((event) => formatAgrStateLabel(event.estado))
      .join(" → "),
    dateLabel: formatAgrDate(last.fecha),
    reason: joinReason(reasonSource.motivo, reasonSource.submotivo),
    comments,
    meta:
      [
        users.length > 0 ? `Registró ${users.join(", ")}` : null,
        distancia ? `distancia ${distancia}` : null,
        tiempo ? `tiempo ${tiempo}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
  };
}

/**
 * Arma el bloque «Entrega según Máximo». Sin `historial` (fotos anteriores al
 * 23/10/2026 o respuesta sin eventos) queda cabecera, motivo y pedido.
 */
export function readAgrDeliveryReading(snapshot: {
  estadoPedido: string;
  motivoRechazo: string | null;
  submotivoRechazo: string | null;
  rawPayload: unknown;
}): AgrDeliveryReading {
  const raw =
    snapshot.rawPayload &&
    typeof snapshot.rawPayload === "object" &&
    !Array.isArray(snapshot.rawPayload)
      ? (snapshot.rawPayload as Record<string, unknown>)
      : null;
  const events = readHistory(raw) ?? [];
  const hasHistory = events.length > 0;
  const last = events.at(-1) ?? null;

  const state =
    readString(raw?.estado_pedido) ?? readString(snapshot.estadoPedido) ?? "";
  const reason = joinReason(
    readString(raw?.motivo_rechazo) ?? snapshot.motivoRechazo,
    readString(raw?.submotivo_rechazo) ?? snapshot.submotivoRechazo,
  );
  const pedidoValue = raw?.pedido;
  const pedido =
    typeof pedidoValue === "number" && Number.isFinite(pedidoValue)
      ? String(pedidoValue)
      : clipAgrText(pedidoValue, shortTextLimit);

  return {
    stateLabel: state ? formatAgrStateLabel(state) : "Sin estado",
    lastMovementLabel: formatAgrDate(
      last?.fecha ?? raw?.ultima_actualizacion,
    ),
    reason,
    pedido,
    hasHistory,
    visitsSummary: hasHistory ? describeAgrVisits(events, reason) : null,
    visitsMismatch: hasHistory && compareAgrVisits(events, reason).mismatch,
    visits: events
      .filter((event) => event.estado === visitState)
      .map((event) => toStep(event, visitCommentLimit)),
    closure: readClosure(events),
    movements: events.map((event) => toStep(event, movementCommentLimit)),
  };
}
