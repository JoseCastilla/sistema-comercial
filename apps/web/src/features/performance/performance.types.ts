import type { PerformanceMetrics } from "@repo/validation";

import type { AcceleratorWindowView } from "./accelerator-windows";
import type { AdminPendingGroup } from "./admin-pending";
import type { DeliveryTrend } from "./delivery-trend";
import type {
  BreakdownColumnsKey,
  BreakdownSortKey,
  ManagementFilterKey,
  MatrixRangeKey,
} from "./performance-management";

export type PerformanceRole = "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";

export interface PerformanceBreakdownItem {
  id: string;
  name: string;
  teamName: string | null;
  metrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics;
  enteredDelta: number | null;
  isActiveSeller: boolean;
  /** Casos abiertos a su cargo en Recupero de ventas (SPEC-044 REN-03). */
  openRecoveryCases: number;
  showCommission: boolean;
  dailyEntered: number[];
  quota: PerformanceQuotaProgress | null;
}

/**
 * Avance de la ventana de cuota vigente (SPEC-038, SPEC-044 REN-04): la cuota
 * se mide en entregadas; el acelerador, en confirmadas. Las dos se muestran.
 */
export interface PerformanceQuotaProgress {
  target: number;
  delivered: number;
  confirmed: number;
  missing: number;
  reached: boolean;
  /** Siguiente tramo del acelerador y cuántas confirmadas faltan; `null` si no hay dato. */
  nextTarget: number | null;
  missingForNextTarget: number;
  /** Cumplimiento: entregadas / cuota (SPEC-047 BR-007). */
  ratio: number;
  /**
   * De dónde sale la cuota: fijada por alguien, el tramo por defecto, o —en
   * un agregado— una mezcla de ambas (SPEC-047 BR-007).
   */
  source: "ASSIGNED" | "DEFAULT" | "MIXED";
}

/** Resumen de un equipo dentro del alcance del tablero (SPEC-044 REN-02). */
export interface PerformanceTeamSummary {
  /** `null` en las filas residuales: sin equipo asignado u otros equipos. */
  id: string | null;
  kind: "TEAM" | "UNASSIGNED" | "OTHER";
  name: string;
  supervisorName: string | null;
  /** Personas activas del equipo, vendan o no (PL-08). */
  activeMembers: number;
  activeSellers: number;
  sellersWithSales: number;
  sellersWithoutSales: number;
  metrics: PerformanceMetrics;
  openRecoveryCases: number;
  quota: PerformanceQuotaProgress | null;
}

