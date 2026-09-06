import type { PerformanceBreakdownItem } from "./performance.types";

/**
 * Orden y filtros de gestión del desglose por asesor — SPEC-044 REN-04 y
 * REN-05 (BR-007, BR-008).
 *
 * Los dos viven en la URL (`orden=`, `gestion=`) para que un enlace baste
 * para volver a la misma lectura. Cada filtro lleva su definición: la
 * pantalla la muestra, así nadie discute qué significa «sin producción».
 */
export const breakdownSortKeys = [
  "ENTREGADAS",
  "PAGABLES",
  "CUOTA",
  "BONO",
  "INGRESADAS",
  "POR_ACTIVAR",
  "POR_RECUPERAR",
  "NOMBRE",
] as const;

export type BreakdownSortKey = (typeof breakdownSortKeys)[number];

/** SPEC-047 BR-004: el resultado se mide en entregadas, así que encabezan. */
export const defaultBreakdownSort: BreakdownSortKey = "ENTREGADAS";

export const breakdownSortOptions: ReadonlyArray<{
  key: BreakdownSortKey;
  label: string;
}> = [
  { key: "ENTREGADAS", label: "Más entregadas" },
  { key: "PAGABLES", label: "Más pagables" },
  { key: "CUOTA", label: "Cuota: más cerca de llegar" },
  { key: "BONO", label: "Bono: más cerca del siguiente tramo" },
  { key: "INGRESADAS", label: "Más ingresadas" },
  { key: "POR_ACTIVAR", label: "Más por activar" },
  { key: "POR_RECUPERAR", label: "Más por recuperar" },
  { key: "NOMBRE", label: "Nombre" },
];

export function parseBreakdownSort(value: unknown): BreakdownSortKey {
  return typeof value === "string" &&
    (breakdownSortKeys as readonly string[]).includes(value)
    ? (value as BreakdownSortKey)
    : defaultBreakdownSort;
}

export const managementFilterKeys = [
  "SIN_VENTAS_HOY",
  "SIN_PRODUCCION",
  "SIN_ENTREGAS",
  "POR_ACTIVAR",
  "POR_RECUPERAR",
  "CUOTA_PENDIENTE",
] as const;

export type ManagementFilterKey = (typeof managementFilterKeys)[number];

export interface ManagementFilterOption {
  key: ManagementFilterKey;
  label: string;
  /** Qué cuenta exactamente: se muestra al elegir el filtro. */
  definition: string;
  /** Solo tiene sentido con una ventana de cuota sobre la que hablar. */
  requiresQuota: boolean;
  /** Solo tiene sentido en el mes en curso: «hoy» no existe en un mes cerrado. */
  requiresCurrentMonth: boolean;
}

/*
 * SUP-02: la ausencia de ventas se dice como lo que es —ventas registradas—
 * y con su período; nunca como ausencia laboral.
 */
export const managementFilterOptions: readonly ManagementFilterOption[] = [
  {
    key: "SIN_VENTAS_HOY",
    label: "Sin ventas hoy",
    definition:
      "Vendedores activos sin ventas registradas en el día de hoy (hora de Lima). Es un dato de ventas, no de presencia.",
    requiresQuota: false,
    requiresCurrentMonth: true,
  },
  {
    key: "SIN_PRODUCCION",
    label: "Sin ventas en el mes",
    definition:
      "Vendedores activos y habilitados para vender con cero ventas registradas en el mes elegido.",
    requiresQuota: false,
    requiresCurrentMonth: false,
  },
  {
    // SPEC-047 BR-005: el filtro de resultado. Vender sin entregar es lo que
    // hay que mirar cuando el eje es la entrega.
    key: "SIN_ENTREGAS",
    label: "Sin entregas en el mes",
    definition:
      "Vendedores activos con cero ventas entregadas en el mes elegido, tengan o no ventas ingresadas.",
    requiresQuota: false,
    requiresCurrentMonth: false,
  },
  {
    key: "POR_ACTIVAR",
    label: "Con entregas por activar",
    definition:
      "Asesores con al menos una venta entregada que aún no cierra y por eso todavía no paga.",
    requiresQuota: false,
    requiresCurrentMonth: false,
  },
  {
    key: "POR_RECUPERAR",
    label: "Con pedidos por recuperar",
    definition:
      "Asesores con al menos un pedido del mes no entregado o cancelado.",
    requiresQuota: false,
    requiresCurrentMonth: false,
  },
  {
    key: "CUOTA_PENDIENTE",
    label: "Cuota pendiente",
    definition:
      "Asesores con menos portabilidades entregadas que su cuota del tramo. Es el conteo real, sin proyección.",
    requiresQuota: true,
    requiresCurrentMonth: false,
  },
];

