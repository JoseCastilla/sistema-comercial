"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { OrderStatus } from "@/generated/prisma/enums";
import { requireAccess, type Access } from "@/server/auth/access";
import { database } from "@/server/database";
import { decimal, failure, optionalText, text, type ActionState } from "@/server/forms";
import { ORDER_STATUS_LABELS } from "@/server/opportunities/rules";
import { createOrder, linkOrder, setOrderStatus } from "@/server/orders/service";
import { zonedTimeToUtc } from "@/lib/time";

/** Registrar pedidos y cambiar su estado: dueño, supervisor y back office. */
function assertCanRegister(access: Access) {
  if (access.role === "AGENT") throw new Error("Los pedidos los registra el back office o un supervisor.");
}

function revalidate(orderId?: string) {
  revalidatePath("/orders");
  if (orderId) revalidatePath(`/orders/${orderId}`);
  revalidatePath("/pipeline");
  revalidatePath("/reports");
}

export async function registerOrder(_state: ActionState, formData: FormData): Promise<ActionState> {
  let orderId: string;
  try {
    const access = await requireAccess();
    assertCanRegister(access);
    const date = optionalText(formData, "registeredDate");
    const time = text(formData, "registeredTime") || "00:00";
    const result = await createOrder({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      externalRef: text(formData, "externalRef"),
      documentNumber: optionalText(formData, "documentNumber"),
      holderName: optionalText(formData, "holderName"),
      phone: optionalText(formData, "phone"),
      planName: optionalText(formData, "planName") ?? optionalText(formData, "planFree"),
      fixedCharge: decimal(formData, "fixedCharge"),
      registeredAt: date ? zonedTimeToUtc(date, time, access.timezone) : null,
    });
    orderId = result.orderId;
    revalidate(orderId);
  } catch (error) {
    return failure(error);
  }
  redirect(`/orders/${orderId}`);
}

export async function changeOrderStatus(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    assertCanRegister(access);
    const status = text(formData, "status") as OrderStatus;
    if (!(status in ORDER_STATUS_LABELS)) throw new Error("Estado desconocido.");
    const orderId = text(formData, "orderId");
    await setOrderStatus({ organizationId: access.organizationId, orderId, status, actorUserId: access.userId });
    revalidate(orderId);
    return { ok: true, message: `Pedido ${ORDER_STATUS_LABELS[status].toLowerCase()}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function linkOrderToOpportunity(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const orderId = text(formData, "orderId");
    const opportunityId = text(formData, "opportunityId");
    const opportunity = await database.opportunity.findFirst({
      where: { id: opportunityId, organizationId: access.organizationId, ...(access.role === "AGENT" ? { assignedUserId: access.userId } : {}) },
      select: { id: true },
    });
    if (!opportunity) throw new Error(access.role === "AGENT" ? "Solo puedes vincular pedidos a tus oportunidades." : "La oportunidad no existe.");
    await linkOrder({ organizationId: access.organizationId, orderId, opportunityId: opportunity.id, actorUserId: access.userId });
    revalidate(orderId);
    return { ok: true, message: "Pedido vinculado: la oportunidad queda ganada." };
  } catch (error) {
    return failure(error);
  }
}
