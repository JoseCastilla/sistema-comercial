import type { MobileDebtOperator } from "@repo/validation";

export interface MobileDebtStats {
  today: number;
  month: number;
}

export interface MobileDebtView {
  operator: MobileDebtOperator;
  phone: string;
  customerName: string | null;
  debtAmount: number;
  dueDateRaw: string | null;
  queriedAt: string;
}

export interface MobileDebtActionState {
  type: "idle" | "success" | "error";
  message: string;
  result: MobileDebtView | null;
  stats: MobileDebtStats;
}

export interface MobileDebtCredentialView {
  configured: boolean;
  status: "ACTIVE" | "EXPIRED" | "ERROR" | null;
  hint: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  lastSuccessAt: string | null;
}

export interface MobileDebtCredentialActionState {
  type: "idle" | "success" | "error";
  message: string;
}