export function parseManagementFilter(
  value: unknown,
): ManagementFilterKey | null {
  return typeof value === "string" &&
    (managementFilterKeys as readonly string[]).includes(value)
    ? (value as ManagementFilterKey)
    : null;
}

export function getManagementFilterOption(
  key: ManagementFilterKey,
): ManagementFilterOption {
  const option = managementFilterOptions.find((item) => item.key === key);
  if (!option) throw new Error(`Filtro de gestión desconocido: ${key}`);
  return option;
}

type ManagementSubject = Pick<
  PerformanceBreakdownItem,
  "isActiveSeller" | "metrics" | "quota" | "dailyEntered"
>;

/** Posición del día de hoy en `dailyEntered`; `null` fuera del mes en curso. */
export type ManagementContext = { todayIndex: number | null };

export function matchesManagementFilter(
  item: ManagementSubject,
  filter: ManagementFilterKey | null,
  context: ManagementContext = { todayIndex: null },
): boolean {
  if (filter === null) return true;
  if (filter === "SIN_VENTAS_HOY") {
    if (context.todayIndex === null) return false;
    return (
      item.isActiveSeller && (item.dailyEntered[context.todayIndex] ?? 0) === 0
    );
  }
  if (filter === "SIN_PRODUCCION") {
    return item.isActiveSeller && item.metrics.entered === 0;
  }
  if (filter === "SIN_ENTREGAS") {
    return item.isActiveSeller && item.metrics.delivered === 0;
  }
  if (filter === "POR_ACTIVAR") {
    return item.metrics.deliveredPendingActivation > 0;
  }
  if (filter === "POR_RECUPERAR") return item.metrics.recovery > 0;
  return item.quota !== null && !item.quota.reached;
}

export function filterBreakdown<T extends ManagementSubject>(
  items: readonly T[],
  filter: ManagementFilterKey | null,
  context: ManagementContext = { todayIndex: null },
): T[] {
  return items.filter((item) => matchesManagementFilter(item, filter, context));
}

/**
 * SUP-02: lo que el supervisor necesita para acompañar. Todo sale de las
 * ventas del mes elegido por día (hora de Lima): los días futuros no cuentan
 * como días sin producción, y «hoy» solo existe en el mes en curso.
 */
export function summarizeAdvisorActivity(
  dailyEntered: readonly number[],
  days: ReadonlyArray<{ day: number; isFuture: boolean; isToday: boolean }>,
): {
  today: number | null;
  lastSaleDay: number | null;
  productiveDays: number;
  elapsedDays: number;
} {
  let today: number | null = null;
  let lastSaleDay: number | null = null;
  let productiveDays = 0;
  let elapsedDays = 0;

  days.forEach((day, index) => {
    if (day.isFuture) return;
    const entered = dailyEntered[index] ?? 0;
    elapsedDays += 1;
    if (day.isToday) today = entered;
    if (entered > 0) {
      productiveDays += 1;
      lastSaleDay = day.day;
    }
  });

  return { today, lastSaleDay, productiveDays, elapsedDays };
}

type SortSubject = Pick<
  PerformanceBreakdownItem,
  "name" | "metrics" | "quota" | "openRecoveryCases"
>;

function byName(left: SortSubject, right: SortSubject): number {
  return left.name.localeCompare(right.name, "es");
}

/**
 * «Cuota: más cerca de llegar» pone primero a quien no la alcanzó, del más
 * cercano al más lejano —ahí está la intervención que rinde— y después a
 * quienes ya cumplieron, de mayor a menor entregadas. Sin cuota, al final.
 */
function byQuota(left: SortSubject, right: SortSubject): number {
  const rank = (item: SortSubject) =>
    item.quota === null ? 2 : item.quota.reached ? 1 : 0;
  const rankDelta = rank(left) - rank(right);
  if (rankDelta !== 0) return rankDelta;
  if (left.quota && right.quota) {
    if (!left.quota.reached) {
      return left.quota.missing - right.quota.missing || byName(left, right);
    }
    return right.quota.delivered - left.quota.delivered || byName(left, right);
  }
  return byName(left, right);
}

/**
 * «Bono: más cerca del siguiente tramo» ordena por confirmadas que faltan
 * para el siguiente bono, de menos a más; sin siguiente tramo, al final.
 */
