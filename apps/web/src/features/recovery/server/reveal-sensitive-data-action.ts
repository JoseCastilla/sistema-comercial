"use server";

import { revalidatePath } from "next/cache";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { RecoveryTriageActionState } from "./recovery-action.types";

/**
 * Revelación auditada de los datos de validación de identidad — SPEC-030
 * BR-045 y BR-046. Solo el asesor asignado, solo en un caso con validación
 * pendiente y solo después de un intento `INTERESADO`. La revelación queda
 * registrada con actor, caso y momento en el propio caso.
 */
export async function revealSensitiveDataAction(
  previousState: RecoveryTriageActionState,
  formData: FormData,
): Promise<RecoveryTriageActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  const caseId = String(formData.get("caseId") ?? "").trim();
  if (!caseId) {
    return { type: "error", message: "El caso no es válido." };
  }

  const outcome = await database.$transaction(async (transaction) => {
    const recoveryCase = await transaction.recoveryCase.findFirst({
      where: {
        id: caseId,
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        assignedUserId: session.user.id,
        requiresIdentityValidation: true,
        sensitiveRevealedAt: null,
        status: { in: ["ASSIGNED", "IN_PROGRESS", "SCHEDULED"] },
      },
      select: {
        id: true,
        attempts: {
          where: { result: "INTERESADO" },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!recoveryCase) return { kind: "NOT_ELIGIBLE" as const };
    if (recoveryCase.attempts.length === 0) {
      return { kind: "NO_INTERESTED_ATTEMPT" as const };
    }

    await transaction.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        sensitiveRevealedAt: new Date(),
        sensitiveRevealedByUserId: session.user.id,
      },
    });

    return { kind: "DONE" as const };
  });

  if (outcome.kind === "NOT_ELIGIBLE") {
    return {
      type: "error",
      message:
        "Este caso no admite revelar datos de validación: no está asignado a ti, ya fue validado o ya se revelaron.",
    };
  }
  if (outcome.kind === "NO_INTERESTED_ATTEMPT") {
    return {
      type: "error",
      message:
        "Primero registra un intento con resultado INTERESADO: los datos se revelan solo cuando el cliente quiere avanzar.",
    };
  }

  revalidatePath("/recovery/campaigns");

  return {
    type: "success",
    message:
      "Datos de validación revelados. La revelación quedó auditada con tu usuario y la hora.",
  };
}
