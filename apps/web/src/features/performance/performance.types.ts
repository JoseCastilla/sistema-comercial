import type { PerformanceMetrics } from "@repo/validation";

export type PerformanceRole = "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";

export interface PerformanceBreakdownItem {
  id: string;
  name: string;
  teamName: string | null;
  metrics: PerformanceMetrics;
  showCommission: boolean;
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
}

export interface SalesOperationMix extends SalesOperationMixItem {
  byAgent: Array<
    SalesOperationMixItem & {
      id: string;
      name: string;
    }
  >;
}

export interface SalesOperationMixPeriods {
  today: SalesOperationMix;
  week: SalesOperationMix;
  month: SalesOperationMix;
}

export interface DailyPerformance {
  todayLabel: string;
  entered: number;
  potentialCommissionCents: number;
  closed: number;
  confirmed: number;
  confirmedBaseCommissionCents: number;
  operationMix: SalesOperationMixPeriods;
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
  showTeamFilter: boolean;
  showCommission: boolean;
  dailyPulse: DailyPerformance | null;
  metrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics;
  comparison: {
    hasBase: boolean;
    enteredDelta: number | null;
    payableDelta: number | null;
    payableRateDelta: number | null;
  };
  breakdown: PerformanceBreakdownItem[];
}
