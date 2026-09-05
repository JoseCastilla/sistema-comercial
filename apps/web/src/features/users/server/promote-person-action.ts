"use server";

import { revalidatePath } from "next/cache";

import { canPromotePerson } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { PersonLifecycleActionState } from "./person-lifecycle.types";

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Promoción a supervisor — SPEC-042 BR-011, BR-012 (sobre SPEC-019).
 *
 * Sube el rol de la organización y crea la membresía de supervisión del
 * equipo elegido. Si sigue vendiendo, su venta se concentra en ese equipo
 * (la convención de SPEC-019: el supervisor vendedor vende en el equipo que
 * supervisa); si no, su membresía de venta se cierra y sus ventas nuevas van
 * al pool. Lo histórico no se toca.
 */
export async function promotePersonAction(
  previousState: PersonLifecycleActionState,
  formData: FormData,
): Promise<PersonLifecycleActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const userId = readText(formData.get("userId"));
  const teamId = readText(formData.get("teamId"));
  const keepsSelling = formData.get("keepsSelling") === "on";
  // SPEC-043 PE-01: si sigue vendiendo y supervisa otro equipo, decide si su
  // venta se traslada (convención SPEC-019) o se queda donde está.
  const salesMode =
    readText(formData.get("salesMode")) === "KEEP" ? "KEEP" : "MOVE";

  if (!userId || !teamId) {
    return {
      type: "error",
      message: "Elige la persona y el equipo que va a supervisar.",
      fieldErrors: teamId ? {} : { teamId: "Elige el equipo" },
    };
  }

  const [target, team] = await Promise.all([
    database.organizationMember.findFirst({
      where: { organizationId: membership.organization.id, userId },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            status: true,
            commercialTeamMemberships: {
              where: {
                isActive: true,
                salesEnabled: true,
                isPrimary: true,
                team: {
                  organizationId: membership.organization.id,
                  status: "ACTIVE",
                },
              },
              select: { teamId: true, team: { select: { name: true } } },
            },
          },
        },
      },
    }),
    database.commercialTeam.findFirst({
      where: {
        id: teamId,
        organizationId: membership.organization.id,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
    }),
  ]);

  if (!target) {
    return {
      type: "error",
      message: "La persona no existe o pertenece a otra organización.",
    };
  }
  if (!team) {
    return {
      type: "error",
      message: "El equipo no existe o no está activo.",
      fieldErrors: { teamId: "Equipo no válido" },
    };
  }

  const primary = target.user.commercialTeamMemberships[0] ?? null;
  const decision = canPromotePerson({
    actorRole: membership.role,
    targetRole: target.role,
    targetStatus: target.user.status,
    hasPrimaryTeam: primary !== null,
  });

  if (!decision.allowed) {
    return { type: "error", message: decision.reason ?? "No permitido." };
  }

  try {
    await database.$transaction(async (transaction) => {
      const now = new Date();

      await transaction.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId: membership.organization.id,
            userId: target.user.id,
          },
        },
        data: { role: "SUPERVISOR" },
      });

      /*
       * Tres salidas, todas explícitas en el formulario (SPEC-043 PE-01):
       * - sigue vendiendo y su venta se traslada al equipo supervisado
       *   (convención SPEC-019: una sola membresía, supervisor con venta);
       * - sigue vendiendo donde está y supervisa otro equipo (dos
       *   membresías: la de venta intacta, la de supervisión sin venta);
       * - deja de vender: su membresía de venta se cierra con fecha.
       */
      const keepsSalesTeam =
        keepsSelling &&
        salesMode === "KEEP" &&
        primary !== null &&
        primary.teamId !== team.id;
      const preservedTeamIds = keepsSalesTeam
        ? [team.id, primary.teamId]
        : [team.id];

      await transaction.commercialTeamMember.updateMany({
        where: {
          userId: target.user.id,
          isActive: true,
          team: { organizationId: membership.organization.id },
          NOT: { teamId: { in: preservedTeamIds } },
        },
        data: { isActive: false, isPrimary: false, validUntil: now },
      });

      const supervisionSells = keepsSelling && !keepsSalesTeam;

      await transaction.commercialTeamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: target.user.id } },
        create: {
          organizationId: membership.organization.id,
          teamId: team.id,
          userId: target.user.id,
          memberRole: "SUPERVISOR",
          salesEnabled: supervisionSells,
          isPrimary: supervisionSells,
          isActive: true,
          assignedByUserId: session.user.id,
          validFrom: now,
        },
        update: {
          memberRole: "SUPERVISOR",
          salesEnabled: supervisionSells,
          isPrimary: supervisionSells,
          isActive: true,
          assignedByUserId: session.user.id,
          validFrom: now,
          validUntil: null,
        },
      });

      await transaction.commercialTeamAuditLog.create({
        data: {
          organizationId: membership.organization.id,
          teamId: team.id,
          action: "MEMBER_ASSIGNED",
          actorUserId: session.user.id,
          targetUserId: target.user.id,
          previousValues: primary
            ? {
                teamId: primary.teamId,
                memberRole: "AGENT",
                salesEnabled: true,
                isPrimary: true,
              }
            : undefined,
          newValues: {
            teamId: team.id,
            memberRole: "SUPERVISOR",
            salesEnabled: supervisionSells,
            isPrimary: supervisionSells,
            isActive: true,
            promotedToSupervisor: true,
            keepsSalesTeamId: keepsSalesTeam ? primary.teamId : null,
          },
        },
      });

      await transaction.personLifecycleEvent.create({
        data: {
          organizationId: membership.organization.id,
          userId: target.user.id,
          action: "PROMOTED",
          actorUserId: session.user.id,
          reason: "Promoción a supervisor",
          previousValues: {
            role: target.role,
            teamId: primary?.teamId ?? null,
            teamName: primary?.team.name ?? null,
          },
          newValues: {
            role: "SUPERVISOR",
            teamId: team.id,
            teamName: team.name,
            keepsSelling,
            salesTeamName: keepsSalesTeam
              ? primary.team.name
              : keepsSelling
                ? team.name
                : null,
          },
        },
      });
    });
  } catch (error) {
    console.error("No se pudo promover a la persona", {
      error,
      targetUserId: userId,
      organizationId: membership.organization.id,
      performedByUserId: session.user.id,
    });

    return {
      type: "error",
      message:
        "No se pudo completar la promoción. Nada cambió; inténtalo de nuevo.",
    };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/teams");

  return {
    type: "success",
    message: !keepsSelling
      ? `${target.user.name} ahora supervisa ${team.name} y deja de vender: sus ventas nuevas irán al pool.`
      : salesMode === "KEEP" && primary && primary.teamId !== team.id
        ? `${target.user.name} ahora supervisa ${team.name} y sigue vendiendo en ${primary.team.name}.`
        : `${target.user.name} ahora supervisa ${team.name} y sigue vendiendo ahí.`,
  };
}
