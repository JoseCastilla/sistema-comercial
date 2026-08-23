export interface OrderEscalationActionState {
  type: "idle" | "success" | "error" | "conflict";
  message: string;
  fieldErrors?: {
    category?: string;
    priority?: string;
    description?: string;
    requestedAction?: string;
    decision?: string;
    response?: string;
  };
}
