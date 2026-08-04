import "server-only";

import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";

import { database } from "../database";

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`La variable ${name} es obligatoria`);
  }

  return value;
}

const betterAuthUrl = requiredEnvironmentVariable("BETTER_AUTH_URL");

/**
 * Instancia interna no expuesta mediante /api/auth.
 *
 * Permite que acciones autorizadas del servidor creen cuentas,
 * mientras el registro público continúa deshabilitado.
 */
export const provisioningAuth = betterAuth({
  appName: "Sistema Comercial",

  baseURL: betterAuthUrl,

  /*
   * Esta ruta no se monta en el handler público.
   */
  basePath: "/api/internal-auth-provisioning",

  secret: requiredEnvironmentVariable("BETTER_AUTH_SECRET"),

  trustedOrigins: [betterAuthUrl],

  database: prismaAdapter(database, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,

    disableSignUp: false,

    /*
     * Crear una cuenta no inicia una sesión
     * para quien ejecutó la acción.
     */
    autoSignIn: false,

    minPasswordLength: 12,
    maxPasswordLength: 128,

    revokeSessionsOnPasswordReset: true,
  },

  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});