export interface MonthlyPerformanceDay {
  key: string;
  day: number;
  label: string;
  entered: number;
  closed: number;
  cumulative: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface MonthlyPerformanceProgress {
  days: MonthlyPerformanceDay[];
  elapsedDays: number;
  productiveDays: number;
  averagePerElapsedDay: number;
  bestDay: MonthlyPerformanceDay | null;
}

export interface DailyPerformanceItem {
  key: string;
  label: string;
  entered: number;
  potentialCommissionCents: number;
  closed: number;
  confirmed: number;
  confirmedBaseCommissionCents: number;
  isToday: boolean;
}

export interface SalesOperationMixItem {
  total: number;
  newLine: number;
  portPostpaid: number;
  portPrepaid: number;
  unclassified: number;
  payablePortPostpaid: number;
  payablePortPrepaid: number;
}

export interface DailyPerformance {
  todayLabel: string;
  entered: number;
  potentialCommissionCents: number;
  closed: number;
  confirmed: number;
  confirmedBaseCommissionCents: number;
  days: DailyPerformanceItem[];
}

export interface PerformanceDashboardData {
  generatedAt: string;
  role: PerformanceRole;
  month: string;
  currentMonth: string;
  monthLabel: string;
  previousMonth: string;
  nextMonth: string;
  isCurrentMonth: boolean;
  from: string;
  to: string;
  scopeLabel: string;
  view: "SELF" | "TEAM";
  canSwitchView: boolean;
  teamFilter: string;
  teamOptions: Array<{ id: string; name: string }>;
  agentFilter: string;
  advisorOptions: Array<{ id: string; name: string }>;
  showTeamFilter: boolean;
  showAdvisorFilter: boolean;
  showCommission: boolean;
  salesMix: SalesOperationMixItem;
  dailyPulse: DailyPerformance | null;
  monthProgress: MonthlyPerformanceProgress;
  metrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics;
  comparison: {
    hasBase: boolean;
    comparedThroughDay: number | null;
    enteredDelta: number | null;
    payableDelta: number | null;
    payableRateDelta: number | null;
    /**
     * SPEC-047 BR-003: entregadas de la cohorte del mes pasado que ya
     * estaban entregadas en el mismo día del mes pasado (maduración
     * equivalente) y con cuántas terminó esa cohorte a hoy.
     */
    deliveredComparable: number;
    deliveredMatured: number;
    deliveredDelta: number | null;
  };
  unattributed: {
    metrics: PerformanceMetrics;
    enteredDelta: number | null;
  } | null;
  quotaWindow: {
    key: "ONE" | "TWO";
    label: string;
    isActive: boolean;
    /** Días del mes que abarca la ventana, para decir la cohorte sin rodeos. */
    startDay: number;
    endDay: number;
  } | null;
  /** Orden del desglose (`orden=`), SPEC-044 REN-04. */
  sort: BreakdownSortKey;
  /** Filtro de gestión (`gestion=`), SPEC-044 REN-05. */
  management: ManagementFilterKey | null;
  /** Búsqueda por nombre de asesor (`q=`), SPEC-044 REN-06. */
  search: string;
  /** Ventana de la matriz por día (`matriz=`), SPEC-044 REN-07. */
  matrixRange: MatrixRangeKey;
  /** Lo que pidió la URL, para que los enlaces lo conserven tal cual. */
  matrixRangeRequested: MatrixRangeKey | null;
  /** Columnas de la tabla individual (`columnas=`), SPEC-047 BR-015. */
  columns: BreakdownColumnsKey;
  /**
   * El asesor filtrado no es vendedor activo del equipo filtrado (SUP-06):
   * se avisa, porque los indicadores quedan acotados a sus ventas dentro de
   * ese equipo.
   */
  advisorOutsideTeam: boolean;
  /** Cuota del propio asesor en la vista personal (ASE-01); solo lectura. */
  personalQuota: PerformanceQuotaProgress | null;
  /**
   * En la vista personal de un supervisor que vende, su propio id: Pedidos,
   * Recupero y la conciliación le muestran por defecto sus equipos, así que
   * los enlaces deben pedir explícitamente «solo lo mío» (SPEC-044 SV-01).
   */
  selfAdvisorId: string | null;
  /** Estado de cada ventana del acelerador según el día de hoy (ASE-02). */
  acceleratorWindows: AcceleratorWindowView[];
  /** Día de hoy en Lima si el mes elegido es el actual; si no, `null`. */
  todayDay: number | null;
  /**
   * Pedidos abiertos registrados antes del mes en curso, con el alcance del
   * tablero (ASE-04). Misma definición que «pendientes de meses anteriores»
   * en Pedidos; no se mezclan con las ventas del mes elegido.
   */
  pendingBeforeMonth: {
    count: number;
    /** Mes en curso, del que quedan «antes». */
    monthLabel: string;
    /** Rango para abrir exactamente esos pedidos en Pedidos. */
    from: string;
    to: string;
  } | null;
  /** Resumen por equipo; vacío en la vista personal o con un asesor aislado. */
  teams: PerformanceTeamSummary[];
  /**
   * Resumen administrativo de pendientes (SPEC-045 PL-01): solo para ADMIN
   * con alcance de organización; `null` en cualquier otro caso.
   */
  adminPending: AdminPendingGroup[] | null;
  workforce: {
    activeSellers: number;
    sellersWithSales: number;
    sellersWithoutSales: number;
    averageEnteredPerSeller: number | null;
  } | null;
  /** Casos abiertos en Recupero de ventas dentro del alcance (REN-03). */
  openRecoveryCases: number;
  breakdown: PerformanceBreakdownItem[];
  /** Entregas registradas por día dentro del mes (SPEC-047 BR-009). */
  deliveryTrend: DeliveryTrend;
  /**
   * Cuota del tramo para todo el alcance (SPEC-047 BR-008): la suma de las
   * cuotas de los equipos resumidos, la del asesor aislado o la personal.
   */
  scopeQuota: PerformanceQuotaProgress | null;
  /** Cuántos de los equipos sumados tienen cuota asignada. */
  scopeQuotaTeams: { total: number; assigned: number } | null;
}
