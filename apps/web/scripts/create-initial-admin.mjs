import process from "node:process";

import { loadEnvFile } from "node:process";

import { fileURLToPath } from "node:url";

import { betterAuth } from "better-auth/minimal";

import { prismaAdapter } from "better-auth/adapters/prisma";

import { createPrismaClient } from "@repo/database";

const environmentPath = fileURLToPath(
  new URL("../.env.local", import.meta.url),
);

try {
  loadEnvFile(environmentPath);
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

function requiredEnvironmentVariable(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`La variable ${name} es obligatoria.`);
  }

  return value;
}

const adminName = requiredEnvironmentVariable("INITIAL_ADMIN_NAME");

const adminEmail = requiredEnvironmentVariable(
  "INITIAL_ADMIN_EMAIL",
).toLowerCase();

const adminPassword = requiredEnvironmentVariable("INITIAL_ADMIN_PASSWORD");

const organizationSlug = requiredEnvironmentVariable(
  "INITIAL_ADMIN_ORGANIZATION_SLUG",
);

if (adminPassword.length < 12) {
  throw new Error("La contraseÃ±a debe tener al menos 12 caracteres.");
}

const database = createPrismaClient();

const bootstrapAuth = betterAuth({
  appName: "Sistema Comercial Bootstrap",

  baseURL: requiredEnvironmentVariable("BETTER_AUTH_URL"),

  secret: requiredEnvironmentVariable("BETTER_AUTH_SECRET"),

  database: prismaAdapter(database, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,

    /*
     * Este auth vive solamente
     * dentro del script CLI.
     *
     * No expone una ruta pÃºblica.
     */
    disableSignUp: false,
    autoSignIn: false,

    minPasswordLength: 12,
    maxPasswordLength: 128,
  },

  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});

try {
  const organization = await database.organization.findUnique({
    where: {
      slug: organizationSlug,
    },

    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  });

  if (!organization) {
    throw new Error(`No existe la organizaciÃ³n ${organizationSlug}.`);
  }

  if (organization.status !== "ACTIVE") {
    throw new Error("La organizaciÃ³n no estÃ¡ activa.");
  }

  let user = await database.user.findUnique({
    where: {
      email: adminEmail,
    },

    select: {
      id: true,
      email: true,
      name: true,
      status: true,
    },
  });

  let userCreated = false;

  if (!user) {
    const result = await bootstrapAuth.api.signUpEmail({
      body: {
        name: adminName,

        email: adminEmail,

        password: adminPassword,
      },
    });

    user = {
      id: result.user.id,

      email: result.user.email,

      name: result.user.name,

      status: "INVITED",
    };

    userCreated = true;
  } else {
    const credentialAccount = await database.account.findFirst({
      where: {
        userId: user.id,

        providerId: "credential",
      },

      select: {
        id: true,
        password: true,
      },
    });

    if (!credentialAccount?.password) {
      throw new Error(
        [
          "El usuario ya existe,",
          "pero no tiene una cuenta",
          "credential vÃ¡lida.",
        ].join(" "),
      );
    }
  }

  await database.$transaction([
    database.user.update({
      where: {
        id: user.id,
      },

      data: {
        name: adminName,

        status: "ACTIVE",

        emailVerified: true,
      },
    }),

    database.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,

          userId: user.id,
        },
      },

      update: {
        role: "ADMIN",
      },

      create: {
        organizationId: organization.id,

        userId: user.id,

        role: "ADMIN",
      },
    }),
  ]);

  console.log(
    userCreated
      ? "Administrador creado correctamente."
      : "Administrador existente actualizado correctamente.",
  );

  console.table([
    {
      userId: user.id,

      email: adminEmail,

      name: adminName,

      status: "ACTIVE",

      organization: organization.name,

      role: "ADMIN",

      credential: "configured",
    },
  ]);
} finally {
  await database.$disconnect();
}
