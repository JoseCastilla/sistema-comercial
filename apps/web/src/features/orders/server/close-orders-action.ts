"use server";

import { revalidatePath } from "next/cache";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import {
  applyOrderStatusChange,
  OrderStatusUpdateError,
} from "./order-status-change";

import type { CloseOrdersActionState } from "./close-orders-action.types";

/** Una página de la bandeja: nunca más de lo que se ve. */
const maximumOrders = 100;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseOrderIds(
  values: string[],
): { ok: true; ids: string[] } | { ok: false; message: string } {
  const ids = [...new Set(values)];
  if (ids.length === 0) return { ok: false, message: "Marca al menos un pedido." };
  if (ids.length > maximumOrders) {
    return { ok: false, message: `Se cierran hasta ${maximumOrders} a la vez.` };
  }
  if (!ids.every((id) => uuidPattern.test(id))) {
    return { ok: false, message: "Revisa los pedidos marcados." };
  }
  return { ok: true, ids };
}

/**
 * SPEC-079: cerrar varios pedidos entregados cuando el operador ya activó la
 * línea. Cada pedido pasa por la misma regla que el cierre de uno en uno
 * (`applyOrderStatusChange`), en su propia transacción: si uno falla —otro lo
 * cambió, ya estaba cerrado, es venta propia— los demás se cierran igual y
 * la respuesta dice cuál y por qué. La nota de cada pedido se conserva.
 */
export async function closeOrdersAction(
  previousState: CloseOrdersActionState,
  formData: FormData,
): Promise<CloseOrdersActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();
  const parsed = parseOrderIds(formData.getAll("orderId").map(String));

  if (!parsed.ok) {
    return {
      type: "error",
      message: parsed.message,
      closed: 0,
      failures: [],
    };
  }

  const context = {
    organizationId: membership.organization.id,
    userId: session.user.id,
    role: membership.role,
  };
  let closed = 0;
  const failures: CloseOrdersActionState["failures"] = [];

  for (const orderId of parsed.ids) {
    try {
      const result = await database.$transaction((transaction) =>
        applyOrderStatusChange(transaction, context, {
          orderId,
          status: "CLOSED",
          sentSubstatus: null,
        }),
      );
      if (result.changed) closed += 1;
    } catch (error) {
      if (!(error instanceof OrderStatusUpdateError)) {
        console.error("No se pudo cerrar el pedido", orderId, error);
      }
      failures.push({
        orderId,
        reason:
          error instanceof OrderStatusUpdateError
            ? error.message
            : "No se pudo cerrar. Inténtalo nuevamente.",
      });
    }
  }

  if (closed > 0) revalidatePath("/orders");

  const closedText =
    closed === 1 ? "Se cerró 1 pedido." : `Se cerraron ${closed} pedidos.`;
  const failedText =
    failures.length === 0
      ? ""
      : failures.length === 1
        ? " 1 no se cerró."
        : ` ${failures.length} no se cerraron.`;

  return {
    type: failures.length > 0 && closed === 0 ? "error" : "success",
    message: `${closedText}${failedText}`,
    closed,
    failures,
  };
}
