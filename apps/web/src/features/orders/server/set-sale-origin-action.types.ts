export interface SaleOriginActionState {
  type: "idle" | "success" | "error";
  message: string;
}
