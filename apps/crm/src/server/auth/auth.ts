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
  appName: "CRM",
  baseURL: betterAuthUrl,
  basePath: "/api/auth",
  secret: requiredEnvironmentVariable("BETTER_AUTH_SECRET"),
  trustedOrigins: [betterAuthUrl],
  database: prismaAdapter(database, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // Las cuentas las crea el dueño (o /setup la primera vez); no hay registro libre.
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 100,
    customRules: { "/sign-in/email": { window: 60, max: 5 } },
  },
  session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60 },
  advanced: { database: { generateId: "uuid" } },
});

export type AuthSession = typeof auth.$Infer.Session;
