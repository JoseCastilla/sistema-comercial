export interface OrderCancellationActionState {
  type: "idle" | "success" | "error" | "conflict";
  message: string;
  fieldErrors?: {
    decision?: string;
    observation?: string;
  };
}
