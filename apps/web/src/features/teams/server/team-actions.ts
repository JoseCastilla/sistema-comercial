"use server";

import { revalidatePath } from "next/cache";

import { canAssignCommercialTeamMember } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { TeamActionState } from "./team-action.types";

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTeamName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

type TeamAssignmentMode = "AGENT" | "SUPERVISOR" | "SELLING_SUPERVISOR";

function isTeamAssignmentMode(value: string): value is TeamAssignmentMode {
  return (
    value === "AGENT" ||
    value === "SUPERVISOR" ||
    value === "SELLING_SUPERVISOR"
  );
}

function revalidateTeamPages(): void {
  revalidatePath("/admin/teams");
  revalidatePath("/admin/users");
}

export async function createTeamAction(
  previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  void previousState;

  const { membership, session } = await requireAdminAccess();
  const name = readText(formData.get("name"));
  const code = readText(formData.get("code")).toUpperCase();
  const normalizedName = normalizeTeamName(name);
  const fieldErrors: NonNullable<TeamActionState["fieldErrors"]> = {};

  if (name.length < 2 || name.length > 150) {
    fieldErrors.name = "Usa un nombre de 2 a 150 caracteres";
  }

  if (code.length > 50) {
    fieldErrors.code = "El código no puede superar 50 caracteres";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      type: "error",
      message: "Revisa los datos del equipo.",
      fieldErrors,
    };
  }

  const duplicate = await database.commercialTeam.findFirst({
    where: {
      organizationId: membership.organization.id,
      normalizedName,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (duplicate) {
    return {
      type: "error",
      message: "Ya existe un equipo activo con ese nombre.",
      fieldErrors: { name: "El nombre ya está en uso" },
    };
  }

  try {
    await database.$transaction(async (transaction) => {
      const team = await transaction.commercialTeam.create({
        data: {
          organizationId: membership.organization.id,
          name,
          normalizedName,
          code: code || null,
          createdByUserId: session.user.id,
        },
        select: { id: true },
      });

      await transaction.commercialTeamAuditLog.create({
        data: {
          organizationId: membership.organization.id,
          teamId: team.id,
          action: "TEAM_CREATED",
          actorUserId: session.user.id,
          newValues: {
            name,
            normalizedName,
            code: code || null,
            status: "ACTIVE",
          },
        },
      });
    });
  } catch (error) {
    console.error("No se pudo crear el equipo comercial", {
      error,
      organizationId: membership.organization.id,
      normalizedName,
    });

    return {
      type: "error",
      message:
        "No se pudo crear el equipo. Verifica que el nombre no esté repetido.",
    };
  }

  revalidateTeamPages();
  return { type: "success", message: `Equipo ${name} creado.` };
}

export async function disableTeamAction(formData: FormData): Promise<void> {
  const { membership, session } = await requireAdminAccess();
  const teamId = readText(formData.get("teamId"));

  if (!teamId) {
    return;
  }

  const team = await database.commercialTeam.findFirst({
    where: {
      id: teamId,
      organizationId: membership.organization.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!team) {
    return;
  }

  const disabledAt = new Date();

  await database.$transaction([
    database.commercialTeam.update({
      where: { id: team.id },
      data: { status: "DISABLED" },
    }),
    database.commercialTeamMember.updateMany({
      where: { teamId: team.id, isActive: true },
      data: { isActive: false, isPrimary: false, validUntil: disabledAt },
    }),
    database.commercialTeamAuditLog.create({
      data: {
        organizationId: membership.organization.id,
        teamId: team.id,
        action: "TEAM_DISABLED",
        actorUserId: session.user.id,
        previousValues: { status: "ACTIVE" },
        newValues: { status: "DISABLED", disabledAt: disabledAt.toISOString() },
      },
    }),
  ]);

  revalidateTeamPages();
}

export async function assignTeamMemberAction(
  previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  void previousState;

  const { membership, session } = await requireAdminAccess();
  const teamId = readText(formData.get("teamId"));
  const userId = readText(formData.get("userId"));
  const assignmentMode = readText(formData.get("memberRole"));

  if (!teamId || !userId || !isTeamAssignmentMode(assignmentMode)) {
    return {
      type: "error",
      message: "Selecciona un equipo y una persona válidos.",
    };
  }

  const memberRole = assignmentMode === "AGENT" ? "AGENT" : "SUPERVISOR";
  const salesEnabled = assignmentMode !== "SUPERVISOR";

  const [team, targetMembership] = await Promise.all([
    database.commercialTeam.findFirst({
      where: {
        id: teamId,
        organizationId: membership.organization.id,
        status: "ACTIVE",
      },
      select: { id: true, name: true, organizationId: true, status: true },
    }),
    database.organizationMember.findFirst({
      where: {
        organizationId: membership.organization.id,
        userId,
        // SPEC-042 BR-012: asignar integrantes no promueve. «Supervisor que
        // también vende» solo aplica a quien ya es supervisor; a un asesor se
        // lo promueve desde Personas, con nombre propio.
        role: assignmentMode === "AGENT" ? "AGENT" : "SUPERVISOR",
        user: { status: "ACTIVE" },
      },
      select: {
        organizationId: true,
        role: true,
        userId: true,
        user: { select: { name: true, status: true } },
      },
    }),
  ]);

  if (!team || !targetMembership) {
    return {
      type: "error",
      message:
        "El equipo o la persona no pertenece a esta organización o no está activo.",
    };
  }

  if (
    !canAssignCommercialTeamMember({
      actorRole: membership.role,
      actorOrganizationId: membership.organization.id,
      teamOrganizationId: team.organizationId,
      memberOrganizationId: targetMembership.organizationId,
      teamStatus: team.status,
      memberUserStatus: targetMembership.user.status,
      memberOrganizationRole: targetMembership.role,
      targetMemberRole: memberRole,
      salesEnabled,
    })
  ) {
    return {
      type: "error",
      message: "La asignación solicitada no está permitida.",
    };
  }

  const assignedAt = new Date();
  const isPrimarySeller = salesEnabled;

  await database.$transaction(async (transaction) => {
    const previousMembership = await transaction.commercialTeamMember.findFirst(
      {
        where: {
          userId,
          isActive: true,
          team: { organizationId: membership.organization.id },
          ...(salesEnabled ? { salesEnabled: true } : { memberRole }),
        },
        select: { teamId: true, isPrimary: true, salesEnabled: true },
      },
    );

    if (salesEnabled) {
      await transaction.commercialTeamMember.updateMany({
        where: {
          userId,
          salesEnabled: true,
          isActive: true,
          team: { organizationId: membership.organization.id },
          NOT: { teamId },
        },
        data: { isActive: false, isPrimary: false, validUntil: assignedAt },
      });
    }

    await transaction.commercialTeamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: {
        organizationId: membership.organization.id,
        teamId,
        userId,
        memberRole,
        salesEnabled,
        isPrimary: isPrimarySeller,
        isActive: true,
        assignedByUserId: session.user.id,
        validFrom: assignedAt,
      },
      update: {
        memberRole,
        salesEnabled,
        isPrimary: isPrimarySeller,
        isActive: true,
        assignedByUserId: session.user.id,
        validFrom: assignedAt,
        validUntil: null,
      },
    });

    await transaction.commercialTeamAuditLog.create({
      data: {
        organizationId: membership.organization.id,
        teamId,
        action: "MEMBER_ASSIGNED",
        actorUserId: session.user.id,
        targetUserId: userId,
        previousValues: previousMembership
          ? {
              teamId: previousMembership.teamId,
              isPrimary: previousMembership.isPrimary,
              salesEnabled: previousMembership.salesEnabled,
            }
          : undefined,
        newValues: {
          teamId,
          memberRole,
          salesEnabled,
          isPrimary: isPrimarySeller,
          isActive: true,
        },
      },
    });
  });

  revalidateTeamPages();
  return {
    type: "success",
    message:
      assignmentMode === "SELLING_SUPERVISOR"
        ? `${targetMembership.user.name} ahora supervisa ${team.name} y mantiene su capacidad de venta.`
        : `${targetMembership.user.name} asignado a ${team.name}.`,
  };
}
