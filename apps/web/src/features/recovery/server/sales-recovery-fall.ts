import "server-only";

import { salesRecoveryReasonOptions } from "@repo/validation";

import { describeAgrDeliveryRaw } from "@/features/orders/server/get-order-inbox";

const entryReasonLabels = new Map<string, string>(
  salesRecoveryReasonOptions.map((option) => [option.value, option.label]),
);

/** Lo que hay que leer de la venta para decir por qué se cayó. */
export const salesRecoveryFallSelect = {
  entryReason: true,
  entryObservation: true,
} as const;

export const salesRecoveryFallOrderSelect = {
  agrDeliverySnapshot: {
    select: {
      estadoPedido: true,
      motivoRechazo: true,
      submotivoRechazo: true,
      isRecoveryOpportunity: true,
    },
  },
} as const;

/**
 * Por qué se cayó la venta, en palabras del asesor (SPEC-063 BR-021, SPEC-067
 * BR-003): lo que sugiere la logística si el pedido es una entrega fallida
 * por gestionar; si no, el motivo con que se abrió el caso, y si el motivo es
 * «Otro», lo que se anotó al abrirlo. `maxLength` recorta la observación
 * donde el espacio es de una línea.
 */
export function describeSalesRecoveryFall(
  row: {
    entryReason: string | null;
    entryObservation: string | null;
    sourceDitoOrder: {
      agrDeliverySnapshot: {
        estadoPedido: string;
        motivoRechazo: string | null;
        submotivoRechazo: string | null;
        isRecoveryOpportunity: boolean;
      } | null;
    } | null;
  },
  maxLength = 80,
): string | null {
  const snapshot = row.sourceDitoOrder?.agrDeliverySnapshot;
  // SPEC-075: lo que dice Máximo, sin traducirlo.
  if (snapshot?.isRecoveryOpportunity) {
    return `Máximo: ${describeAgrDeliveryRaw(snapshot)}`;
  }
  if (row.entryReason === "OTRO" || !row.entryReason) {
    const observation = row.entryObservation?.trim() ?? "";
    if (!observation) return null;
    return observation.length > maxLength
      ? `${observation.slice(0, maxLength)}…`
      : observation;
  }
  return entryReasonLabels.get(row.entryReason) ?? null;
}
