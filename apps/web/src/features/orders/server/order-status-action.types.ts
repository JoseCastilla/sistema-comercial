export interface OrderStatusActionState {
  type: "idle" | "success" | "error";

  message: string;

  fieldErrors?: {
    status?: string;

    sentSubstatus?: string;

    observation?: string;
  };
}
