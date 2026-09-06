import {
  earlierPendingHref,
  managementHref,
  ordersHref,
  teamHref,
} from "./performance-links";

import type { PerformanceDashboardData } from "./performance.types";

/**
 * SPEC-047 BR-011: lo que exige atención antes de leer el resto, en un orden
 * fijo y solo cuando no es cero. Cada aviso abre exactamente su conjunto; el
 * que no tiene destino en esta pantalla lo dice sin enlace.
 */
export interface PriorityNotice {
  key:
    | "TEAMS_WITHOUT_SUPERVISOR"
    | "ADVISOR_OUTSIDE_TEAM"
    | "SELLERS_WITHOUT_SALES"
    | "UNASSIGNED_ORDERS"
    | "AWAITING_ACTIVATION"
    | "EARLIER_PENDING";
  label: string;
  /** `null` cuando el aviso no es un conteo. */
  count: number | null;
  hint: string;
  href: string | null;
}

type NoticeInput = Pick<
  PerformanceDashboardData,
  | "role"
  | "view"
  | "teams"
  | "advisorOutsideTeam"
  | "scopeLabel"
  | "workforce"
  | "metrics"
  | "pendingBeforeMonth"
  | "monthLabel"
> &
  Parameters<typeof teamHref>[0];

export function buildPriorityNotices(data: NoticeInput): PriorityNotice[] {
  const notices: PriorityNotice[] = [];

  const teamsWithoutSupervisor = data.teams.filter(
    (team) => team.kind === "TEAM" && team.supervisorName === null,
  ).length;
  if (teamsWithoutSupervisor > 0) {
    notices.push({
      key: "TEAMS_WITHOUT_SUPERVISOR",
      label:
        teamsWithoutSupervisor === 1
          ? "Equipo sin supervisor"
          : "Equipos sin supervisor",
      count: teamsWithoutSupervisor,
      hint: "Administración cubre su cuota y su recupero mientras no lo tenga.",
      href: data.role === "ADMIN" ? "/admin/teams?sinSupervisor=1" : null,
    });
  }

  if (data.advisorOutsideTeam) {
    notices.push({
      key: "ADVISOR_OUTSIDE_TEAM",
      label: "Asesor fuera del equipo filtrado",
      count: null,
      hint: `${data.scopeLabel} no vende en este equipo: los indicadores muestran solo sus ventas asignadas a él.`,
      href: teamHref(data),
    });
  }

  if (data.workforce && data.workforce.sellersWithoutSales > 0) {
    notices.push({
      key: "SELLERS_WITHOUT_SALES",
      label:
        data.workforce.sellersWithoutSales === 1
          ? "Vendedor sin ventas en el mes"
          : "Vendedores sin ventas en el mes",
      count: data.workforce.sellersWithoutSales,
      hint: `De ${data.workforce.activeSellers} activos. Es un dato de ventas registradas, no de presencia.`,
      href: managementHref(data, "SIN_PRODUCCION"),
    });
  }

  if (data.view !== "SELF" && data.metrics.unassigned > 0) {
    notices.push({
      key: "UNASSIGNED_ORDERS",
      label: "Pedidos sin asesor ni equipo",
      count: data.metrics.unassigned,
      hint: "Asignar antes de medir desempeño.",
      href: ordersHref(data, "ALL", { team: "UNASSIGNED" }),
    });
  }

  if (data.metrics.deliveredPendingActivation > 0) {
    notices.push({
      key: "AWAITING_ACTIVATION",
      label: "Entregadas por activar",
      count: data.metrics.deliveredPendingActivation,
      hint: "Entregadas que aún no cierran y por eso todavía no pagan.",
      href: ordersHref(data, "AWAITING_ACTIVATION"),
    });
  }

  if (data.pendingBeforeMonth && data.pendingBeforeMonth.count > 0) {
    notices.push({
      key: "EARLIER_PENDING",
      label: `Pendientes de meses anteriores a ${data.pendingBeforeMonth.monthLabel}`,
      count: data.pendingBeforeMonth.count,
      hint: `Pedidos abiertos registrados antes del mes en curso. No se mezclan con ${data.monthLabel}.`,
      href: earlierPendingHref(data, data.pendingBeforeMonth),
    });
  }

  return notices;
}

export function quotaSourceLabel(
  source: "ASSIGNED" | "DEFAULT" | "MIXED",
): string {
  switch (source) {
    case "ASSIGNED":
      return "cuota asignada";
    case "DEFAULT":
      return "cuota por defecto";
    default:
      return "cuotas asignadas y por defecto";
  }
}