function byBonus(left: SortSubject, right: SortSubject): number {
  const missing = (item: SortSubject) =>
    item.quota?.nextTarget === null || item.quota?.nextTarget === undefined
      ? Number.POSITIVE_INFINITY
      : item.quota.missingForNextTarget;
  return missing(left) - missing(right) || byName(left, right);
}

export function sortBreakdown<T extends SortSubject>(
  items: readonly T[],
  sort: BreakdownSortKey,
): T[] {
  const copy = [...items];
  switch (sort) {
    case "ENTREGADAS":
      return copy.sort(
        (left, right) =>
          right.metrics.delivered - left.metrics.delivered ||
          right.metrics.payable - left.metrics.payable ||
          byName(left, right),
      );
    case "CUOTA":
      return copy.sort(byQuota);
    case "BONO":
      return copy.sort(byBonus);
    case "INGRESADAS":
      return copy.sort(
        (left, right) =>
          right.metrics.entered - left.metrics.entered || byName(left, right),
      );
    case "POR_ACTIVAR":
      return copy.sort(
        (left, right) =>
          right.metrics.deliveredPendingActivation -
            left.metrics.deliveredPendingActivation || byName(left, right),
      );
    case "POR_RECUPERAR":
      return copy.sort(
        (left, right) =>
          right.metrics.recovery - left.metrics.recovery ||
          right.openRecoveryCases - left.openRecoveryCases ||
          byName(left, right),
      );
    case "NOMBRE":
      return copy.sort(byName);
    default:
      return copy.sort(
        (left, right) =>
          right.metrics.payable - left.metrics.payable ||
          right.metrics.entered - left.metrics.entered ||
          byName(left, right),
      );
  }
}

/**
 * SPEC-044 REN-06: la búsqueda por nombre acota el desglose y la matriz sin
 * tocar los indicadores. Compara sin tildes ni mayúsculas, como se escribe
 * deprisa; menos de dos caracteres no es una búsqueda.
 */
export const minimumSearchLength = 2;

export function normalizeSearchTerm(value: unknown): string {
  if (typeof value !== "string") return "";
  const term = value.trim().slice(0, 100);
  return term.length >= minimumSearchLength ? term : "";
}

function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export function filterBreakdownBySearch<T extends { name: string }>(
  items: readonly T[],
  search: string,
): T[] {
  const term = foldName(normalizeSearchTerm(search));
  if (!term) return [...items];
  return items.filter((item) => foldName(item.name).includes(term));
}

/**
 * SPEC-047 BR-015: la tabla individual arranca compacta —asesor, entregadas,
 * cuota, pagables, pendientes y estimado— y `columnas=todas` en la URL añade
 * hoy, ingresadas, variación, última venta, tasa y los pendientes por
 * separado. La lectura elegida viaja con el resto de la URL.
 */
export const breakdownColumnKeys = ["COMPACTAS", "TODAS"] as const;

export type BreakdownColumnsKey = (typeof breakdownColumnKeys)[number];

export function parseBreakdownColumns(value: unknown): BreakdownColumnsKey {
  return typeof value === "string" && value.toLowerCase() === "todas"
    ? "TODAS"
    : "COMPACTAS";
}

/**
 * SPEC-044 REN-07: la matriz por día puede mostrar los últimos 7 días
 * transcurridos o el mes completo. No altera la cohorte de los indicadores:
 * solo la ventana de lectura de la matriz. En el mes en curso la lectura
 * útil es la semana; en un mes cerrado, el mes.
 */
export const matrixRangeKeys = ["7D", "MES"] as const;

export type MatrixRangeKey = (typeof matrixRangeKeys)[number];

export const matrixRangeOptions: ReadonlyArray<{
  key: MatrixRangeKey;
  label: string;
}> = [
  { key: "7D", label: "Últimos 7 días" },
  { key: "MES", label: "Mes completo" },
];

export function parseMatrixRange(value: unknown): MatrixRangeKey | null {
  return typeof value === "string" &&
    (matrixRangeKeys as readonly string[]).includes(value)
    ? (value as MatrixRangeKey)
    : null;
}

export function resolveMatrixRange(
  requested: MatrixRangeKey | null,
  isCurrentMonth: boolean,
): MatrixRangeKey {
  return requested ?? (isCurrentMonth ? "7D" : "MES");
}

/** Índices de los días visibles en la matriz para el rango elegido. */
export function selectMatrixDays<T extends { isFuture: boolean }>(
  days: readonly T[],
  range: MatrixRangeKey,
): number[] {
  const indexes = days.map((_, index) => index);
  if (range === "MES") return indexes;
  const elapsed = indexes.filter((index) => !days[index]?.isFuture);
  return elapsed.slice(-7);
}
