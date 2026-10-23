/**
 * SPEC-086: venta enviada en DITO que no llegó a Máximo. Módulo puro: lo usa
 * la sincronización y se prueba sin red ni base de datos.
 *
 * Máximo publica su historial por importaciones de un CSV, no al instante.
 * Una venta recién enviada puede no estar todavía; solo es alerta cuando
 * Máximo ya importó datos posteriores al envío y aun así no la tiene.
 */

/** Margen para que Máximo tome la venta después de enviada. */
export const AGR_MISSING_GRACE_HOURS = 2;

export function isSentOrderMissingFromMaximo(input: {
  status: string;
  /** Cuándo la venta pasó a enviada (`statusUpdatedAt`). */
  sentAt: Date;
  /** Importación de Máximo más reciente vista en la consulta. */
  sourceImportedAt: Date | null;
}): boolean {
  if (input.status !== "SENT" || !input.sourceImportedAt) return false;
  return (
    input.sourceImportedAt.getTime() - input.sentAt.getTime() >=
    AGR_MISSING_GRACE_HOURS * 60 * 60 * 1000
  );
}
