export interface CloseOrdersActionState {
  type: "idle" | "success" | "error";
  message: string;
  closed: number;
  /** Los que no se cerraron, con el motivo que dio la regla. */
  failures: Array<{ orderId: string; reason: string }>;
}
