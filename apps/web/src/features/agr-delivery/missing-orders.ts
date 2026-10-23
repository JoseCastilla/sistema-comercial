/**
 * SPEC-086: venta enviada en DITO que no llegó a Máximo. Módulo puro: lo usa
 * la sincronización y se prueba sin red ni base de datos.
 *
 * Máximo publica su historial por importaciones de un CSV, no al instante, y
 * ese CSV solo cubre el mes en curso.
 * Solo es alerta lo enviado dentro de esa cobertura, cuando Máximo ya importó
 * datos posteriores al envío y aun así no la tiene.
 */

import { getOrderPeriodRange } from "@repo/validation";

/** Margen para que Máximo tome la venta después de enviada. */
export const AGR_MISSING_GRACE_HOURS = 2;

/**
 * Desde cuándo cubre el historial: el inicio del mes de la importación, en
 * hora de Lima, o antes si alguna toma devuelta en la consulta lo prueba.
 *
 * Validado el 23/10/2026 con ventas cerradas de producción: el historial
 * importado ese día traía ventas del 1 al 23 de octubre y ninguna del 26, 29
 * o 30 de septiembre. Con solo las tomas devueltas no basta: la corrida ya no
 * pregunta por lo terminado y lo que vuelve es lo reciente.
 */
export function resolveAgrCoverageFrom(input: {
  oldestTakenAt: Date | null;
  sourceImportedAt: Date | null;
}): Date | null {
  const byImport = input.sourceImportedAt
    ? getOrderPeriodRange("MONTH", input.sourceImportedAt).monthStart
    : null;
  if (!byImport) return input.oldestTakenAt;
  if (!input.oldestTakenAt) return byImport;
  return input.oldestTakenAt < byImport ? input.oldestTakenAt : byImport;
}

export function isSentOrderMissingFromMaximo(input: {
  status: string;
  /** Cuándo la venta pasó a enviada (`statusUpdatedAt`). */
  sentAt: Date;
  /** Importación de Máximo más reciente vista en la consulta. */
  sourceImportedAt: Date | null;
  /**
   * Toma más antigua entre los pedidos que Máximo sí devolvió en la consulta:
   * desde ahí cubre su historial. Lo enviado antes no puede estar.
   */
  coverageFrom: Date | null;
}): boolean {
  if (input.status !== "SENT" || !input.sourceImportedAt) return false;
  if (!input.coverageFrom || input.sentAt < input.coverageFrom) return false;
  return (
    input.sourceImportedAt.getTime() - input.sentAt.getTime() >=
    AGR_MISSING_GRACE_HOURS * 60 * 60 * 1000
  );
}
