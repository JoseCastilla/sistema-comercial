import "server-only";

import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";

import type { OrganizationRole } from "@/generated/prisma/enums";

import { audit } from "../audit";
import { database } from "../database";

/**
 * Instancia interna de Better Auth con registro habilitado. No expone ruta:
 * solo la usan /setup y la creación de cuentas por el dueño. La instancia
 * pública (`auth.ts`) mantiene el registro apagado.
 */
const bootstrapAuth = betterAuth({
  appName: "CRM bootstrap",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(database, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: false, autoSignIn: false, minPasswordLength: 12, maxPasswordLength: 128 },
  advanced: { database: { generateId: "uuid" } },
});

export async function createUserWithMembership(input: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role: OrganizationRole;
  actorUserId?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres");
  if (!input.name.trim()) throw new Error("El nombre es obligatorio");
  const existing = await database.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new Error("Ya existe una cuenta con ese correo");

  const created = await bootstrapAuth.api.signUpEmail({ body: { name: input.name.trim(), email, password: input.password } });
  const userId = created.user.id;
  await database.organizationMember.create({ data: { organizationId: input.organizationId, userId, role: input.role } });
  await audit({ organizationId: input.organizationId, actorUserId: input.actorUserId, action: "user.created", targetKind: "user", targetId: userId, detail: { role: input.role } });
  return userId;
}
