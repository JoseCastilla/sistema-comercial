/**
 * Filtros por acción y por plazo de la bandeja de pedidos — SPEC-041 (fase 2
 * del plan de Pedidos y Recupero, 05/09/2026), sobre SPEC-029 BR-019.
 *
 * La bandeja ya calcula por pedido la acción comercial que Máximo exige y el
 * estado de su plazo de entrega, pero solo los mostraba: no había forma de
 * aislar «todo lo que hay que reagendar» ni «todo lo que ya venció». Aquí
 * viven los valores que la URL acepta y qué significa cada uno; cómo se
 * traducen a una consulta es asunto de la pantalla.
 */

/** Las seis acciones que BR-019 deriva del estado y el motivo del courier. */
export type OrderAgrActionKind =
  | "RESCHEDULE"
  | "CONTACT"
  | "REENTER"
  | "MEETING_POINT"
  | "VERIFY_TENURE"
  | "WAIT_PORTABILITY";

/** Los tres indicadores del filtro logístico (SPEC-029 AC-009). */
export type OrderActionGroup = "coordinar" | "contactar" | "reingresar";

export type OrderActionFilter = OrderAgrActionKind | OrderActionGroup;

export const orderActionKindLabels: Record<OrderAgrActionKind, string> = {
  RESCHEDULE: "Reagendar",
  MEETING_POINT: "Otro punto",
  CONTACT: "Contactar",
  VERIFY_TENURE: "Verificar",
  REENTER: "Reingresar",
  WAIT_PORTABILITY: "Esperar",
};

/**
 * Cada indicador agrupa dos acciones. El filtro acepta el grupo —para que el
 * indicador abra exactamente lo que cuenta— y también la acción exacta.
 */
export const orderActionGroups: ReadonlyArray<{
  value: OrderActionGroup;
  label: string;
  kinds: ReadonlyArray<OrderAgrActionKind>;
}> = [
  {
    value: "coordinar",
    label: "Visita por coordinar",
    kinds: ["RESCHEDULE", "MEETING_POINT"],
  },
  {
    value: "contactar",
    label: "Contactar y validar",
    kinds: ["CONTACT", "VERIFY_TENURE"],
  },
  {
    value: "reingresar",
    label: "Por volver a ingresar",
    kinds: ["REENTER", "WAIT_PORTABILITY"],
  },
];

/** Opciones del selector: cada grupo seguido de sus acciones exactas. */
export const orderActionFilterOptions: ReadonlyArray<{
  value: OrderActionFilter;
  label: string;
}> = orderActionGroups.flatMap((group) => [
  { value: group.value, label: `${group.label} (todas)` },
  ...group.kinds.map((kind) => ({
    value: kind,
    label: orderActionKindLabels[kind],
  })),
]);

export function parseOrderActionFilter(
  value: string | null | undefined,
): OrderActionFilter | null {
  const text = String(value ?? "").trim();

  return orderActionFilterOptions.some((option) => option.value === text)
    ? (text as OrderActionFilter)
    : null;
}

/** Acciones exactas que abarca un valor del filtro. */
export function resolveOrderActionKinds(
  filter: OrderActionFilter,
): ReadonlyArray<OrderAgrActionKind> {
  const group = orderActionGroups.find((item) => item.value === filter);

  return group ? group.kinds : [filter as OrderAgrActionKind];
}

/**
 * Tramos del plazo de entrega, los mismos que la fila ya rotula: fuera de
 * plazo, vence pronto, sin horario asignado (regular sin turno) y todavía
 * sin plazo. Lo entregado y lo cancelado no tiene plazo que filtrar.
 */
export type OrderDueFilter = "vencido" | "pronto" | "sin_horario" | "sin_plazo";

export const orderDueSoonMinutes = 30;

export const orderRegularDeliveryMethods: ReadonlyArray<string> = [
  "REGULAR_24H",
  "REGULAR_48H",
  "REGULAR_72H",
];

export const orderDueFilterOptions: ReadonlyArray<{
  value: OrderDueFilter;
  label: string;
}> = [
  { value: "vencido", label: "Fuera de plazo" },
  { value: "pronto", label: `Vence en ${orderDueSoonMinutes} minutos` },
  { value: "sin_horario", label: "Sin horario asignado" },
  { value: "sin_plazo", label: "Todavía sin plazo" },
];

export function parseOrderDueFilter(
  value: string | null | undefined,
): OrderDueFilter | null {
  const text = String(value ?? "").trim();

  return orderDueFilterOptions.some((option) => option.value === text)
    ? (text as OrderDueFilter)
    : null;
}

/**
 * Ventana [gte, lt) del vencimiento para los tramos con fecha; `null` para
 * los que se definen por no tener fecha. Coincide con la regla de la fila:
 * vencido es antes de ahora; pronto, dentro de los próximos 30 minutos.
 */
export function orderDueFilterWindow(
  filter: OrderDueFilter,
  now: Date,
): { gte?: Date; lt?: Date } | null {
  switch (filter) {
    case "vencido":
      return { lt: now };
    case "pronto":
      return {
        gte: now,
        lt: new Date(now.getTime() + orderDueSoonMinutes * 60 * 1000),
      };
    case "sin_horario":
    case "sin_plazo":
      return null;
  }
}
