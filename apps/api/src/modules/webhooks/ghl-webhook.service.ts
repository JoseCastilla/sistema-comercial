import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  GhlWebhookEnvelopeV1,
  WebhookIngestionResponse,
} from '@repo/contracts';

import { createHash, timingSafeEqual } from 'node:crypto';

import { WebhookEventsRepository } from './webhook-events.repository';

import { WebhookValidationService } from './webhook-validation.service';

@Injectable()
export class GhlWebhookService {
  constructor(
    private readonly validationService: WebhookValidationService,

    private readonly repository: WebhookEventsRepository,
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
        'Existe más de una integración activa para location_id',
      );
    }

    const integration = integrations[0];

    if (
      !integration ||
      !this.isSecretValid(webhookSecret, integration.webhookSecretHash)
    ) {
      throw new UnauthorizedException('Webhook no autorizado');
    }

    const identity = {
      organizationId: integration.organizationId,

      source: 'GHL_N8N' as const,

      locationId: integration.locationId,

      externalEventId: envelope.event_id,
    };

    try {
      const event = await this.repository.create({
        ...identity,

        ghlIntegrationId: integration.id,

        envelope,
      });

      return {
        accepted: true,
        duplicate: false,
        event_id: envelope.event_id,
        webhook_event_id: event.id,
        status: 'RECEIVED',
      };
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      return this.resolveDuplicate(envelope, identity);
    }
  }

  private async resolveDuplicate(
    envelope: GhlWebhookEnvelopeV1,
    identity: {
      organizationId: string;
      source: 'GHL_N8N';
      locationId: string;
      externalEventId: string;
    },
  ): Promise<WebhookIngestionResponse> {
    const existing = await this.repository.findExisting(identity);

    if (!existing) {
      throw new InternalServerErrorException(
        'No fue posible recuperar el evento duplicado',
      );
    }

    return {
      accepted: true,
      duplicate: true,
      event_id: envelope.event_id,
      webhook_event_id: existing.id,
      status: 'IGNORED_DUPLICATE',
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
