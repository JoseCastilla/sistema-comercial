import type { OrderStatus } from "@/generated/prisma/enums";

/** Color del estado del pedido, igual en la lista y en el detalle. */
export function statusTone(status: OrderStatus): "success" | "danger" | "info" | "neutral" {
  if (status === "ACTIVADO") return "success";
  if (status === "CANCELADO") return "danger";
  if (status === "ENTREGADO") return "info";
  return "neutral";
}
