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
  "PAGABLES",
  "CUOTA",
  "INGRESADAS",
  "POR_ACTIVAR",
  "POR_RECUPERAR",
  "NOMBRE",
] as const;

export type BreakdownSortKey = (typeof breakdownSortKeys)[number];

export const defaultBreakdownSort: BreakdownSortKey = "PAGABLES";

export const breakdownSortOptions: ReadonlyArray<{
  key: BreakdownSortKey;
  label: string;
}> = [
  { key: "PAGABLES", label: "Más pagables" },
  { key: "CUOTA", label: "Cuota: más cerca de llegar" },
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
  "SIN_PRODUCCION",
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
}

export const managementFilterOptions: readonly ManagementFilterOption[] = [
  {
    key: "SIN_PRODUCCION",
    label: "Sin producción",
    definition:
      "Vendedores activos y habilitados para vender con cero ventas ingresadas en el mes.",
    requiresQuota: false,
  },
  {
    key: "POR_ACTIVAR",
    label: "Con entregas por activar",
    definition:
      "Asesores con al menos una venta entregada que aún no cierra y por eso todavía no paga.",
    requiresQuota: false,
  },
  {
    key: "POR_RECUPERAR",
    label: "Con pedidos por recuperar",
    definition:
      "Asesores con al menos un pedido del mes no entregado o cancelado.",
    requiresQuota: false,
  },
  {
    key: "CUOTA_PENDIENTE",
    label: "Cuota pendiente",
    definition:
      "Asesores con menos portabilidades entregadas que su cuota del tramo. Es el conteo real, sin proyección.",
    requiresQuota: true,
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
  "isActiveSeller" | "metrics" | "quota"
>;

export function matchesManagementFilter(
  item: ManagementSubject,
  filter: ManagementFilterKey | null,
): boolean {
  if (filter === null) return true;
  if (filter === "SIN_PRODUCCION") {
    return item.isActiveSeller && item.metrics.entered === 0;
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
): T[] {
  return items.filter((item) => matchesManagementFilter(item, filter));
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

export function sortBreakdown<T extends SortSubject>(
  items: readonly T[],
  sort: BreakdownSortKey,
): T[] {
  const copy = [...items];
  switch (sort) {
    case "CUOTA":
      return copy.sort(byQuota);
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
