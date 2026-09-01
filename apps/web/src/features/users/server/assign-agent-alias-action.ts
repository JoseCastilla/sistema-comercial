"use server";

import {
  canActivateAgentAlias,
  normalizeAgentAlias,
} from "@repo/validation";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { AssignAgentAliasActionState } from "./user-action.types";

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function assignAgentAliasAction(
  previousState: AssignAgentAliasActionState,
  formData: FormData,
): Promise<AssignAgentAliasActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();

  const userId = readText(formData.get("userId"));
  const alias = readText(formData.get("alias"));
  const normalizedAlias = normalizeAgentAlias(alias);

  if (!isUuid(userId)) {
    return {
      type: "error",
      message: "El asesor seleccionado no es válido.",
    };
  }

  if (!normalizedAlias || alias.length < 2) {
    return {
      type: "error",
      message: "Revisa el alias DITO.",
      fieldErrors: {
        alias: "Ingresa un alias válido",
      },
    };
  }

  if (alias.length > 150 || normalizedAlias.length > 150) {
    return {
      type: "error",
      message: "Revisa el alias DITO.",
      fieldErrors: {
        alias: "El alias no puede superar 150 caracteres",
      },
    };
  }

  try {
    const targetMembership = await database.organizationMember.findFirst({
      where: {
        organizationId: membership.organization.id,
        userId,
        role: { in: ["AGENT", "SUPERVISOR"] },

        user: {
          status: "ACTIVE",
        },
      },

      select: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            commercialTeamMemberships: {
              where: {
                salesEnabled: true,
                isPrimary: true,
                isActive: true,
                team: {
                  status: "ACTIVE",
                },
              },
              take: 1,
              select: {
                isActive: true,
                salesEnabled: true,
                team: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!targetMembership) {
      return {
        type: "error",
        message: "El usuario no es un asesor activo de esta organización.",
      };
    }

    const primaryTeamMembership =
      targetMembership.user.commercialTeamMemberships[0];

    if (
      !canActivateAgentAlias({
        userStatus: targetMembership.user.status,
        organizationRole: targetMembership.role,
        primaryMembershipActive: primaryTeamMembership?.isActive ?? false,
        primarySalesEnabled:
          primaryTeamMembership?.salesEnabled ?? false,
        primaryTeamStatus: primaryTeamMembership?.team.status ?? null,
      })
    ) {
      return {
        type: "error",
        message: "Primero asigna al asesor a un equipo.",
      };
    }

    const conflictingAlias = await database.agentAlias.findFirst({
      where: {
        organizationId: membership.organization.id,
        normalizedAlias,
        isActive: true,

        NOT: {
          userId: targetMembership.user.id,
        },
      },

      select: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (conflictingAlias) {
      return {
        type: "error",
        message: `El alias ${normalizedAlias} ya está asignado a ${conflictingAlias.user.name} (${conflictingAlias.user.email}).`,
        fieldErrors: {
          alias: "El alias ya pertenece a otro asesor",
        },
      };
    }

    await database.agentAlias.upsert({
        where: {
          organizationId_userId_normalizedAlias: {
            organizationId: membership.organization.id,
            userId: targetMembership.user.id,
            normalizedAlias,
          },
        },

        update: {
          alias,
          isActive: true,
        },

        create: {
          organizationId: membership.organization.id,
          userId: targetMembership.user.id,
          alias,
          normalizedAlias,
          isActive: true,
        },
    });

    revalidatePath("/admin/users");

    return {
      type: "success",
      message: `Vínculo de alias ${normalizedAlias} asignado a ${targetMembership.user.name}. Las órdenes históricas no fueron modificadas.`,
    };
  } catch (error) {
    console.error("No se pudo asignar el alias DITO", {
      error,
      targetUserId: userId,
      organizationId: membership.organization.id,
      performedByUserId: session.user.id,
    });

    return {
      type: "error",
      message: "No se pudo asignar el alias DITO. Inténtalo nuevamente.",
    };
  }
}
