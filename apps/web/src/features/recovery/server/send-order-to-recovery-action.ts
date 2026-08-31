"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { resolveDitoOrderVisibility } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { openInternalRecoveryCase } from "./open-internal-recovery-case";

import type { SendOrderToRecoveryActionState } from "./recovery-action.types";
import type { RecoveryEntryReason } from "@repo/validation";

/**
 * Envío manual de una venta a recuperación — SPEC-030 BR-061 y BR-063.
 *
 * BR-049 y BR-067: un asesor no envía su propia venta a la cola compartida;
 * la acción es de supervisión, administración y backoffice.
 */
const senderRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

const entryReasons = new Set<RecoveryEntryReason>([
  "NO_ENTREGADO",
  "INCIDENCIA_LOGISTICA",
  "PROMESA_COMERCIAL_INCORRECTA",
  "DEUDA",
  "ANTIGUEDAD_PORTA",
  "OTRO",
]);

export async function sendOrderToRecoveryAction(
  previousState: SendOrderToRecoveryActionState,
  formData: FormData,
): Promise<SendOrderToRecoveryActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  if (!senderRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const orderId = String(formData.get("orderId") ?? "").trim();
  const rawReason = String(formData.get("entryReason") ?? "").trim();
  const observation = String(formData.get("observation") ?? "").trim();

  if (!orderId) {
    return { type: "error", message: "Falta la venta que quieres recuperar." };
  }
  if (!entryReasons.has(rawReason as RecoveryEntryReason)) {
    return {
      type: "error",
      message: "Elige el motivo comercial por el que entra a recuperación.",
    };
  }
  // BR-063: la observación es obligatoria en la entrada manual; es la que
  // preserva lo que dijo el cliente o el operador logístico.
  if (observation.length < 10) {
    return {
      type: "error",
      message:
        "Describe en al menos 10 caracteres qué ocurrió con esta venta.",
    };
  }

  const outcome = await database.$transaction(async (transaction) => {
    const supervisedTeamIds =
      membership.role === "SUPERVISOR"
        ? (
            await transaction.commercialTeamMember.findMany({
              where: {
                userId: session.user.id,
                memberRole: "SUPERVISOR",
                isActive: true,
                team: {
                  organizationId: membership.organization.id,
                  status: "ACTIVE",
                },
              },
              select: { teamId: true },
            })
          ).map((item) => item.teamId)
        : [];
    const primarySalesMembership =
      membership.role === "SUPERVISOR"
        ? await transaction.commercialTeamMember.findFirst({
            where: {
              userId: session.user.id,
              salesEnabled: true,
              isPrimary: true,
              isActive: true,
              team: {
                organizationId: membership.organization.id,
                status: "ACTIVE",
              },
            },
            select: { teamId: true },
          })
        : null;

    const order = await transaction.ditoOrder.findFirst({
      where: { id: orderId, organizationId: membership.organization.id },
      select: {
        id: true,
        orderCodeRaw: true,
        agentUserId: true,
        assignedTeamId: true,
        status: true,
        sentSubstatus: true,
        deliveryStatus: true,
        holderFullNameRaw: true,
        holderDocumentNumber: true,
        registeredAt: true,
        department: true,
        province: true,
        district: true,
      },
    });

    if (!order) return { kind: "NOT_FOUND" as const };

    // SPEC-026: cerrados y entregados no entran a recuperación.
    if (order.status === "CLOSED" || order.deliveryStatus === "DELIVERED") {
      return { kind: "NOT_RECOVERABLE" as const };
    }

    const visibility = resolveDitoOrderVisibility({
      role: membership.role,
      userId: session.user.id,
      supervisedTeamIds,
      orderAgentUserId: order.agentUserId,
      orderAssignedTeamId: order.assignedTeamId,
      salesEnabled: primarySalesMembership !== null,
    });
    if (visibility !== "FULL") return { kind: "FORBIDDEN" as const };

    // BR-067: un supervisor vendedor no mete su propia venta al circuito de
    // recuperación, porque terminaría gestionándola él mismo.
    if (order.agentUserId === session.user.id) {
      return { kind: "OWN_SALE" as const };
    }

    const result = await openInternalRecoveryCase(transaction, {
      organizationId: membership.organization.id,
      order,
      trigger: { status: order.status, sentSubstatus: order.sentSubstatus },
      actorUserId: session.user.id,
      noveltyAt: new Date(),
      entryReason: rawReason as RecoveryEntryReason,
      observation,
    });

    return { kind: "DONE" as const, result, orderCode: order.orderCodeRaw };
  });

  if (outcome.kind === "NOT_FOUND") {
    return {
      type: "error",
      message: "La venta no existe o pertenece a otra organización.",
    };
  }
  if (outcome.kind === "FORBIDDEN") {
    return {
      type: "error",
      message: "No tienes permiso sobre esta venta.",
    };
  }
  if (outcome.kind === "OWN_SALE") {
    return {
      type: "error",
      message:
        "No puedes enviar tu propia venta a recuperación. Pídelo a tu supervisor o a administración.",
    };
  }
  if (outcome.kind === "NOT_RECOVERABLE") {
    return {
      type: "error",
      message:
        "Una venta cerrada o entregada no entra a recuperación.",
    };
  }

  revalidatePath("/orders");
  revalidatePath("/recovery/triage");

  if (outcome.result.outcome === "SKIPPED") {
    return {
      type: "error",
      message:
        outcome.result.reason === "NO_DOCUMENT"
          ? "La venta no tiene documento del titular, así que no se puede abrir el caso."
          : "Esta venta no está en un estado recuperable.",
    };
  }

  return {
    type: "success",
    message:
      outcome.result.outcome === "MERGED"
        ? `${outcome.orderCode} se sumó al caso de recuperación que ya existía para ese cliente.`
        : `${outcome.orderCode} entró a recuperación.`,
  };
}
