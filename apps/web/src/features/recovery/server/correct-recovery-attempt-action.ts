"use server";

import { revalidatePath } from "next/cache";

import {
  canCorrectAttempt,
  correctableResults,
  countOnSameLimaDay,
  noContactReasons,
  resolveRecoveryAttemptConsequence,
} from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";
import { readUuid } from "@/server/forms/read-form";

import { recoveryCaseAccessWhere } from "./recovery-case-access";

import type { SendOrderToRecoveryActionState } from "./recovery-action.types";

const resolvedStatuses = new Set(["RECOVERED", "LOST", "DISCARDED"]);

/**
 * Rectificar un intento — SPEC-049 BR-017, BR-018.
 *
 * El original no se toca: se crea un registro que declara el resultado
 * efectivo, con autor, motivo y momento; la cadencia, las puertas y los
 * contadores leen ese resultado con la fecha del original. No es un
 * contacto nuevo. La consecuencia del resultado efectivo se aplica desde el
 * momento de la corrección (una pausa que no fue se levanta ya) y solo si
 * el intento rectificado es el más reciente del caso: los posteriores ya
 * decidieron el estado. Quién puede y hasta cuándo: `canCorrectAttempt`.
 */
export async function correctRecoveryAttemptAction(
  previousState: SendOrderToRecoveryActionState,
  formData: FormData,
): Promise<SendOrderToRecoveryActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  const attemptId = readUuid(formData.get("attemptId"));
  const effectiveResult = String(formData.get("effectiveResult") ?? "").trim();
  const effectiveReasonRaw = String(formData.get("effectiveReason") ?? "").trim();
  const observation =
    String(formData.get("observation") ?? "")
      .trim()
      .slice(0, 2000) || null;
  const correctionReason = String(formData.get("correctionReason") ?? "")
    .trim()
    .slice(0, 500);
  const now = new Date();

  if (!attemptId) {
    return { type: "error", message: "El intento no existe." };
  }
  if (!correctableResults.some((option) => option.value === effectiveResult)) {
    return {
      type: "error",
      message:
        "Elige el resultado correcto. Para agendar, registrar antigüedad o un impedimento, registra un intento nuevo.",
    };
  }
  if (correctionReason.length < 5) {
    return {
      type: "error",
      message: "Escribe por qué se rectifica (al menos 5 caracteres).",
    };
  }
  const effectiveReason =
    effectiveResult === "SIN_RESPUESTA"
      ? noContactReasons.includes(effectiveReasonRaw as never)
        ? effectiveReasonRaw
        : "NO_CONTESTA"
      : null;

  const outcome = await database.$transaction(async (transaction) => {
    const access = await recoveryCaseAccessWhere(transaction, {
      userId: session.user.id,
      role: membership.role,
      organizationId: membership.organization.id,
    });

    const attempt = await transaction.recoveryCaseAttempt.findFirst({
      where: { id: attemptId, case: access },
      select: {
        id: true,
        caseId: true,
        result: true,
        phoneUsed: true,
        actorUserId: true,
        createdAt: true,
        correction: { select: { id: true } },
        case: {
          select: {
            id: true,
            status: true,
            source: true,
            holderName: true,
            claimedAt: true,
            createdAt: true,
            firstContactAt: true,
            phones: { select: { phoneNumber: true, invalidMarkedAt: true } },
            services: {
              where: { discardedAt: null },
              select: { serviceNumber: true },
            },
            attempts: {
              orderBy: { createdAt: "desc" },
              take: 30,
              select: { id: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!attempt) return { kind: "NOT_FOUND" as const };

    const gate = canCorrectAttempt(
      {
        role: membership.role,
        userId: session.user.id,
        // El acceso ya acotó al supervisor a sus equipos (o al caso a su cargo).
        supervisesCase: membership.role === "SUPERVISOR",
      },
      {
        actorUserId: attempt.actorUserId,
        createdAt: attempt.createdAt,
        alreadyCorrected: attempt.correction !== null,
        caseResolved: resolvedStatuses.has(String(attempt.case.status)),
      },
      now,
    );
    if (!gate.allowed) {
      return { kind: "FORBIDDEN" as const, reason: gate.reason ?? "" };
    }

    const original = String(attempt.result);
    if (original === effectiveResult && !observation) {
      return {
        kind: "FORBIDDEN" as const,
        reason: "El resultado efectivo es el mismo que el registrado.",
      };
    }

    const correction = await transaction.recoveryCaseAttemptCorrection.create({
      data: {
        organizationId: membership.organization.id,
        caseId: attempt.caseId,
        attemptId: attempt.id,
        effectiveResult: effectiveResult as never,
        effectiveReason: effectiveReason as never,
        observation,
        correctionReason,
        actorUserId: session.user.id,
      },
      select: { id: true },
    });

    // BR-002 con rectificación: el teléfono sigue la verdad efectiva.
    const phone = attempt.phoneUsed;
    if (phone && original === "NUMERO_ERRADO" && effectiveResult !== "NUMERO_ERRADO") {
      const otherWrong = await transaction.recoveryCaseAttempt.count({
        where: {
          caseId: attempt.caseId,
          id: { not: attempt.id },
          phoneUsed: phone,
          result: "NUMERO_ERRADO",
          correction: null,
        },
      });
      if (otherWrong === 0) {
        await transaction.recoveryCasePhone.updateMany({
          where: { caseId: attempt.caseId, phoneNumber: phone },
          data: { invalidMarkedAt: null },
        });
      }
    }
    if (phone && effectiveResult === "NUMERO_ERRADO") {
      await transaction.recoveryCasePhone.updateMany({
        where: { caseId: attempt.caseId, phoneNumber: phone, invalidMarkedAt: null },
        data: { invalidMarkedAt: now },
      });
    }

    // La cita que nació de un AGENDA rectificado se cancela con motivo.
    if (original === "AGENDA") {
      await transaction.recoveryCaseCommitment.updateMany({
        where: { caseId: attempt.caseId, originAttemptId: attempt.id, status: "PENDING" },
        data: {
          status: "CANCELLED",
          reason: `Rectificación del intento: ${correctionReason}`,
          cancelNextAction: "RESUME_TODAY",
          closedByUserId: session.user.id,
          closedAt: now,
        },
      });
    }

    // BR-018: la consecuencia del resultado efectivo, desde ahora, solo si es
    // el intento más reciente del caso.
    const isLatest = attempt.case.attempts[0]?.id === attempt.id;
    let summary = "";
    if (isLatest && !resolvedStatuses.has(String(attempt.case.status))) {
      const validPhonesLeft =
        attempt.case.phones.filter(
          (item) =>
            item.invalidMarkedAt === null &&
            !(effectiveResult === "NUMERO_ERRADO" && item.phoneNumber === phone),
        ).length +
        attempt.case.services.filter((service) => service.serviceNumber !== phone).length;
      const consequence = resolveRecoveryAttemptConsequence({
        result: effectiveResult,
        reason: effectiveReason,
        now,
        attemptsToday: countOnSameLimaDay(
          attempt.case.attempts.map((item) => item.createdAt),
          now,
        ),
        managedSince: attempt.case.claimedAt ?? attempt.case.createdAt,
        isBaseCase: attempt.case.source === "NATIONAL_BASE",
        pauseDays: 1,
        validPhonesLeft,
        phoneUsed: phone,
      });
      if (consequence.marksLinesForRevalidation) {
        await transaction.recoveryCaseService.updateMany({
          where: { caseId: attempt.caseId, discardedAt: null },
          data: { needsRevalidation: true },
        });
      }
      await transaction.recoveryCase.update({
        where: { id: attempt.caseId },
        data: {
          status: consequence.status,
          nextActionAt: consequence.nextActionAt,
        },
      });
      summary = consequence.summary;
    }

    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId: membership.organization.id,
        caseId: attempt.caseId,
        type: "ATTEMPT_CORRECTED",
        actorUserId: session.user.id,
        previousStatus: attempt.case.status,
        observation: correctionReason,
        metadata: {
          attemptId: attempt.id,
          correctionId: correction.id,
          from: original,
          to: effectiveResult,
          appliedToCase: isLatest,
        },
      },
    });

    return {
      kind: "DONE" as const,
      holderName: attempt.case.holderName,
      summary,
      isLatest,
    };
  });

  if (outcome.kind === "NOT_FOUND") {
    return {
      type: "error",
      message: "El intento no existe o el caso no está a tu cargo.",
    };
  }
  if (outcome.kind === "FORBIDDEN") {
    return { type: "error", message: outcome.reason };
  }

  revalidatePath("/recovery/campaigns");
  revalidatePath("/recovery/agenda");
  revalidatePath("/recovery/follow-up");
  revalidatePath("/recovery/board");

  return {
    type: "success",
    message: `Intento de ${outcome.holderName} rectificado. ${
      outcome.isLatest
        ? outcome.summary
        : "Hubo gestiones posteriores, así que el estado del caso no cambia."
    }`.trim(),
  };
}
