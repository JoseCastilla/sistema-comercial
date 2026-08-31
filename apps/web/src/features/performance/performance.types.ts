import type { PerformanceMetrics } from "@repo/validation";

export type PerformanceRole = "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";

export interface PerformanceBreakdownItem {
  id: string;
  name: string;
  teamName: string | null;
  metrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics;
  enteredDelta: number | null;
  isActiveSeller: boolean;
  showCommission: boolean;
  dailyEntered: number[];
  quota: {
    target: number;
    delivered: number;
    confirmed: number;
    missing: number;
    reached: boolean;
  } | null;
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
  } | null;
  workforce: {
    activeSellers: number;
    sellersWithSales: number;
    sellersWithoutSales: number;
    averageEnteredPerSeller: number | null;
  } | null;
  breakdown: PerformanceBreakdownItem[];
}
