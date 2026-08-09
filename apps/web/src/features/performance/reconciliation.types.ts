import type { PerformancePaymentReason } from "@repo/validation";

export type ReconciliationFilter = PerformancePaymentReason | "ALL";

export interface ReconciliationLine {
  id: string;
  orderCode: string;
  customerName: string;
  agentName: string;
  teamName: string | null;
  operation: string;
  registeredAtLabel: string;
  reason: PerformancePaymentReason;
  reasonLabel: string;
  baseCommissionCents: number;
}

export interface PerformanceReconciliationData {
  generatedAt: string;
  month: string;
  currentMonth: string;
  monthLabel: string;
  from: string;
  to: string;
  teamFilter: string;
  teamOptions: Array<{ id: string; name: string }>;
  filter: ReconciliationFilter;
  counts: Record<PerformancePaymentReason, number>;
  totals: {
    orders: number;
    payable: number;
    baseCommissionCents: number;
  };
  lines: ReconciliationLine[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    filteredTotal: number;
  };
}
