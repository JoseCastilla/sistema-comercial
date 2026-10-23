/**
 * Lectura de `GET /api/order-history?q=<pedido>` de Máximo (AGR Delivery).
 * Módulo puro: lo usa la sincronización y se prueba sin red ni base de datos.
 *
 * La fuente devuelve un resumen del pedido y su historial de eventos. Aquí se
 * traduce al registro plano en `snake_case` que ya guardan las instantáneas y
 * que muestra la ficha del pedido (SPEC-075), para que nada aguas abajo cambie.
 *
 * Reglas aprendidas de 84 pedidos reales (23/10/2026, SPEC-029 §13):
 *  - El resumen (`estadoActual`, `motivoFinal`, `ultimaActualizacion`) es
 *    el evento de fecha mayor comparando la fecha como texto: «8:55 a.m.»
 *    queda después de «10:21 a.m.» porque "8" > "1". Explica los 84 casos y
 *    deja 23 resúmenes en un evento anterior, p. ej. AGENDADO cuando ya hubo
 *    ENTREGADO. Por eso manda el último evento por `seq`.
 *  - El arreglo de eventos llega con ese mismo orden de texto. `seq` nunca
 *    tuvo huecos ni retrocedió en la hora real, y desempata los eventos del
 *    mismo minuto.
 *  - Solo los eventos de falla traen motivo: NO ENTREGADO, PRECANCELADO,
 *    CANCELADO y RECHAZADO. Si después de una falla el pedido se reasigna y
 *    vuelve a AGENDADO, el estado actual no tiene motivo; la falla anterior
 *    se conserva aparte como «último intento fallido».
 */

export interface AgrDeliveryRecord {
  pedido: string | null;
  order_id: string;
  envio: string | null;
  estado_pedido: string;
  motivo_rechazo: string | null;
  submotivo_rechazo: string | null;
  fecha_entrega_pactada: string | null;
  fecha_entrega_real: string | null;
  fecha_toma_pedido: string | null;
  tipo_delivery: string | null;
  vendedor: string | null;
  nombre_vendedor: string | null;
  gestion_status: string | null;
  resultado: string | null;
  proxima_accion: string | null;
  fecha_compromiso: string | null;
  gestion_updated_at: string | null;
  updated_by_name: string | null;
  [key: string]: unknown;
}

export interface AgrOrderHistoryEvent {
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

const invalidResponse = "La fuente logística devolvió una respuesta inválida.";

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim()))
    return Number(value.trim());
  return null;
}

function parseEvent(
  value: unknown,
  index: number,
): AgrOrderHistoryEvent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const estado = readString(raw.estado);
  if (!estado) return null;
  return {
    // Sin `seq`, el evento conserva el lugar en que llegó.
    seq: readNumber(raw.seq) ?? index + 1,
    estado: estado.toUpperCase(),
    fecha: readString(raw.fecha),
    motivo: readString(raw.motivo),
    submotivo: readString(raw.submotivo),
    usuario: readString(raw.usuario),
    tiempo_hrs: readString(raw.tiempoHrs),
    distancia: readString(raw.distancia),
    comentario: readString(raw.comentario),
  };
}

