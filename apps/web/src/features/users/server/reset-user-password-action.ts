"use server";

import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import type { ResetUserPasswordActionState } from "./user-action.types";

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function readPassword(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function resetUserPasswordAction(
  previousState: ResetUserPasswordActionState,
  formData: FormData,
): Promise<ResetUserPasswordActionState> {
  void previousState;

  const { session, membership } = await requireAdminAccess();

  const userId = readText(formData.get("userId"));
  const newPassword = readPassword(formData.get("newPassword"));
  const confirmPassword = readPassword(formData.get("confirmPassword"));

  const fieldErrors: NonNullable<ResetUserPasswordActionState["fieldErrors"]> =
    {};

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
      message: "Revisa la nueva contraseña.",
      fieldErrors,
    };
  }

  if (!isUuid(userId)) {
    return {
      type: "error",
      message: "El usuario seleccionado no es válido.",
    };
  }

  try {
    const targetMembership = await database.organizationMember.findFirst({
      where: {
        organizationId: membership.organization.id,
        userId,
      },

      select: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!targetMembership) {
      return {
        type: "error",
        message: "El usuario no existe o pertenece a otra organización.",
      };
    }

    const credentialAccount = await database.account.findFirst({
      where: {
        userId: targetMembership.user.id,
        providerId: "credential",
      },

      select: {
        id: true,
      },
    });

    if (!credentialAccount) {
      return {
        type: "error",
        message: "El usuario no tiene una cuenta de contraseña válida.",
      };
    }

    const passwordHash = await hashPassword(newPassword);

    const result = await database.$transaction(async (transaction) => {
      const updatedAccount = await transaction.account.updateMany({
        where: {
          id: credentialAccount.id,
          userId: targetMembership.user.id,
          providerId: "credential",
        },

        data: {
          password: passwordHash,
        },
      });

      if (updatedAccount.count !== 1) {
        throw new Error("La cuenta credential cambió durante la operación.");
      }

      const revokedSessions = await transaction.session.deleteMany({
        where: {
          userId: targetMembership.user.id,
        },
      });

      return {
        revokedSessions: revokedSessions.count,
      };
    });

    revalidatePath("/admin/users");

    const resettingOwnPassword = targetMembership.user.id === session.user.id;

    return {
      type: "success",
      message: resettingOwnPassword
        ? "Contraseña actualizada. Tu sesión fue revocada; inicia sesión nuevamente."
        : `Contraseña de ${targetMembership.user.email} actualizada. Sesiones revocadas: ${result.revokedSessions}.`,
    };
  } catch (error) {
    console.error("No se pudo restablecer la contraseña", {
      error,
      targetUserId: userId,
      organizationId: membership.organization.id,
      performedByUserId: session.user.id,
    });

    return {
      type: "error",
      message: "No se pudo restablecer la contraseña. Inténtalo nuevamente.",
    };
  }
}
