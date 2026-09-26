import type { OrderInboxItem } from "./order-inbox.types";

/**
 * SPEC-080: la hoja del asesor es una sola lista agrupada por lo que toca,
 * sin pestañas. Un asesor tiene pocos pedidos en curso (10 como máximo en
 * septiembre); siete pestañas le hacían buscar lo que una lista ordenada
 * ya muestra.
 */
export type AdvisorOrderGroupKey =
  | "fallida"
  | "por_entregar"
  | "por_activar"
  | "cerradas"
  | "canceladas";

export const advisorOrderGroups: ReadonlyArray<{
  key: AdvisorOrderGroupKey;
  label: string;
  hint: string | null;
  /** Lo terminado va plegado: se consulta, no se trabaja. */
  collapsed: boolean;
}> = [
  {
    key: "fallida",
    label: "Entrega fallida: llama al cliente",
    hint: null,
    collapsed: false,
  },
  { key: "por_entregar", label: "Por entregar", hint: null, collapsed: false },
  {
    key: "por_activar",
    label: "Entregadas, falta activar",
    hint: "Se cierran cuando el operador activa la línea.",
    collapsed: false,
  },
  { key: "cerradas", label: "Cerradas", hint: null, collapsed: true },
  { key: "canceladas", label: "Canceladas", hint: null, collapsed: true },
];

type GroupInput = Pick<
  OrderInboxItem,
  "status" | "sentSubstatus" | "deliveryStatus" | "agrDelivery"
>;

export function getAdvisorOrderGroup(order: GroupInput): AdvisorOrderGroupKey {
  if (order.status === "CLOSED") return "cerradas";
  if (order.status === "CANCELLED") return "canceladas";
  if (order.sentSubstatus === "DELIVERED" || order.deliveryStatus === "DELIVERED") {
    return "por_activar";
  }
  if (
    (order.agrDelivery?.opportunity && !order.agrDelivery.stale) ||
    order.sentSubstatus === "NOT_DELIVERED" ||
    order.sentSubstatus === "REJECTED"
  ) {
    return "fallida";
  }
  return "por_entregar";
}

/** Agrupa conservando el orden de urgencia que ya trae la lista. */
export function groupAdvisorOrders<T extends GroupInput>(
  orders: readonly T[],
): Array<{
  key: AdvisorOrderGroupKey;
  label: string;
  hint: string | null;
  collapsed: boolean;
  items: T[];
}> {
  return advisorOrderGroups
    .map((group) => ({
      ...group,
      items: orders.filter((order) => getAdvisorOrderGroup(order) === group.key),
    }))
    .filter((group) => group.items.length > 0);
}

/** El motivo que da Máximo, tal cual, para la fila de una entrega fallida. */
export function getAgrReasonText(
  order: Pick<OrderInboxItem, "agrDelivery">,
): string | null {
  const fields = order.agrDelivery?.fields ?? [];
  const motivo = fields.find((field) => field.key === "motivo_rechazo")?.value;
  const submotivo = fields.find(
    (field) => field.key === "submotivo_rechazo",
  )?.value;
  return [motivo, submotivo].filter(Boolean).join(" · ") || null;
}
