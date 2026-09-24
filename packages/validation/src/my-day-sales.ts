import {
  evaluatePerformanceOrderPayment,
  getPotentialBaseCommissionCents,
  type PerformanceOrderInput,
  type PerformancePaymentReason,
} from "./performance-metrics.js";

/**
 * «Tus ventas del mes» — SPEC-063 fase 4 (BR-020). Cada venta del asesor,
 * agrupada por lo que significa para su comisión, con el monto real de lo que
 * ya paga y el potencial de lo que todavía no.
 *
 * No decide cuándo una venta paga: eso lo decide
 * `evaluatePerformanceOrderPayment`, la misma regla de Rendimiento y
 * Conciliación (SPEC-033). Aquí solo se traduce el motivo a lo que el asesor
 * puede hacer con él.
 */
export type MyDaySaleBucket =
  | "pagan"
  | "por_activar"
  | "en_camino"
  | "caidas"
  | "sin_comision";

export const myDaySaleBucketOrder: readonly MyDaySaleBucket[] = [
  "pagan",
  "por_activar",
  "en_camino",
  "caidas",
  "sin_comision",
];

export const myDaySaleBucketLabels: Record<MyDaySaleBucket, string> = {
  pagan: "Ya pagan",
  por_activar: "Entregadas, esperan activación",
  en_camino: "En camino al cliente",
  caidas: "Caídas: recupéralas",
  sin_comision: "No pagan comisión",
};

/** Qué significa el grupo, en una frase para el asesor. */
export const myDaySaleBucketHints: Record<MyDaySaleBucket, string> = {
  pagan: "Entregadas, activadas y a tu nombre: ya suman a tu comisión.",
  por_activar:
    "El cliente ya tiene su chip; pagan en cuanto la línea se active.",
  en_camino: "Todavía no llegan al cliente; pagan al entregarse y activarse.",
  caidas:
    "No se entregaron o se cancelaron. Si las recuperas, vuelven a pagar.",
  sin_comision: "Altas nuevas u operaciones por corregir: no pagan comisión.",
};

export interface MyDaySaleClassification {
  bucket: MyDaySaleBucket;
  reason: PerformancePaymentReason;
  /** Lo que paga, o pagaría si avanza; 0 si no paga comisión. */
  amountCents: number;
  /** `true` si el monto todavía no está ganado. */
  potential: boolean;
}

/** Sin entregar, pero con la entrega fallida: ya no está «en camino». */
function deliveryFailed(order: PerformanceOrderInput): boolean {
  return (
    order.deliveryStatus === "NOT_DELIVERED" ||
    order.sentSubstatus === "NOT_DELIVERED" ||
    order.sentSubstatus === "REJECTED"
  );
}

export function classifyMyDaySale(
  order: PerformanceOrderInput,
): MyDaySaleClassification {
  const evaluation = evaluatePerformanceOrderPayment(order);
  const potentialCents = getPotentialBaseCommissionCents(
    order.commercialOperation,
  );

  switch (evaluation.reason) {
    case "PAYABLE":
      return {
        bucket: "pagan",
        reason: evaluation.reason,
        amountCents: evaluation.baseCommissionCents,
        potential: false,
      };
    case "NOT_ACTIVATED":
      return {
        bucket: "por_activar",
        reason: evaluation.reason,
        amountCents: potentialCents,
        potential: true,
      };
    case "NOT_DELIVERED":
      return {
        bucket: deliveryFailed(order) ? "caidas" : "en_camino",
        reason: evaluation.reason,
        amountCents: potentialCents,
        potential: true,
      };
    case "CANCELLED":
      return {
        bucket: "caidas",
        reason: evaluation.reason,
        amountCents: potentialCents,
        potential: true,
      };
    case "NEW_LINE_NO_COMMISSION":
    case "UNKNOWN_OPERATION":
    case "UNASSIGNED":
      return {
        bucket: "sin_comision",
        reason: evaluation.reason,
        amountCents: 0,
        potential: false,
      };
  }
}

/** Por qué una venta sin comisión no paga, en palabras del asesor. */
export const myDayNoCommissionReasons: Partial<
  Record<PerformancePaymentReason, string>
> = {
  NEW_LINE_NO_COMMISSION: "Alta nueva: no paga comisión",
  UNKNOWN_OPERATION: "Operación sin identificar: pide que la corrijan",
  UNASSIGNED: "Sin asesor responsable",
};

export interface MyDaySaleBucketSummary {
  bucket: MyDaySaleBucket;
  count: number;
  amountCents: number;
}

/** Cantidad y monto por grupo, en el orden en que se muestran; sin vacíos. */
export function summarizeMyDaySales(
  classifications: readonly MyDaySaleClassification[],
): MyDaySaleBucketSummary[] {
  return myDaySaleBucketOrder
    .map((bucket) => {
      const items = classifications.filter((item) => item.bucket === bucket);
      return {
        bucket,
        count: items.length,
        amountCents: items.reduce((total, item) => total + item.amountCents, 0),
      };
    })
    .filter((summary) => summary.count > 0);
}
