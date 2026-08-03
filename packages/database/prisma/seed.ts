import "dotenv/config";

import { createHash } from "node:crypto";

import { createPrismaClient } from "../src/client.js";

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`La variable ${name} es obligatoria`);
  }

  return value;
}

function optionalEnvironmentVariable(name: string): string | null {
  const value = process.env[name]?.trim();

  return value || null;
}

const organizationName = requiredEnvironmentVariable("SEED_ORGANIZATION_NAME");

const organizationSlug = requiredEnvironmentVariable("SEED_ORGANIZATION_SLUG");

const organizationTimezone = requiredEnvironmentVariable(
  "SEED_ORGANIZATION_TIMEZONE",
);

const locationId = requiredEnvironmentVariable("SEED_GHL_LOCATION_ID");

const locationName = requiredEnvironmentVariable("SEED_GHL_LOCATION_NAME");

const companyId = optionalEnvironmentVariable("SEED_GHL_COMPANY_ID");

const webhookSecret = requiredEnvironmentVariable("SEED_GHL_WEBHOOK_SECRET");

const webhookSecretHash = [
  "sha256",

  createHash("sha256").update(webhookSecret, "utf8").digest("hex"),
].join(":");

const deliveryShifts = [
  {
    code: "MORNING",
    name: "08:00–12:00",
    startMinute: 480,
    endMinute: 720,
    displayOrder: 1,
  },

  {
    code: "MIDDAY",
    name: "12:00–15:00",
    startMinute: 720,
    endMinute: 900,
    displayOrder: 2,
  },

  {
    code: "AFTERNOON",
    name: "15:00–19:00",
    startMinute: 900,
    endMinute: 1140,
    displayOrder: 3,
  },
] as const;

const database = createPrismaClient();

try {
  const organization = await database.organization.upsert({
    where: {
      slug: organizationSlug,
    },

    update: {
      name: organizationName,
      timezone: organizationTimezone,
      status: "ACTIVE",
    },

    create: {
      name: organizationName,
      slug: organizationSlug,
      timezone: organizationTimezone,
      status: "ACTIVE",
    },
  });

  const integration = await database.ghlIntegration.upsert({
    where: {
      organizationId_locationId: {
        organizationId: organization.id,
        locationId,
      },
    },

    update: {
      companyId,
      locationName,
      status: "ACTIVE",
      webhookSecretHash,
    },

    create: {
      organizationId: organization.id,
      companyId,
      locationId,
      locationName,
      status: "ACTIVE",
      webhookSecretHash,
    },
  });

  const shifts = [];

  for (const shift of deliveryShifts) {
    const persistedShift = await database.deliveryShift.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: shift.code,
        },
      },

      update: {
        name: shift.name,
        startMinute: shift.startMinute,
        endMinute: shift.endMinute,
        displayOrder: shift.displayOrder,
        isActive: true,
      },

      create: {
        organizationId: organization.id,

        code: shift.code,
        name: shift.name,

        startMinute: shift.startMinute,

        endMinute: shift.endMinute,

        displayOrder: shift.displayOrder,

        isActive: true,
      },
    });

    shifts.push(persistedShift);
  }

  console.log("Seed local aplicado correctamente");

  console.table([
    {
      organizationId: organization.id,

      organizationSlug: organization.slug,

      integrationId: integration.id,

      locationId: integration.locationId,

      integrationStatus: integration.status,

      webhookSecret: "configured",

      deliveryShifts: shifts.length,
    },
  ]);

  console.table(
    shifts.map((shift) => ({
      code: shift.code,
      name: shift.name,
      startMinute: shift.startMinute,
      endMinute: shift.endMinute,
      isActive: shift.isActive,
    })),
  );
} finally {
  await database.$disconnect();
}
