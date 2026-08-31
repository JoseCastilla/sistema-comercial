"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isQuotaPeriodEditable, parseQuotaPeriod } from "@repo/validation";

import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

export interface QuotaActionState {
  type: "idle" | "success" | "error";
  message: string;
}

/**
 * Asignación de cuota — SPEC-038 BR-009 a BR-011.
 *
 * `ADMIN` y `BACKOFFICE` fijan la cuota del equipo; `SUPERVISOR` la reparte
 * entre los asesores de sus equipos. Un período terminado no se toca.
 */
const assignerRoles = new Set(["ADMIN", "BACKOFFICE", "SUPERVISOR"]);

export async function assignPerformanceQuotaAction(
  previousState: QuotaActionState,
  formData: FormData,
): Promise<QuotaActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();
  if (!assignerRoles.has(membership.role)) {
    redirect("/access-denied");
  }

  const scope = String(formData.get("scope") ?? "").trim();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const windowRaw = String(formData.get("window") ?? "").trim();
  const periodKey = String(formData.get("period") ?? "").trim();
  const rawTarget = Number(formData.get("target"));

  if (scope !== "ORG" && scope !== "TEAM" && scope !== "USER") {
    return { type: "error", message: "Destino de cuota no reconocido." };
  }
  if (scope !== "ORG" && !targetId) {
    return { type: "error", message: "Falta el destinatario." };
  }
  if (windowRaw !== "ONE" && windowRaw !== "TWO") {
    return { type: "error", message: "Falta la ventana." };
  }
  // BR-009b: la cuota de la organización es el ancla de todo el reparto y la
  // fija administración.
  if (scope === "ORG" && membership.role !== "ADMIN") {
    return {
      type: "error",
      message: "Solo administración fija la cuota de la organización.",
    };
  }
  const windowKey: "ONE" | "TWO" = windowRaw;
  if (!Number.isSafeInteger(rawTarget) || rawTarget < 0 || rawTarget > 9_999) {
    return {
      type: "error",
      message: "La cuota debe ser un número entero entre 0 y 9999.",
    };
  }

  const now = new Date();
  const currentPeriodKey = parseQuotaPeriod(undefined, now);
  // Admite meses futuros: una cuota se planifica antes del período.
  const period = parseQuotaPeriod(periodKey, now);
  if (!isQuotaPeriodEditable(period, currentPeriodKey)) {
    return {
      type: "error",
      message:
        "Ese período ya terminó. Cambiar su cuota reescribiría la historia de cumplimiento.",
    };
  }

  // BR-009: solo administración fija la cuota del equipo.
  if (scope === "TEAM" && membership.role === "SUPERVISOR") {
    return {
      type: "error",
      message:
        "La cuota del equipo la fija administración; tú la repartes entre tus asesores.",
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
        : null;

    let label = "";
    if (scope === "ORG") {
      label = "la organización";
    } else if (scope === "TEAM") {
      const team = await transaction.commercialTeam.findFirst({
        where: {
          id: targetId,
          organizationId: membership.organization.id,
          status: "ACTIVE",
        },
        select: { name: true },
      });
      if (!team) return { kind: "NOT_FOUND" as const };
      label = team.name;
    } else {
      // El asesor debe ser vendedor activo y, para un supervisor, de sus
      // propios equipos.
      const advisor = await transaction.commercialTeamMember.findFirst({
        where: {
          userId: targetId,
          salesEnabled: true,
          isActive: true,
          isPrimary: true,
          user: { status: "ACTIVE" },
          team: {
            organizationId: membership.organization.id,
            status: "ACTIVE",
            ...(supervisedTeamIds ? { id: { in: supervisedTeamIds } } : {}),
          },
        },
        select: { user: { select: { name: true } } },
      });
      if (!advisor) return { kind: "OUT_OF_SCOPE" as const };
      label = advisor.user.name;
    }

    const base = {
      organizationId: membership.organization.id,
      periodKey: period,
      window: windowKey,
    };
    const where =
      scope === "ORG"
        ? { ...base, teamId: null, userId: null }
        : scope === "TEAM"
          ? { ...base, teamId: targetId }
          : { ...base, userId: targetId };

    const existing = await transaction.performanceQuota.findFirst({
      where,
      select: { id: true, target: true },
    });

    if (existing) {
      await transaction.performanceQuota.update({
        where: { id: existing.id },
        data: {
          target: rawTarget,
          previousTarget: existing.target,
          assignedByUserId: session.user.id,
          assignedAt: now,
        },
      });
    } else {
      await transaction.performanceQuota.create({
        data: {
          organizationId: membership.organization.id,
          periodKey: period,
          window: windowKey,
          // Sin equipo ni asesor, la fila es la cuota de la organización.
          teamId: scope === "TEAM" ? targetId : null,
          userId: scope === "USER" ? targetId : null,
          target: rawTarget,
          assignedByUserId: session.user.id,
          assignedAt: now,
        },
      });
    }

    return { kind: "DONE" as const, label };
  });

  if (outcome.kind === "NOT_FOUND") {
    return { type: "error", message: "El equipo no existe o está inactivo." };
  }
  if (outcome.kind === "OUT_OF_SCOPE") {
    return {
      type: "error",
      message: "Ese asesor no es vendedor activo dentro de tu alcance.",
    };
  }

  revalidatePath("/performance/quotas");
  revalidatePath("/performance");

  return {
    type: "success",
    message: `Cuota de ${outcome.label} fijada en ${rawTarget} portabilidades entregadas.`,
  };
}
