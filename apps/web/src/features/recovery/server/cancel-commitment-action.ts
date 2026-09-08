"use server";

import { revalidatePath } from "next/cache";

import { getInternalRecoveryPauseUntil } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";
import { readUuid } from "@/server/forms/read-form";
import { formatLimaDateTime } from "@repo/ui/format";

import { recoveryCaseAccessWhere } from "./recovery-case-access";

import type { SendOrderToRecoveryActionState } from "./recovery-action.types";

const nextActions = new Set(["RESUME_TODAY", "PAUSE_1D", "PAUSE_2D"]);

/**
 * Cancelar una cita acordada — SPEC-048 BR-009, BR-010.
 *
 * Cancelar no cierra el caso ni lo deja sin próxima acción: el asesor dice
 * qué sigue —volver a la cadencia hoy o pausar uno o dos días (BR-033)— y
 * el reloj del caso se fija ahí. Para acordar otra hora se reprograma. Solo
 * actúa sobre una cita PENDING.
 */
export async function cancelCommitmentAction(
  previousState: SendOrderToRecoveryActionState,
  formData: FormData,
): Promise<SendOrderToRecoveryActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  const commitmentId = readUuid(formData.get("commitmentId"));
  const reason = String(formData.get("reason") ?? "")
    .trim()
    .slice(0, 500);
  const nextAction = String(formData.get("nextAction") ?? "").trim();
  const now = new Date();

  if (!commitmentId) {
    return { type: "error", message: "La cita no existe." };
  }
  if (reason.length < 5) {
    return {
      type: "error",
      message: "Escribe por qué se cancela (al menos 5 caracteres).",
    };
  }
  if (!nextActions.has(nextAction)) {
    return {
      type: "error",
      message: "Elige qué sigue: volver a la cadencia hoy o pausar el caso.",
    };
  }

  const nextActionAt =
    nextAction === "RESUME_TODAY"
      ? now
      : getInternalRecoveryPauseUntil(now, nextAction === "PAUSE_2D" ? 2 : 1);

  const outcome = await database.$transaction(async (transaction) => {
    const access = await recoveryCaseAccessWhere(transaction, {
      userId: session.user.id,
      role: membership.role,
      organizationId: membership.organization.id,
    });

    const commitment = await transaction.recoveryCaseCommitment.findFirst({
      where: { id: commitmentId, case: access },
      select: {
        id: true,
        caseId: true,
        status: true,
        scheduledAt: true,
        case: { select: { holderName: true, status: true } },
      },
    });

    if (!commitment) return { kind: "NOT_FOUND" as const };
    if (String(commitment.status) !== "PENDING") {
      return { kind: "CHANGED" as const };
    }

    const closed = await transaction.recoveryCaseCommitment.updateMany({
      where: { id: commitment.id, status: "PENDING" },
      data: {
        status: "CANCELLED",
        reason,
        cancelNextAction: nextAction as never,
        closedByUserId: session.user.id,
        closedAt: now,
      },
    });
    if (closed.count !== 1) return { kind: "CHANGED" as const };

    await transaction.recoveryCase.update({
      where: { id: commitment.caseId },
      data: { status: "IN_PROGRESS", nextActionAt },
    });

    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId: membership.organization.id,
        caseId: commitment.caseId,
        type: "COMMITMENT_CANCELLED",
        actorUserId: session.user.id,
        previousStatus: commitment.case.status,
        newStatus: "IN_PROGRESS",
        observation: reason,
        metadata: {
          commitmentId: commitment.id,
          scheduledAt: commitment.scheduledAt.toISOString(),
          nextAction,
          nextActionAt: nextActionAt.toISOString(),
        },
      },
    });

    return { kind: "DONE" as const, holderName: commitment.case.holderName };
  });

  if (outcome.kind === "NOT_FOUND") {
    return {
      type: "error",
      message: "La cita no existe o el caso no está a tu cargo.",
    };
  }
  if (outcome.kind === "CHANGED") {
    return {
      type: "error",
      message:
        "Esta cita ya cambió: alguien la atendió, reprogramó o canceló. Actualiza la agenda para ver su estado.",
    };
  }

  revalidatePath("/recovery/agenda");
  revalidatePath("/recovery/campaigns");

  return {
    type: "success",
    message:
      nextAction === "RESUME_TODAY"
        ? `Cita de ${outcome.holderName} cancelada. El caso vuelve a tu cola de hoy.`
        : `Cita de ${outcome.holderName} cancelada. El caso reaparece el ${formatLimaDateTime(nextActionAt)}.`,
  };
}
