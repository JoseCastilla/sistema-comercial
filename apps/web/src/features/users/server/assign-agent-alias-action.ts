"use server";

import { normalizeAgentAlias } from "@repo/validation";

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
        role: "AGENT",

        user: {
          status: "ACTIVE",
        },
      },

      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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

    const result = await database.$transaction(async (transaction) => {
      await transaction.agentAlias.upsert({
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

      const linkedOrders = await transaction.ditoOrder.updateMany({
        where: {
          organizationId: membership.organization.id,
          agentNameNormalized: normalizedAlias,
          agentUserId: null,
        },

        data: {
          agentUserId: targetMembership.user.id,
        },
      });

      return {
        linkedOrders: linkedOrders.count,
      };
    });

    revalidatePath("/admin/users");
    revalidatePath("/orders");

    return {
      type: "success",
      linkedOrders: result.linkedOrders,
      message: `Alias ${normalizedAlias} asignado a ${targetMembership.user.name}. Órdenes históricas vinculadas: ${result.linkedOrders}.`,
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
