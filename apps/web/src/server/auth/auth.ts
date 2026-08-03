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

export const auth = betterAuth({
  appName: "Sistema Comercial",

  baseURL: betterAuthUrl,

  basePath: "/api/auth",

  secret: requiredEnvironmentVariable("BETTER_AUTH_SECRET"),

  trustedOrigins: [betterAuthUrl],

  database: prismaAdapter(database, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,

    /*
     * Sistema privado:
     * los usuarios no pueden
     * registrarse libremente.
     */
    disableSignUp: true,

    minPasswordLength: 12,
    maxPasswordLength: 128,

    revokeSessionsOnPasswordReset: true,
  },

  session: {
    /*
     * Sesión máxima:
     * 12 horas.
     */
    expiresIn: 60 * 60 * 12,

    /*
     * Renovación como máximo
     * una vez por hora.
     */
    updateAge: 60 * 60,
  },

  advanced: {
    database: {
      /*
       * User, Session, Account
       * y Verification usan UUID.
       */
      generateId: "uuid",
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
