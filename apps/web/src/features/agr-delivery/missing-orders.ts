/**
 * SPEC-086: venta enviada en DITO que no llegó a Máximo. Módulo puro: lo usa
 * la sincronización y se prueba sin red ni base de datos.
 *
 * Máximo publica su historial por importaciones de un CSV, no al instante, y
 * ese CSV solo cubre los últimos días (el 23/10/2026, tomas desde el 16/10).
 * Solo es alerta lo enviado dentro de esa cobertura, cuando Máximo ya importó
 * datos posteriores al envío y aun así no la tiene.
 */

/** Margen para que Máximo tome la venta después de enviada. */
export const AGR_MISSING_GRACE_HOURS = 2;

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
