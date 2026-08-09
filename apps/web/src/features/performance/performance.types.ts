import type { PerformanceMetrics } from "@repo/validation";

export type PerformanceRole = "ADMIN" | "SUPERVISOR" | "AGENT" | "BACKOFFICE";

export interface PerformanceBreakdownItem {
  id: string;
  name: string;
  teamName: string | null;
  metrics: PerformanceMetrics;
  showCommission: boolean;
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
  teamFilter: string;
  teamOptions: Array<{ id: string; name: string }>;
  showTeamFilter: boolean;
  showCommission: boolean;
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
