"use server";

import { revalidatePath } from "next/cache";

import { evaluateInternalLossReasonGates } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { SendOrderToRecoveryActionState } from "./recovery-action.types";
import type { RecoveryLossReasonOption } from "@repo/validation";

/**
 * Resolución de un caso de recuperación — SPEC-030 BR-041 a BR-044, BR-057.
 * Vale para ambos carriles: `RECOVERED` exige vincular la orden DITO nueva
 * con confirmación humana; `LOST` exige motivo estructurado, observación y el
 * criterio habilitante de su motivo. Nada se cierra solo.
 */
const lossReasons = new Set([
  "YA_MIGRO_OTRA_AGENCIA",
  "RECHAZO_DEFINITIVO",
  "INUBICABLE",
  "DEUDA",
  "DATOS_INVALIDOS",
  "NO_PORTABLE",
  "OTRO",
]);

const openStatuses = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
] as const;

export async function resolveRecoveryCaseAction(
  previousState: SendOrderToRecoveryActionState,
  formData: FormData,
): Promise<SendOrderToRecoveryActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  const caseId = String(formData.get("caseId") ?? "").trim();
  const resolution = String(formData.get("resolution") ?? "").trim();
  const recoveredOrderId = String(
    formData.get("recoveredOrderId") ?? "",
  ).trim();
  const lossReason = String(formData.get("lossReason") ?? "").trim();
  const observation = String(formData.get("observation") ?? "").trim();
  const expressRequest = formData.get("expressRequest") === "on";

  if (!caseId || (resolution !== "RECOVERED" && resolution !== "LOST")) {
    return { type: "error", message: "Elige cómo se resuelve el caso." };
  }
  if (resolution === "RECOVERED" && !recoveredOrderId) {
    return {
      type: "error",
      message:
        "Una recuperación exige vincular la orden DITO nueva que la respalda.",
    };
  }
  if (resolution === "LOST") {
    if (!lossReasons.has(lossReason)) {
      return {
        type: "error",
        message: "Una pérdida exige su motivo estructurado.",
      };
    }
    if (observation.length < 10) {
      return {
        type: "error",
        message: "Describe en al menos 10 caracteres por qué se perdió.",
      };
    }
    // BR-057: el motivo OTRO requiere aprobación del supervisor; el asesor
    // no puede usarlo por su cuenta.
    if (lossReason === "OTRO" && membership.role === "AGENT") {
      return {
        type: "error",
        message:
          "El motivo OTRO requiere que tu supervisor registre la pérdida.",
      };
    }
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
        : null;

    const recoveryCase = await transaction.recoveryCase.findFirst({
      where: {
        id: caseId,
        organizationId: membership.organization.id,
        status: { in: [...openStatuses] },
        ...(membership.role === "AGENT"
          ? { assignedUserId: session.user.id }
          : {}),
        ...(supervisedTeamIds
          ? {
              OR: [
                { assignedTeamId: { in: supervisedTeamIds } },
                { originalTeamId: { in: supervisedTeamIds } },
                { assignedUserId: session.user.id },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        documentNumber: true,
        sourceDitoOrderId: true,
        createdAt: true,
        holderName: true,
        attempts: { select: { result: true, createdAt: true } },
      },
    });

    if (!recoveryCase) return { kind: "NOT_FOUND" as const };

    // BR-057: el motivo se habilita solo con su evidencia. La solicitud
    // expresa del cliente habilita RECHAZO_DEFINITIVO de inmediato, siempre
    // que exista al menos un intento donde se haya escuchado.
    if (resolution === "LOST") {
      const gates = evaluateInternalLossReasonGates(recoveryCase.attempts);
      const gate = gates[lossReason as RecoveryLossReasonOption];
      const expressPath =
        lossReason === "RECHAZO_DEFINITIVO" &&
        expressRequest &&
        recoveryCase.attempts.length > 0;
      if (!gate.enabled && !expressPath) {
        return {
          kind: "GATE_BLOCKED" as const,
          missing: gate.missing ?? "El criterio del motivo aún no se cumple.",
        };
      }
    }

    let linkedOrderCode: string | null = null;
    if (resolution === "RECOVERED") {
      // BR-042: la orden vinculada debe ser real, del mismo cliente,
      // posterior al caso y distinta de la orden origen.
      const order = await transaction.ditoOrder.findFirst({
        where: {
          id: recoveredOrderId,
          organizationId: membership.organization.id,
          holderDocumentNumber: recoveryCase.documentNumber,
          ...(recoveryCase.sourceDitoOrderId
            ? { NOT: { id: recoveryCase.sourceDitoOrderId } }
            : {}),
          status: { not: "CANCELLED" },
          registeredAt: { gte: recoveryCase.createdAt },
        },
        select: { id: true, orderCodeRaw: true },
      });
      if (!order) return { kind: "ORDER_INVALID" as const };
      linkedOrderCode = order.orderCodeRaw;
    }

    const now = new Date();
    await transaction.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        status: resolution,
        resolvedAt: now,
        resolvedByUserId: session.user.id,
        nextActionAt: null,
        ...(resolution === "RECOVERED"
          ? { recoveredDitoOrderId: recoveredOrderId }
          : { lossReason: lossReason as never }),
      },
    });

    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId: membership.organization.id,
        caseId: recoveryCase.id,
        type: "CASE_RESOLVED",
        actorUserId: session.user.id,
        previousStatus: recoveryCase.status,
        newStatus: resolution,
        observation: observation || null,
        metadata:
          resolution === "RECOVERED"
            ? { recoveredDitoOrderId: recoveredOrderId }
            : { lossReason, expressRequest },
      },
    });

    return {
      kind: "DONE" as const,
      holderName: recoveryCase.holderName,
      linkedOrderCode,
    };
  });

  if (outcome.kind === "NOT_FOUND") {
    return {
      type: "error",
      message: "El caso no existe, ya se resolvió o está fuera de tu alcance.",
    };
  }
  if (outcome.kind === "ORDER_INVALID") {
    return {
      type: "error",
      message:
        "La orden elegida no respalda la recuperación: debe ser del mismo cliente, posterior al caso y no cancelada.",
    };
  }
  if (outcome.kind === "GATE_BLOCKED") {
    return { type: "error", message: outcome.missing };
  }

  revalidatePath("/recovery/sales");
  revalidatePath("/recovery/campaigns");
  revalidatePath("/orders");
  revalidatePath("/performance");

  return {
    type: "success",
    message:
      resolution === "RECOVERED"
        ? `Caso de ${outcome.holderName} recuperado con la orden ${outcome.linkedOrderCode}.`
        : `Caso de ${outcome.holderName} cerrado como perdido.`,
  };
}