function describeEvent(event: AgrOrderHistoryEvent): string {
  return [event.estado, event.motivo, event.submotivo, event.fecha]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Devuelve el registro del pedido, `null` si la fuente dice que no existe
 * (`found: false`) y lanza si la respuesta no tiene la forma esperada.
 */
export function parseAgrOrderHistory(
  payload: unknown,
): AgrDeliveryRecord | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(invalidResponse);
  }
  const body = payload as Record<string, unknown>;
  if (body.ok !== true) throw new Error(invalidResponse);
  if (body.found !== true) return null;
  const order =
    body.order && typeof body.order === "object" && !Array.isArray(body.order)
      ? (body.order as Record<string, unknown>)
      : null;
  const orderId = order ? readString(order.orderId) : null;
  if (!order || !orderId) throw new Error(invalidResponse);

  const events = (Array.isArray(body.events) ? body.events : [])
    .map(parseEvent)
    .filter((event): event is AgrOrderHistoryEvent => event !== null)
    .sort((left, right) => left.seq - right.seq);
  const last = events.at(-1) ?? null;

  // Sin eventos solo queda el resumen; con eventos, manda el último.
  const status = last?.estado ?? readString(order.estadoActual)?.toUpperCase();
  if (!status) throw new Error(invalidResponse);
  const motivo = last ? last.motivo : readString(order.motivoFinal);
  const submotivo = last ? last.submotivo : readString(order.submotivoFinal);

  const lastFailure = [...events].reverse().find((event) => event.motivo);
  const delivered =
    status === "ENTREGADO"
      ? [...events].reverse().find((event) => event.estado === "ENTREGADO")
      : undefined;

  return {
    pedido: readString(order.pedido),
    order_id: orderId,
    envio: null,
    estado_pedido: status,
    motivo_rechazo: motivo,
    submotivo_rechazo: submotivo,
    // La falla anterior solo se repite cuando el estado actual no la dice.
    ultimo_intento_fallido:
      lastFailure && lastFailure !== last ? describeEvent(lastFailure) : null,
    intentos_no_entregado:
      events.length > 0
        ? events.filter((event) => event.estado === "NO ENTREGADO").length
        : readNumber(order.intentosNoEntregado),
    recorrido: events.map((event) => event.estado).join(" › ") || null,
    ultima_actualizacion: last?.fecha ?? readString(order.ultimaActualizacion),
    fecha_entrega_pactada: readString(order.fechaEntregaPactada),
    fecha_entrega_real: delivered?.fecha ?? null,
    fecha_toma_pedido: readString(order.fechaToma),
    tipo_delivery: readString(order.tipoDelivery),
    opcion_envio: readString(order.opcionEnvio),
    almacen: readString(order.almacen),
    entidad: readString(order.entity),
    historial: events,
    // El historial no trae vendedor ni la gestión interna de Máximo.
    vendedor: null,
    nombre_vendedor: null,
    gestion_status: null,
    resultado: null,
    proxima_accion: null,
    fecha_compromiso: null,
    gestion_updated_at: null,
    updated_by_name: null,
  };
}

/**
 * Hora de la importación de Máximo que respondió (`freshness.imported_at`).
 * Solo viene cuando encuentra el pedido; sin ella no se sabe qué tan nuevos
 * son los datos.
 */
export function readAgrSourceImportedAt(payload: unknown): Date | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const freshness = (payload as Record<string, unknown>).freshness;
  if (!freshness || typeof freshness !== "object") return null;
  const value = readString((freshness as Record<string, unknown>).imported_at);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const agrMonths: Record<string, number> = {
  ene: 0,
  jan: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  aug: 7,
  sep: 8,
  set: 8,
  oct: 9,
  nov: 10,
  dic: 11,
  dec: 11,
};

/**
 * Fecha de Máximo, «oct 22, 2026 2:47 p.m.», en hora de Lima (UTC−5, sin
 * horario de verano). Sin hora, es el inicio del día.
 */
export function parseAgrDateTime(value: unknown): Date | null {
  const text = readString(value);
  if (!text) return null;
  const match = text.match(
    /^(\w{3})\w* (\d{1,2}), (\d{4})(?: (\d{1,2}):(\d{2}) ?(a|p)\.? ?m\.?)?$/i,
  );
  if (!match) return null;
  const month = agrMonths[(match[1] ?? "").toLowerCase()];
  if (month === undefined) return null;
  let hour = match[4] ? Number(match[4]) % 12 : 0;
  if (match[6]?.toLowerCase() === "p") hour += 12;
  const minute = match[5] ? Number(match[5]) : 0;
  return new Date(
    Date.UTC(Number(match[3]), month, Number(match[2]), hour + 5, minute),
  );
}
