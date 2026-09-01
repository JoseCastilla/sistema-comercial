"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { RecoveryTriageActionState } from "./recovery-action.types";

/**
 * Verificación manual de un caso reportado como "ya es Movistar" — SPEC-030
 * BR-085. La palabra del asesor nunca cierra el caso: lo cierra el reporte
 * (vía del administrador, en lote) o esta confirmación puntual del
 * supervisor, con su usuario registrado. Desmentir devuelve el caso a la
 * cola de su asesor con próxima acción inmediata: el cliente le mintió y
 * sigue portable.
 */
const verifierRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

export async function verifyReportedActiveAction(
  previousState: RecoveryTriageActionState,
  formData: FormData,
): Promise<RecoveryTriageActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();

  if (!verifierRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const caseId = String(formData.get("caseId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();

  if (!caseId || (decision !== "CONFIRMAR" && decision !== "DESMENTIR")) {
    return { type: "error", message: "Elige el resultado de la verificación." };
  }

  const supervisedTeamIds =
    membership.role === "SUPERVISOR"
      ? (
          await database.commercialTeamMember.findMany({
            where: {
              organizationId: membership.organization.id,
              userId: session.user.id,
              memberRole: "SUPERVISOR",
              isActive: true,
              team: { status: "ACTIVE" },
            },
            select: { teamId: true },
          })
        ).map((item) => item.teamId)
      : null;

  const outcome = await database.$transaction(async (transaction) => {
    const recoveryCase = await transaction.recoveryCase.findFirst({
      where: {
        id: caseId,
        organizationId: membership.organization.id,
        source: "NATIONAL_BASE",
        status: "WAITING",
        // Solo un caso que el asesor reportó: su último intento es YA_ACTIVO.
        attempts: { some: { result: "YA_ACTIVO" } },
        ...(supervisedTeamIds
          ? { assignedTeamId: { in: supervisedTeamIds } }
          : {}),
      },
      select: {
        id: true,
        holderName: true,
        assignedUserId: true,
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { result: true },
        },
      },
    });

    if (!recoveryCase || recoveryCase.attempts[0]?.result !== "YA_ACTIVO") {
      return { kind: "NOT_FOUND" as const };
    }

    const now = new Date();

    if (decision === "CONFIRMAR") {
      // BR-059: hubo gestión (el propio reporte del asesor), así que es
      // pérdida frente a otra agencia, no un descarte.
      await transaction.recoveryCaseService.updateMany({
        where: { caseId: recoveryCase.id, discardedAt: null },
        data: {
          discardedAt: now,
          discardReason: "YA_ACTIVO",
          needsRevalidation: false,
        },
      });

      await transaction.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: {
          status: "LOST",
          lossReason: "YA_MIGRO_OTRA_AGENCIA",
          resolvedAt: now,
          resolvedByUserId: session.user.id,
          nextActionAt: null,
        },
      });

      await transaction.recoveryCaseEvent.create({
        data: {
          organizationId: membership.organization.id,
          caseId: recoveryCase.id,
          type: "CASE_RESOLVED",
          actorUserId: session.user.id,
          previousStatus: "WAITING",
          newStatus: "LOST",
          observation:
            "Supervisión confirmó que el cliente ya está activo en Movistar (BR-085).",
          metadata: { lossReason: "YA_MIGRO_OTRA_AGENCIA", via: "MANUAL" },
        },
      });

      return { kind: "CONFIRMED" as const, holderName: recoveryCase.holderName };
    }

    const backToOwner = recoveryCase.assignedUserId !== null;
    await transaction.recoveryCaseService.updateMany({
      where: { caseId: recoveryCase.id, discardedAt: null },
      data: { needsRevalidation: false },
    });
    await transaction.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        status: backToOwner ? "ASSIGNED" : "TRIAGE",
        nextActionAt: backToOwner ? now : null,
      },
    });
    await transaction.recoveryCaseEvent.create({
      data: {
        organizationId: membership.organization.id,
        caseId: recoveryCase.id,
        type: "CASE_REOPENED",
        actorUserId: session.user.id,
        previousStatus: "WAITING",
        newStatus: backToOwner ? "ASSIGNED" : "TRIAGE",
        observation:
          "Supervisión verificó que la línea sigue portable: vuelve a la cola de trabajo.",
        metadata: { via: "MANUAL" },
      },
    });

    return { kind: "REJECTED" as const, holderName: recoveryCase.holderName };
  });

  if (outcome.kind === "NOT_FOUND") {
    return {
      type: "error",
      message:
        "El caso no está esperando confirmación o no pertenece a tus equipos.",
    };
  }

  revalidatePath("/recovery/campaigns");
  revalidatePath("/recovery/triage");

  return {
    type: "success",
    message:
      outcome.kind === "CONFIRMED"
        ? `${outcome.holderName} confirmado como ya activo: pérdida frente a otra agencia, con tu usuario como evidencia.`
        : `${outcome.holderName} sigue portable: volvió a la cola de su asesor con próxima acción inmediata.`,
  };
}
