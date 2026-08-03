import { Injectable } from '@nestjs/common';

import type { GhlWebhookEnvelopeV1 } from '@repo/contracts';

import type { Prisma } from '@repo/database';

import { DatabaseService } from '../database/database.service';

export interface ActiveGhlIntegration {
  id: string;
  organizationId: string;
  locationId: string;
  webhookSecretHash: string | null;
}

export interface WebhookEventIdentity {
  organizationId: string;
  source: 'GHL_N8N';
  locationId: string;
  externalEventId: string;
}

export type PersistedWebhookEventStatus =
  'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED_DUPLICATE';

export interface PersistedWebhookEvent {
  id: string;

  status: PersistedWebhookEventStatus;
}

export interface CreateWebhookEventInput extends WebhookEventIdentity {
  ghlIntegrationId: string;

  envelope: GhlWebhookEnvelopeV1;
}

@Injectable()
export class WebhookEventsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findActiveIntegrationsByLocationId(
    locationId: string,
  ): Promise<ActiveGhlIntegration[]> {
    const database = this.databaseService.getClient();

    return database.ghlIntegration.findMany({
      where: {
        locationId,

        status: 'ACTIVE',
      },

      select: {
        id: true,

        organizationId: true,

        locationId: true,

        webhookSecretHash: true,
      },

      take: 2,
    });
  }

  async create(input: CreateWebhookEventInput): Promise<PersistedWebhookEvent> {
    const database = this.databaseService.getClient();

    const snapshotType =
      'snapshot_type' in input.envelope.snapshot
        ? input.envelope.snapshot.snapshot_type
        : null;

    return database.webhookEvent.create({
      data: {
        organizationId: input.organizationId,

        ghlIntegrationId: input.ghlIntegrationId,

        source: input.source,

        locationId: input.locationId,

        externalEventId: input.externalEventId,

        eventType: input.envelope.event_type,

        envelopeVersion: input.envelope.envelope_version,

        snapshotType,

        occurredAt: new Date(input.envelope.occurred_at),

        payload: input.envelope as unknown as Prisma.InputJsonValue,
      },

      select: {
        id: true,
        status: true,
      },
    });
  }

  async findExisting(
    identity: WebhookEventIdentity,
  ): Promise<PersistedWebhookEvent | null> {
    const database = this.databaseService.getClient();

    return database.webhookEvent.findUnique({
      where: {
        organizationId_source_locationId_externalEventId: {
          organizationId: identity.organizationId,

          source: identity.source,

          locationId: identity.locationId,

          externalEventId: identity.externalEventId,
        },
      },

      select: {
        id: true,
        status: true,
      },
    });
  }

  /**
   * Reclama atomicamente un evento.
   *
   * Solamente RECEIVED y FAILED
   * pueden comenzar o reintentar
   * su proyeccion.
   */
  async claimForProcessing(webhookEventId: string): Promise<boolean> {
    const database = this.databaseService.getClient();

    const result = await database.webhookEvent.updateMany({
      where: {
        id: webhookEventId,

        status: {
          in: ['RECEIVED', 'FAILED'],
        },
      },

      data: {
        status: 'PROCESSING',

        processingAttempts: {
          increment: 1,
        },
      },
    });

    return result.count === 1;
  }

  async markProcessed(webhookEventId: string): Promise<void> {
    const database = this.databaseService.getClient();

    await database.webhookEvent.update({
      where: {
        id: webhookEventId,
      },

      data: {
        status: 'PROCESSED',
      },
    });
  }

  async markFailed(webhookEventId: string): Promise<void> {
    const database = this.databaseService.getClient();

    await database.webhookEvent.update({
      where: {
        id: webhookEventId,
      },

      data: {
        status: 'FAILED',
      },
    });
  }
}
