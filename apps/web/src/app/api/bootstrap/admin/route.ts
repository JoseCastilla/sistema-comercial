import { timingSafeEqual } from "node:crypto";

import { provisioningAuth } from "@/server/auth/provisioning";

import { database } from "@/server/database";

export const dynamic = "force-dynamic";

interface BootstrapAdminBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  organizationSlug?: unknown;
}

function safeTokenEquals(supplied: string | null, expected: string): boolean {
  if (!supplied) {
    return false;
  }

  const suppliedBuffer = Buffer.from(supplied, "utf8");

  const expectedBuffer = Buffer.from(expected, "utf8");

  if (suppliedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function readRequiredText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} es obligatorio`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} es obligatorio`);
  }

  return normalized;
}

export async function POST(request: Request) {
  const expectedToken = process.env.AUTH_BOOTSTRAP_TOKEN?.trim();

  if (!expectedToken) {
    return Response.json(
      {
        message: "El arranque administrativo está deshabilitado",
      },
      {
        status: 404,
      },
    );
  }

  const suppliedToken = request.headers.get("x-bootstrap-token");

  if (!safeTokenEquals(suppliedToken, expectedToken)) {
    return Response.json(
      {
        message: "Token de arranque inválido",
      },
      {
        status: 401,
      },
    );
  }

  let body: BootstrapAdminBody;

  try {
    body = (await request.json()) as BootstrapAdminBody;
  } catch {
    return Response.json(
      {
        message: "El cuerpo JSON no es válido",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const name = readRequiredText(body.name, "El nombre");

    const email = readRequiredText(body.email, "El correo").toLowerCase();

    const password = readRequiredText(body.password, "La contraseña");

    const organizationSlug = readRequiredText(
      body.organizationSlug,
      "La organización",
    );

    if (password.length < 12) {
      return Response.json(
        {
          message: "La contraseña debe tener al menos 12 caracteres",
        },
        {
          status: 400,
        },
      );
    }

    const organization = await database.organization.findUnique({
      where: {
        slug: organizationSlug,
      },

      select: {
        id: true,

        status: true,
      },
    });

    if (!organization || organization.status !== "ACTIVE") {
      return Response.json(
        {
          message: "La organización no existe o no está activa",
        },
        {
          status: 404,
        },
      );
    }

    const existingAdmin = await database.organizationMember.findFirst({
      where: {
        organizationId: organization.id,

        role: "ADMIN",

        user: {
          status: "ACTIVE",
        },
      },

      select: {
        userId: true,
      },
    });

    /*
     * El endpoint queda inutilizable cuando
     * ya existe un administrador activo.
     */
    if (existingAdmin) {
      return Response.json(
        {
          message: "La organización ya tiene un administrador activo",
        },
        {
          status: 409,
        },
      );
    }

    let user = await database.user.findUnique({
      where: {
        email,
      },

      select: {
        id: true,

        status: true,
      },
    });

    if (!user) {
      await provisioningAuth.api.signUpEmail({
        body: {
          name,
          email,
          password,
        },
      });

      user = await database.user.findUnique({
        where: {
          email,
        },

        select: {
          id: true,

          status: true,
        },
      });
    }

    if (!user) {
      throw new Error("Better Auth no creó el usuario");
    }

    await database.$transaction([
      database.user.update({
        where: {
          id: user.id,
        },

        data: {
          name,
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

    return Response.json(
      {
        created: true,

        email,

        role: "ADMIN",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("No se pudo crear el administrador inicial", error);

    return Response.json(
      {
        message: "No se pudo crear el administrador inicial",
      },
      {
        status: 500,
      },
    );
  }
}
