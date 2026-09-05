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
>;

export function performanceHref(
  data: Scope,
  month: string = data.month,
  overrides: { team?: string; agent?: string } = {},
): string {
  const parameters = new URLSearchParams({ month });
  const team = overrides.team ?? data.teamFilter;
  const agent = overrides.agent ?? data.agentFilter;

  if (data.canSwitchView) parameters.set("view", data.view);
  if (team !== "ALL") parameters.set("team", team);
  if (agent !== "ALL") parameters.set("agent", agent);

  return `/performance?${parameters.toString()}`;
}

/** El nombre de un asesor filtra por él; si ya lo está, vuelve al conjunto. */
export function advisorHref(data: Scope, agentId: string): string {
  return performanceHref(data, data.month, {
    agent: data.agentFilter === agentId ? "ALL" : agentId,
  });
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
export function recoveryCasesHref(data: Scope, advisor?: string): string {
  const parameters = new URLSearchParams();

  if (data.view !== "SELF") {
    const responsible =
      advisor ?? (data.agentFilter !== "ALL" ? data.agentFilter : null);

    if (responsible) parameters.set("advisor", responsible);
    else if (data.teamFilter !== "ALL") parameters.set("team", data.teamFilter);
  }

  const query = parameters.toString();

  return query ? `/recovery/sales?${query}` : "/recovery/sales";
}
