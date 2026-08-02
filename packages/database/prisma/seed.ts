import 'dotenv/config';

import { createHash } from 'node:crypto';

import { createPrismaClient } from '../src/client.js';

function requiredEnvironmentVariable(
  name: string,
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `La variable ${name} es obligatoria`,
    );
  }

  return value;
}

function optionalEnvironmentVariable(
  name: string,
): string | null {
  const value = process.env[name]?.trim();

  return value || null;
}

const organizationName =
  requiredEnvironmentVariable(
    'SEED_ORGANIZATION_NAME',
  );

const organizationSlug =
  requiredEnvironmentVariable(
    'SEED_ORGANIZATION_SLUG',
  );

const organizationTimezone =
  requiredEnvironmentVariable(
    'SEED_ORGANIZATION_TIMEZONE',
  );

const locationId =
  requiredEnvironmentVariable(
    'SEED_GHL_LOCATION_ID',
  );

const locationName =
  requiredEnvironmentVariable(
    'SEED_GHL_LOCATION_NAME',
  );

const companyId =
  optionalEnvironmentVariable(
    'SEED_GHL_COMPANY_ID',
  );

const webhookSecret =
  requiredEnvironmentVariable(
    'SEED_GHL_WEBHOOK_SECRET',
  );

const webhookSecretHash = [
  'sha256',
  createHash('sha256')
    .update(webhookSecret, 'utf8')
    .digest('hex'),
].join(':');

const database = createPrismaClient();

try {
  const organization =
    await database.organization.upsert({
      where: {
        slug: organizationSlug,
      },

      update: {
        name: organizationName,
        timezone: organizationTimezone,
        status: 'ACTIVE',
      },

      create: {
        name: organizationName,
        slug: organizationSlug,
        timezone: organizationTimezone,
        status: 'ACTIVE',
      },
    });

  const integration =
    await database.ghlIntegration.upsert({
      where: {
        organizationId_locationId: {
          organizationId: organization.id,
          locationId,
        },
      },

      update: {
        companyId,
        locationName,
        status: 'ACTIVE',
        webhookSecretHash,
      },

      create: {
        organizationId: organization.id,
        companyId,
        locationId,
        locationName,
        status: 'ACTIVE',
        webhookSecretHash,
      },
    });

  console.log('Seed local aplicado correctamente');
  console.table([
    {
      organizationId: organization.id,
      organizationSlug: organization.slug,
      integrationId: integration.id,
      locationId: integration.locationId,
      integrationStatus: integration.status,
      webhookSecret: 'configured',
    },
  ]);
} finally {
  await database.$disconnect();
}
