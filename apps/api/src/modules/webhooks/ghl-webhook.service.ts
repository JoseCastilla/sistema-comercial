import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import type { WebhookIngestionResponse } from '@repo/contracts';

import { createHash, timingSafeEqual } from 'node:crypto';

import { GhlCommercialProjectionService } from '../commercial-projection/ghl-commercial-projection.service';

import type {
  PersistedWebhookEvent,
  WebhookEventIdentity,
} from './webhook-events.repository';

import { WebhookEventsRepository } from './webhook-events.repository';

import { WebhookValidationService } from './webhook-validation.service';

@Injectable()
export class GhlWebhookService {
  constructor(
    private readonly validationService: WebhookValidationService,

    private readonly repository: WebhookEventsRepository,

    private readonly projectionService: GhlCommercialProjectionService,
  ) {}

  async ingest(
    rawPayload: unknown,
    webhookSecret: string | undefined,
  ): Promise<WebhookIngestionResponse> {
    const envelope = await this.validationService.parse(rawPayload);

    const locationId = envelope.snapshot.external.location_id;

    const integrations =
      await this.repository.findActiveIntegrationsByLocationId(locationId);

    if (integrations.length === 0) {
      throw new UnauthorizedException('Webhook no autorizado');
    }

    if (integrations.length > 1) {
      throw new InternalServerErrorException(
        'Existe mas de una integracion activa para location_id',
      );
    }

    const integration = integrations[0];

    if (
      !integration ||
      !this.isSecretValid(webhookSecret, integration.webhookSecretHash)
    ) {
      throw new UnauthorizedException('Webhook no autorizado');
    }

    const identity: WebhookEventIdentity = {
      organizationId: integration.organizationId,

      source: 'GHL_N8N',

      locationId: integration.locationId,

      externalEventId: envelope.event_id,
    };

    let event: PersistedWebhookEvent;

    let duplicate = false;

    try {
      event = await this.repository.create({
        ...identity,

        ghlIntegrationId: integration.id,

        envelope,
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      duplicate = true;

      const existing = await this.repository.findExisting(identity);

      if (!existing) {
        throw new InternalServerErrorException(
          'No fue posible recuperar el evento duplicado',
        );
      }

      event = existing;
    }

    const claimed = await this.repository.claimForProcessing(event.id);

    /*
     * PROCESSING, PROCESSED o cualquier
     * otro estado no reclamable indica que
     * el evento ya fue atendido por otra
     * ejecucion o se encuentra en curso.
     */
    if (!claimed) {
      return {
        accepted: true,

        duplicate: true,

        event_id: envelope.event_id,

        webhook_event_id: event.id,

        status: 'IGNORED_DUPLICATE',
      };
    }

    try {
      await this.projectionService.project(envelope, {
        organizationId: integration.organizationId,

        ghlIntegrationId: integration.id,

        locationId: integration.locationId,
      });

      await this.repository.markProcessed(event.id);
    } catch (error) {
      /*
       * No ocultamos el error original
       * si el cambio de estado tambien
       * llegara a fallar.
       */
      await this.repository.markFailed(event.id).catch(() => undefined);

      throw error;
    }

    return {
      accepted: true,

      duplicate,

      event_id: envelope.event_id,

      webhook_event_id: event.id,

      /*
       * Se conserva el contrato HTTP
       * vigente para n8n.
       *
       * El estado persistido en PostgreSQL
       * ya sera PROCESSED.
       */
      status: 'RECEIVED',
    };
  }

  private isSecretValid(
    providedSecret: string | undefined,

    storedHash: string | null,
  ): boolean {
    if (!providedSecret || !storedHash) {
      return false;
    }

    const providedHash = [
      'sha256',

      createHash('sha256').update(providedSecret, 'utf8').digest('hex'),
    ].join(':');

    const providedBuffer = Buffer.from(providedHash, 'utf8');

    const storedBuffer = Buffer.from(storedHash, 'utf8');

    return (
      providedBuffer.length === storedBuffer.length &&
      timingSafeEqual(providedBuffer, storedBuffer)
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
