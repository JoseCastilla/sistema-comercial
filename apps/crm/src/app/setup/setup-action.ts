"use server";

import { redirect } from "next/navigation";

import { database } from "@/server/database";
import { createUserWithMembership } from "@/server/users/create-user";

export interface SetupState {
  error: string | null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "empresa";
}

export async function runSetup(_previous: SetupState, formData: FormData): Promise<SetupState> {
  if ((await database.organization.count()) > 0) {
    return { error: "La empresa ya fue creada. Ingresa con tu cuenta." };
  }
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!organizationName || !name || !email || password.length < 12) {
    return { error: "Completa todos los campos; la contraseña necesita 12 caracteres o más." };
  }
  const organization = await database.organization.create({ data: { name: organizationName, slug: slugify(organizationName) } });
  try {
    await createUserWithMembership({ organizationId: organization.id, name, email, password, role: "OWNER" });
  } catch (error) {
    // Sin dueño no hay empresa: se deshace para que /setup siga disponible.
    await database.organization.delete({ where: { id: organization.id } });
    return { error: error instanceof Error ? error.message : "No se pudo crear la empresa." };
  }
  redirect("/login");
}
