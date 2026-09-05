"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/server/auth/access";
import { database } from "@/server/database";

import { provisionUser } from "./provision-user";

import type { CreateUserActionState } from "./user-action.types";

const allowedRoles = ["ADMIN", "SUPERVISOR", "BACKOFFICE", "AGENT"] as const;

type AllowedRole = (typeof allowedRoles)[number];

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedRole(value: string): value is AllowedRole {
  return allowedRoles.some((role) => {
    return role === value;
  });
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function createUserAction(
  previousState: CreateUserActionState,
  formData: FormData,
): Promise<CreateUserActionState> {
  void previousState;

  const { membership } = await requireAdminAccess();

  const name = readText(formData.get("name"));
  const email = readText(formData.get("email")).toLowerCase();
  const roleValue = readText(formData.get("role"));
  const password = readText(formData.get("password"));

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

  if (!isAllowedRole(roleValue)) {
    fieldErrors.role = "Selecciona un rol válido";
  }

  if (password.length < 12) {
    fieldErrors.password = "La contraseña debe tener al menos 12 caracteres";
  } else if (password.length > 128) {
    fieldErrors.password = "La contraseña no puede superar 128 caracteres";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      type: "error",
      message: "Revisa los datos del usuario.",
      fieldErrors,
    };
  }

  /*
   * El type guard anterior garantiza
   * que roleValue pertenece al catálogo.
   */
  const role = roleValue as AllowedRole;

  const existingUser = await database.user.findUnique({
    where: {
      email,
    },

    select: {
      id: true,
    },
  });

  if (existingUser) {
    return {
      type: "error",
      message: "Ya existe una cuenta registrada con ese correo.",
      fieldErrors: {
        email: "El correo ya está registrado",
      },
    };
  }

  try {
    // SPEC-001 BR-013: cuenta y membresía nacen juntas o no nace ninguna.
    await provisionUser({
      organizationId: membership.organization.id,
      name,
      email,
      password,
      role,
    });
  } catch (error) {
    console.error("No se pudo crear el usuario", {
      error,
      email,
      organizationId: membership.organization.id,
    });

    return {
      type: "error",
      message:
        "No se pudo crear el usuario. Verifica los datos e inténtalo nuevamente.",
    };
  }

  revalidatePath("/admin/users");

  return {
    type: "success",
    message: `Usuario ${email} creado correctamente.`,
  };
}
