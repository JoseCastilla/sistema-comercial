"use server";

import { revalidatePath } from "next/cache";

import { canCreateAgentForTeam } from "@repo/validation";

import {
  discardProvisionedUser,
  provisionUser,
} from "@/features/users/server/provision-user";
import { requireCommercialAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { CreateUserActionState } from "@/features/users/server/user-action.types";

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Alta de un asesor por su supervisor — SPEC-001 BR-011 a BR-013 vía SPEC-043
 * PE-07 (BR-014).
 *
 * El supervisor solo crea asesores (rol fijo) y solo en equipos activos que
 * supervisa; la administración puede usar la misma puerta para cualquier
 * equipo activo. Cuenta, membresía de organización y membresía comercial
 * primaria nacen juntas: si algo falla, no queda una cuenta a medias.
 */
export async function createAgentForTeamAction(
  previousState: CreateUserActionState,
  formData: FormData,
): Promise<CreateUserActionState> {
  void previousState;

  const { session, membership } = await requireCommercialAccess();
  const name = readText(formData.get("name"));
  const email = readText(formData.get("email")).toLowerCase();
  const password =
    typeof formData.get("password") === "string"
      ? (formData.get("password") as string)
      : "";
  const teamId = readText(formData.get("teamId"));

  const fieldErrors: NonNullable<CreateUserActionState["fieldErrors"]> = {};

  if (name.length < 2) {
    fieldErrors.name = "Ingresa el nombre completo";
  } else if (name.length > 150) {
    fieldErrors.name = "El nombre no puede superar 150 caracteres";
  }
  if (!email) {
    fieldErrors.email = "Ingresa el correo";
  } else if (email.length > 254 || !isValidEmail(email)) {
    fieldErrors.email = "Ingresa un correo válido";
  }
  if (password.length < 12) {
    fieldErrors.password = "La contraseña debe tener al menos 12 caracteres";
  } else if (password.length > 128) {
    fieldErrors.password = "La contraseña no puede superar 128 caracteres";
  }
  if (!teamId) {
    fieldErrors.role = "Elige el equipo del asesor";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      type: "error",
      message: "Revisa los datos del asesor.",
      fieldErrors,
    };
  }

  const [team, supervised, existingUser] = await Promise.all([
    database.commercialTeam.findFirst({
      where: { id: teamId, organizationId: membership.organization.id },
      select: { id: true, name: true, status: true },
    }),
    membership.role === "SUPERVISOR"
      ? database.commercialTeamMember.findMany({
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
      : Promise.resolve([]),
    database.user.findUnique({ where: { email }, select: { id: true } }),
  ]);

  if (!team) {
    return {
      type: "error",
      message: "El equipo no existe en esta organización.",
      fieldErrors: { role: "Equipo no válido" },
    };
  }

  const decision = canCreateAgentForTeam({
    actorRole: membership.role,
    supervisedTeamIds: supervised.map((item) => item.teamId),
    teamId: team.id,
    teamStatus: team.status,
  });

  if (!decision) {
    return {
      type: "error",
      message: "Solo puedes crear asesores en equipos activos que supervisas.",
    };
  }

  if (existingUser) {
    return {
      type: "error",
      message: "Ya existe una cuenta registrada con ese correo.",
      fieldErrors: { email: "El correo ya está registrado" },
    };
  }

  let userId: string | null = null;

  try {
    ({ userId } = await provisionUser({
      organizationId: membership.organization.id,
      name,
      email,
      password,
      role: "AGENT",
    }));

    const now = new Date();

    await database.$transaction([
      database.commercialTeamMember.create({
        data: {
          organizationId: membership.organization.id,
          teamId: team.id,
          userId,
          memberRole: "AGENT",
          salesEnabled: true,
          isPrimary: true,
          isActive: true,
          assignedByUserId: session.user.id,
          validFrom: now,
        },
      }),
      database.commercialTeamAuditLog.create({
        data: {
          organizationId: membership.organization.id,
          teamId: team.id,
          action: "MEMBER_ASSIGNED",
          actorUserId: session.user.id,
          targetUserId: userId,
          newValues: {
            teamId: team.id,
            memberRole: "AGENT",
            salesEnabled: true,
            isPrimary: true,
            isActive: true,
            createdBySupervisor: membership.role === "SUPERVISOR",
          },
        },
      }),
    ]);
  } catch (error) {
    if (userId) await discardProvisionedUser(userId);

    console.error("No se pudo crear el asesor para el equipo", {
      error,
      email,
      teamId: team.id,
      organizationId: membership.organization.id,
      performedByUserId: session.user.id,
    });

    return {
      type: "error",
      message:
        "No se pudo crear el asesor. Nada quedó a medias; verifica los datos e inténtalo de nuevo.",
    };
  }

  revalidatePath("/team");
  revalidatePath("/admin/users");
  revalidatePath("/admin/teams");

  return {
    type: "success",
    message: `${name} ya es asesor de ${team.name}. Comparte la contraseña por un canal seguro: no podrá consultarse después.`,
  };
}
