import "server-only";

import { provisioningAuth } from "@/server/auth/provisioning";
import { database } from "@/server/database";

/**
 * Alta de una cuenta con su membresía de organización — SPEC-001 BR-013.
 *
 * Better Auth crea `User` y `Account` antes de que exista la membresía. Si la
 * segunda etapa falla, la cuenta recién creada se elimina: nunca queda un
 * usuario activo huérfano. Lo comparten la creación desde Personas (ADMIN,
 * cualquier rol) y el alta de asesores por supervisores (SPEC-043 PE-07).
 */
export async function provisionUser(input: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "SUPERVISOR" | "BACKOFFICE" | "AGENT";
}): Promise<{ userId: string }> {
  const signUpResult = await provisioningAuth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  const userId = signUpResult.user.id;

  try {
    await database.$transaction([
      database.user.update({
        where: { id: userId },
        data: { name: input.name, emailVerified: true, status: "ACTIVE" },
      }),
      database.organizationMember.create({
        data: {
          organizationId: input.organizationId,
          userId,
          role: input.role,
        },
      }),
    ]);
  } catch (error) {
    await database.user.deleteMany({ where: { id: userId } });
    throw error;
  }

  return { userId };
}

/** Deshace un alta cuando una etapa posterior a la membresía falla. */
export async function discardProvisionedUser(userId: string): Promise<void> {
  await database.user.deleteMany({ where: { id: userId } });
}
