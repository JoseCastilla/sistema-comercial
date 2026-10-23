/**
 * SPEC-087: qué ventas vale la pena volver a consultar en Máximo. Módulo puro:
 * lo usa la sincronización y se prueba sin red ni base de datos.
 *
 * Cada corrida consulta como máximo `AGR_MAX_CONSULTED` ventas. Lo que ya no
 * puede cambiar no debe ocupar esos lugares.
 */

/** Estados de Máximo después de los cuales no hubo ningún evento (SPEC-029 §13). */
export const AGR_TERMINAL_STATES = [
  "ENTREGADO",
  "CERRADO",
  "RECHAZADO",
  "CANCELADO",
] as const;

/** Tope de consultas por corrida. */
export const AGR_MAX_CONSULTED = 250;

/** Días que una cancelada sin motivo sigue esperando a que Máximo lo diga. */
export const AGR_CANCELLED_LOOKUP_DAYS = 3;

/**
 * Días que una abierta que Máximo no tiene se sigue buscando. El estado lo
 * pone el asesor a mano: una venta enviada a logística puede seguir «abierta»
 * porque nadie la marcó, y entonces Máximo sí la tiene.
 */
export const AGR_OPEN_LOOKUP_DAYS = 3;

const dayMs = 24 * 60 * 60 * 1000;

export interface AgrConsultationCandidate {
  status: string;
  deliveryStatus: string;
  statusUpdatedAt: Date | null;
  registeredAt: Date;
  snapshot: {
    estadoPedido: string;
    motivoRechazo: string | null;
    submotivoRechazo: string | null;
    fetchedAt: Date;
  } | null;
  missing: { lastCheckedAt: Date } | null;
}

export function needsAgrConsultation(
  order: AgrConsultationCandidate,
  now: Date,
): boolean {
  // Entregada: no queda nada por saber.
  if (order.status === "CLOSED" || order.deliveryStatus === "DELIVERED") {
    return false;
  }
  // Abierta que Máximo nunca tuvo, registrada hace días: quedó sin enviar.
  if (
    order.status === "OPEN" &&
    !order.snapshot &&
    order.missing &&
    now.getTime() - order.registeredAt.getTime() > AGR_OPEN_LOOKUP_DAYS * dayMs
  ) {
    return false;
  }
  // Máximo ya cerró su recorrido: entregada, rechazada o cancelada.
  const state = order.snapshot?.estadoPedido.trim().toUpperCase();
  if (state && (AGR_TERMINAL_STATES as readonly string[]).includes(state)) {
    return false;
  }
  if (order.status === "CANCELLED") {
    // Ya se sabe por qué se canceló.
    if (order.snapshot?.motivoRechazo || order.snapshot?.submotivoRechazo) {
      return false;
    }
    /*
     * Sin motivo todavía, o Máximo no la tiene: una sola respuesta vacía no
     * prueba nada, porque Máximo publica por importaciones. Se le dan unos
     * días; después, no.
     */
    const cancelledAt = order.statusUpdatedAt ?? order.registeredAt;
    if (now.getTime() - cancelledAt.getTime() > AGR_CANCELLED_LOOKUP_DAYS * dayMs) {
      return false;
    }
  }
  return true;
}

/**
 * Orden de consulta: primero lo nunca consultado, después lo que lleva más
 * tiempo sin consultarse. Antes eran las 250 más antiguas por fecha de venta,
 * y lo atascado tapaba a lo nuevo.
 */
export function lastAgrConsultationAt(
  order: AgrConsultationCandidate,
): number {
  const times = [order.snapshot?.fetchedAt, order.missing?.lastCheckedAt]
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());
  return times.length > 0 ? Math.max(...times) : Number.NEGATIVE_INFINITY;
}

export function pickAgrConsultations<T extends AgrConsultationCandidate>(
  orders: T[],
  now: Date,
  limit = AGR_MAX_CONSULTED,
): T[] {
  return orders
    .filter((order) => needsAgrConsultation(order, now))
    .sort(
      (left, right) =>
        lastAgrConsultationAt(left) - lastAgrConsultationAt(right) ||
        left.registeredAt.getTime() - right.registeredAt.getTime(),
    )
    .slice(0, limit);
}
