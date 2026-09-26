"use server";

import { revalidatePath } from "next/cache";

import { ditoOrderStatusUpdateSchema } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import {
  applyOrderStatusChange,
  OrderStatusUpdateError,
} from "./order-status-change";

import type { OrderStatusActionState } from "./order-status-action.types";

export async function updateOrderStatusAction(
  previousState: OrderStatusActionState,
  formData: FormData,
): Promise<OrderStatusActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  const parsed = ditoOrderStatusUpdateSchema.safeParse({
    orderId: formData.get("orderId"),

    status: formData.get("status"),

    sentSubstatus: formData.get("sentSubstatus"),

    observation: formData.get("observation"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;

    return {
      type: "error",

      message: "Revisa los datos del estado.",

      fieldErrors: {
        status: errors.status?.[0],

        sentSubstatus: errors.sentSubstatus?.[0],

        observation: errors.observation?.[0],
      },
    };
  }

  try {
    const result = await database.$transaction(async (transaction) => {
      return applyOrderStatusChange(
        transaction,
        {
          organizationId: membership.organization.id,
          userId: session.user.id,
          role: membership.role,
        },
        {
          orderId: parsed.data.orderId,
          status: parsed.data.status,
          sentSubstatus: parsed.data.sentSubstatus,
          observation: parsed.data.observation ?? null,
        },
      );
    });

    revalidatePath("/orders");

    return {
      type: "success",

      message: result.changed
        ? `Estado de ${result.orderCode} actualizado.`
        : "cancellationRequested" in result && result.cancellationRequested
          ? `Solicitud de cancelación de ${result.orderCode} enviada para revisión.`
          : "No se encontraron cambios para guardar.",
    };
  } catch (error) {
    if (error instanceof OrderStatusUpdateError) {
      return {
        type: "error",

        message: error.message,
      };
    }

    console.error("No se pudo actualizar la orden DITO", error);

    return {
      type: "error",

      message: "No se pudo guardar el estado. Inténtalo nuevamente.",
    };
  }
}
