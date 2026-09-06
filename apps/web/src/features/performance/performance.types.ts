import type { PerformanceMetrics } from "@repo/validation";

import type {
  BreakdownSortKey,
  ManagementFilterKey,
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
}

/** Resumen de un equipo dentro del alcance del tablero (SPEC-044 REN-02). */
export interface PerformanceTeamSummary {
  /** `null` en las filas residuales: sin equipo asignado u otros equipos. */
  id: string | null;
  kind: "TEAM" | "UNASSIGNED" | "OTHER";
  name: string;
  supervisorName: string | null;
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
  /** Resumen por equipo; vacío en la vista personal o con un asesor aislado. */
  teams: PerformanceTeamSummary[];
  workforce: {
    activeSellers: number;
    sellersWithSales: number;
    sellersWithoutSales: number;
    averageEnteredPerSeller: number | null;
  } | null;
  /** Casos abiertos en Recupero de ventas dentro del alcance (REN-03). */
  openRecoveryCases: number;
  breakdown: PerformanceBreakdownItem[];
}
