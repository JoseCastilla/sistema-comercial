import { defaultBreakdownSort } from "./performance-management";

import type {
  BreakdownSortKey,
  ManagementFilterKey,
  MatrixRangeKey,
} from "./performance-management";
import type { PerformanceDashboardData } from "./performance.types";

/**
 * Enlaces del tablero de Rendimiento — SPEC-044 REN-01 y REN-03.
 *
 * Cada cifra abre exactamente el conjunto que cuenta: la misma cohorte (mes
 * de la venta, en días de Lima), el mismo equipo y el mismo asesor que el
 * tablero tiene filtrados. Antes el enlace omitía al asesor y «1 entrega por
 * activar» abría las 19 de toda la organización. Además, cada salida lleva el
 * camino de vuelta (`volver=`) para que Pedidos devuelva a Rendimiento con los
 * filtros intactos.
 */
type Scope = Pick<
  PerformanceDashboardData,
  | "month"
  | "view"
  | "canSwitchView"
  | "teamFilter"
  | "agentFilter"
  | "from"
  | "to"
> &
  Partial<
    Pick<
      PerformanceDashboardData,
      "sort" | "management" | "search" | "matrixRangeRequested"
    >
  >;

/** Cambios de lectura que un enlace puede pedir sobre el alcance vigente. */
interface PerformanceHrefOverrides {
  team?: string;
  agent?: string;
  sort?: BreakdownSortKey;
  /** `null` quita el filtro de gestión. */
  management?: ManagementFilterKey | null;
  /** `""` quita la búsqueda. */
  search?: string;
  matrix?: MatrixRangeKey;
}

export function performanceHref(
  data: Scope,
  month: string = data.month,
  overrides: PerformanceHrefOverrides = {},
): string {
  const parameters = new URLSearchParams({ month });
  const team = overrides.team ?? data.teamFilter;
  const agent = overrides.agent ?? data.agentFilter;
  const sort = overrides.sort ?? data.sort ?? defaultBreakdownSort;
  const management =
    overrides.management === undefined
      ? (data.management ?? null)
      : overrides.management;
  const search = overrides.search ?? data.search ?? "";
  const matrix = overrides.matrix ?? data.matrixRangeRequested ?? null;

  if (data.canSwitchView) parameters.set("view", data.view);
  if (team !== "ALL") parameters.set("team", team);
  if (agent !== "ALL") parameters.set("agent", agent);
  // El orden y el filtro de gestión viajan para que la vuelta y cualquier
  // enlace devuelvan la misma lectura (REN-04, REN-05).
  if (sort !== defaultBreakdownSort) parameters.set("orden", sort);
  if (management) parameters.set("gestion", management);
  if (search) parameters.set("q", search);
  if (matrix) parameters.set("matriz", matrix);

  return `/performance?${parameters.toString()}`;
}

/** Cambia el orden del desglose conservando todo lo demás. */
export function sortHref(data: Scope, sort: BreakdownSortKey): string {
  return performanceHref(data, data.month, { sort });
}

/** Aplica un filtro de gestión; si ya está aplicado, lo quita. */
export function managementHref(
  data: Scope,
  management: ManagementFilterKey | null,
): string {
  return performanceHref(data, data.month, {
    management: data.management === management ? null : management,
  });
}

/** Página de cuotas del mismo mes y, si se conoce, del mismo tramo. */
export function quotasHref(data: Scope, window?: "ONE" | "TWO"): string {
  const parameters = new URLSearchParams({ period: data.month });
  if (window) parameters.set("window", window);
  return `/performance/quotas?${parameters.toString()}`;
}

/**
 * El nombre de un asesor siempre filtra por él (SPEC-044 REN-06). Antes, si
 * ya estaba filtrado, el mismo clic quitaba el filtro en silencio; volver al
 * conjunto tiene ahora su propio enlace: `teamHref`.
 */
export function advisorHref(data: Scope, agentId: string): string {
  return performanceHref(data, data.month, { agent: agentId });
}

/** «Ver todo el equipo»: quita el asesor y la búsqueda, conserva lo demás. */
export function teamHref(data: Scope): string {
  return performanceHref(data, data.month, { agent: "ALL", search: "" });
}

/** Cambia la ventana de la matriz por día sin tocar la cohorte. */
export function matrixHref(data: Scope, matrix: MatrixRangeKey): string {
  return performanceHref(data, data.month, { matrix });
}

export function reconciliationHref(data: Scope, reason: string): string {
  const parameters = new URLSearchParams({ month: data.month, reason });

  if (data.teamFilter !== "ALL") parameters.set("team", data.teamFilter);
  if (data.agentFilter !== "ALL") parameters.set("agent", data.agentFilter);

  return `/performance/reconciliation?${parameters.toString()}`;
}

/**
 * Pedidos de la cohorte con el estado pedido, acotados al equipo y asesor
 * vigentes (o a los que se pidan para una fila), con camino de vuelta. En la
 * vista personal el alcance ya es el propio: no viaja equipo ni asesor.
 */
export function ordersHref(
  data: Scope,
  status: string,
  options: { team?: string; advisor?: string } = {},
): string {
  const parameters = new URLSearchParams({
    period: "RANGE",
    from: data.from,
    to: data.to,
    status,
  });

  if (data.view !== "SELF") {
    const team = options.team ?? data.teamFilter;
    const advisor =
      options.advisor ?? (data.agentFilter !== "ALL" ? data.agentFilter : null);

    if (team !== "ALL") parameters.set("team", team);
    if (advisor && team !== "UNASSIGNED") parameters.set("advisor", advisor);
  }

  parameters.set("volver", performanceHref(data));

  return `/orders?${parameters.toString()}`;
}

/**
 * Casos abiertos en Recupero de ventas del asesor (o del alcance). Son casos
 * con responsable y cadencia, no pedidos: la gestión vive allá (SPEC-041).
 */
export function recoveryCasesHref(
  data: Scope,
  advisor?: string,
  team?: string,
): string {
  const parameters = new URLSearchParams();

  if (data.view !== "SELF") {
    const responsible =
      advisor ?? (data.agentFilter !== "ALL" ? data.agentFilter : null);
    const scopedTeam = team ?? data.teamFilter;

    if (responsible) parameters.set("advisor", responsible);
    else if (scopedTeam !== "ALL") parameters.set("team", scopedTeam);
  }

  const query = parameters.toString();

  return query ? `/recovery/sales?${query}` : "/recovery/sales";
}
