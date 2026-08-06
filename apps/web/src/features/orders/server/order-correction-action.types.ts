export interface OrderCorrectionActionState {
  type: "idle" | "success" | "error" | "conflict";
  message: string;
  fieldErrors?: Record<string, string>;
}
