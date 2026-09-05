"use server";

import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";

import { canReenterPerson } from "@repo/validation";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { PersonLifecycleActionState } from "./person-lifecycle.types";

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function readPassword(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Reingreso — SPEC-042 BR-008 a BR-010. La misma cuenta vuelve a activa con
 * equipo primario y contraseña nuevos; el rol vuelve como estaba salvo que se
 * elija otro. Nada de su historia se toca: es la misma persona.
 */
export async function reenterPersonAction(
  previousState: PersonLifecycleActionState,
  formData: FormData,
): Promise<PersonLifecycleActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();
  const userId = readText(formData.get("userId"));
  const roleValue = readText(formData.get("role"));
  const teamId = readText(formData.get("teamId"));
  const keepsSelling = formData.get("keepsSelling") === "on";
  const newEmail = readText(formData.get("newEmail")).toLowerCase();
  const newPassword = readPassword(formData.get("newPassword"));
  const confirmPassword = readPassword(formData.get("confirmPassword"));

  const fieldErrors: Record<string, string> = {};

  if (roleValue !== "AGENT" && roleValue !== "SUPERVISOR") {
    fieldErrors.role = "Elige asesor o supervisor";
  }
  if (!teamId) {
    fieldErrors.teamId = "Elige el equipo";
  }
  if (newEmail && (newEmail.length > 254 || !isValidEmail(newEmail))) {
    fieldErrors.newEmail = "Ingresa un correo válido";
  }
  if (newPassword.length < 12) {
    fieldErrors.newPassword = "La contraseña debe tener al menos 12 caracteres";
  } else if (newPassword.length > 128) {
    fieldErrors.newPassword = "La contraseña no puede superar 128 caracteres";
  }
  if (confirmPassword !== newPassword) {
    fieldErrors.confirmPassword = "Las contraseñas no coinciden";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      type: "error",
      message: "Revisa los datos del reingreso.",
      fieldErrors,
    };
  }

  const role = roleValue as "AGENT" | "SUPERVISOR";
  // Un asesor siempre vende; un supervisor, solo si se marca.
  const salesEnabled = role === "AGENT" ? true : keepsSelling;

  const target = await database.organizationMember.findFirst({
    where: { organizationId: membership.organization.id, userId },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  });

  if (!target) {
    return {
      type: "error",
      message: "La persona no existe o pertenece a otra organización.",
    };
  }

  const decision = canReenterPerson({
    actorRole: membership.role,
    targetRole: target.role,
    targetStatus: target.user.status,
  });

  if (!decision.allowed) {
    return { type: "error", message: decision.reason ?? "No permitido." };
  }

  const [team, credentialAccount, emailTaken] = await Promise.all([
    database.commercialTeam.findFirst({
      where: {
        id: teamId,
        organizationId: membership.organization.id,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
    }),
    database.account.findFirst({
      where: { userId: target.user.id, providerId: "credential" },
      select: { id: true },
    }),
    newEmail && newEmail !== target.user.email
      ? database.user.findUnique({
          where: { email: newEmail },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!team) {
    return {
      type: "error",
      message: "El equipo no existe o no está activo.",
      fieldErrors: { teamId: "Equipo no válido" },
    };
  }
  if (!credentialAccount) {
    return {
      type: "error",
      message: "La persona no tiene una cuenta de contraseña válida.",
    };
  }
  if (emailTaken) {
    return {
      type: "error",
      message: "Ya existe otra cuenta con ese correo.",
      fieldErrors: { newEmail: "El correo ya está registrado" },
    };
  }

  try {
    const passwordHash = await hashPassword(newPassword);

    await database.$transaction(async (transaction) => {
      const now = new Date();

      await transaction.user.update({
        where: { id: target.user.id },
        data: {
          status: "ACTIVE",
          emailVerified: true,
          ...(newEmail && newEmail !== target.user.email
            ? { email: newEmail }
            : {}),
        },
      });

      await transaction.account.update({
        where: { id: credentialAccount.id },
        data: { password: passwordHash },
      });

      await transaction.session.deleteMany({
        where: { userId: target.user.id },
      });

      if (target.role !== role) {
        await transaction.organizationMember.update({
          where: {
            organizationId_userId: {
              organizationId: membership.organization.id,
              userId: target.user.id,
            },
          },
          data: { role },
        });
      }

      // Por higiene: ninguna membresía vieja puede seguir activa.
      await transaction.commercialTeamMember.updateMany({
        where: {
          userId: target.user.id,
          isActive: true,
          team: { organizationId: membership.organization.id },
        },
        data: { isActive: false, isPrimary: false, validUntil: now },
      });

      await transaction.commercialTeamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: target.user.id } },
        create: {
          organizationId: membership.organization.id,
          teamId: team.id,
          userId: target.user.id,
          memberRole: role,
          salesEnabled,
          isPrimary: salesEnabled,
          isActive: true,
          assignedByUserId: session.user.id,
          validFrom: now,
        },
        update: {
          memberRole: role,
          salesEnabled,
          isPrimary: salesEnabled,
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
          newValues: {
            teamId: team.id,
            memberRole: role,
            salesEnabled,
            isPrimary: salesEnabled,
            isActive: true,
            reentered: true,
          },
        },
      });

      await transaction.personLifecycleEvent.create({
        data: {
          organizationId: membership.organization.id,
          userId: target.user.id,
          action: "REENTERED",
          actorUserId: session.user.id,
          reason: "Reingreso",
          previousValues: {
            status: target.user.status,
            role: target.role,
            email: target.user.email,
          },
          newValues: {
            status: "ACTIVE",
            role,
            email: newEmail || target.user.email,
            teamId: team.id,
            teamName: team.name,
            keepsSelling: salesEnabled,
          },
        },
      });
    });
  } catch (error) {
    console.error("No se pudo reingresar a la persona", {
      error,
      targetUserId: userId,
      organizationId: membership.organization.id,
      performedByUserId: session.user.id,
    });

    return {
      type: "error",
      message:
        "No se pudo completar el reingreso. Nada cambió; inténtalo de nuevo.",
    };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/teams");

  return {
    type: "success",
    message: `${target.user.name} reingresó como ${role === "AGENT" ? "asesor" : salesEnabled ? "supervisor que también vende" : "supervisor"} en ${team.name}, con contraseña nueva${newEmail && newEmail !== target.user.email ? ` y correo ${newEmail}` : ""}.`,
  };
}
