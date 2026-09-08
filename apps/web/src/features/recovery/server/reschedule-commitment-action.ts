"use server";

import { revalidatePath } from "next/cache";

import { parseLimaDateTimeLocal } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";
import { readUuid } from "@/server/forms/read-form";
import { formatLimaDateTime } from "@repo/ui/format";

import {
  commitmentSlotRange,
  recoveryCaseAccessWhere,
} from "./recovery-case-access";

import type { SendOrderToRecoveryActionState } from "./recovery-action.types";

/**
 * Reprogramar una cita acordada — SPEC-048 BR-008, BR-010, BR-016.
 *
 * No es una llamada: no crea intento, no cuenta para los tres del día ni
 * para las puertas de pérdida. La cita anterior queda RESCHEDULED con el
 * motivo, la nueva nace PENDING enlazada desde la anterior, y el reloj del
 * caso se mueve a la hora nueva. Solo actúa sobre una cita PENDING: si otro
 * la cerró antes, se rechaza y el borrador se conserva.
 */
export async function rescheduleCommitmentAction(
  previousState: SendOrderToRecoveryActionState,
  formData: FormData,
): Promise<SendOrderToRecoveryActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  const commitmentId = readUuid(formData.get("commitmentId"));
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  const reason = String(formData.get("reason") ?? "")
    .trim()
    .slice(0, 500);
  const clientRequestId = readUuid(formData.get("clientRequestId"));
  const now = new Date();

  if (!commitmentId) {
    return { type: "error", message: "La cita no existe." };
  }

  // BR-001: la hora es de Lima, no de la zona del servidor.
  const scheduledAt = scheduledAtRaw
    ? parseLimaDateTimeLocal(scheduledAtRaw)
    : null;
  if (!scheduledAt) {
    return {
      type: "error",
      message: "Indica la fecha y hora nuevas acordadas con el cliente.",
    };
  }
  if (scheduledAt.getTime() <= now.getTime()) {
    return { type: "error", message: "La fecha nueva debe estar en el futuro." };
  }
  if (reason.length < 5) {
    return {
      type: "error",
      message: "Escribe por qué se reprograma (al menos 5 caracteres).",
    };
  }

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
        case: {
          select: { holderName: true, status: true, assignedUserId: true },
        },
      },
    });

    if (!commitment) return { kind: "NOT_FOUND" as const };

    // Idempotencia: el reenvío del mismo formulario trae la misma clave y
    // encuentra la cita ya creada.
    if (clientRequestId) {
      const replayed = await transaction.recoveryCaseCommitment.findUnique({
        where: {
          caseId_clientRequestId: { caseId: commitment.caseId, clientRequestId },
        },
        select: { scheduledAt: true },
      });
      if (replayed) {
        return {
          kind: "DONE" as const,
          replayed: true,
          holderName: commitment.case.holderName,
          scheduledAt: replayed.scheduledAt,
          clash: null,
        };
      }
    }

    if (String(commitment.status) !== "PENDING") {
      return { kind: "CHANGED" as const };
    }

    const closed = await transaction.recoveryCaseCommitment.updateMany({
      where: { id: commitment.id, status: "PENDING" },
      data: {
        status: "RESCHEDULED",
        reason,
        closedByUserId: session.user.id,
        closedAt: now,
      },
    });
    if (closed.count !== 1) return { kind: "CHANGED" as const };

    const created = await transaction.recoveryCaseCommitment.create({
      data: {
        organizationId: membership.organization.id,
        caseId: commitment.caseId,
        scheduledAt,
        createdByUserId: session.user.id,
        clientRequestId,
      },
      select: { id: true },
    });

    await transaction.recoveryCaseCommitment.update({
      where: { id: commitment.id },
      data: { supersededById: created.id },
    });

    // AG-R03/BR-008: el reloj del caso sigue a la cita.
    await transaction.recoveryCase.update({
      where: { id: commitment.caseId },
      data: { status: "SCHEDULED", nextActionAt: scheduledAt },
    });

    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId: membership.organization.id,
        caseId: commitment.caseId,
        type: "COMMITMENT_RESCHEDULED",
        actorUserId: session.user.id,
        previousStatus: commitment.case.status,
        newStatus: "SCHEDULED",
        observation: reason,
        metadata: {
          commitmentId: commitment.id,
          newCommitmentId: created.id,
          previousScheduledAt: commitment.scheduledAt.toISOString(),
          scheduledAt: scheduledAt.toISOString(),
        },
      },
    });

    // BR-016: se advierte la coincidencia; nunca se rechaza.
    const clash = commitment.case.assignedUserId
      ? await transaction.recoveryCaseCommitment.findFirst({
          where: {
            organizationId: membership.organization.id,
            status: "PENDING",
            id: { not: created.id },
            scheduledAt: commitmentSlotRange(scheduledAt),
            case: { assignedUserId: commitment.case.assignedUserId },
          },
          select: { case: { select: { holderName: true } } },
        })
      : null;

    return {
      kind: "DONE" as const,
      replayed: false,
      holderName: commitment.case.holderName,
      scheduledAt,
      clash: clash?.case.holderName ?? null,
    };
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

  const when = formatLimaDateTime(outcome.scheduledAt);

  return {
    type: "success",
    message: outcome.replayed
      ? `La cita de ${outcome.holderName} ya estaba reprogramada para el ${when}.`
      : `Cita de ${outcome.holderName} reprogramada para el ${when}.${
          outcome.clash
            ? ` Ojo: a esa misma hora ya tienes una llamada acordada con ${outcome.clash}.`
            : ""
        }`,
  };
}
