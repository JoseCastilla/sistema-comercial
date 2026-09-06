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

export interface WebhookRetrySummary {
  candidates: number;
  processed: number;
  failed: number;
}

/** Tope de intentos por evento (SPEC-046 BR-003). */
const maxProcessingAttempts = 5;

/** Cuántos eventos se reintentan por pasada del worker. */
const retryBatchSize = 50;

function describeError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

@Injectable()
export class GhlWebhookService {
  constructor(
    private readonly validationService: WebhookValidationService,

    private readonly repository: WebhookEventsRepository,

    private readonly projectionService: GhlCommercialProjectionService,
  ) {}

  /**
   * SPEC-046 BR-003: vuelve a proyectar los eventos que quedaron en FAILED
   * con menos de cinco intentos. Cada evento se reclama de forma atómica,
   * así dos pasadas concurrentes no lo procesan dos veces. El resumen dice
   * cuántos se recuperaron y cuántos siguen fallando.
   */
  async retryFailed(): Promise<WebhookRetrySummary> {
    const events = await this.repository.findRetryable(
      maxProcessingAttempts,
      retryBatchSize,
    );

    let processed = 0;

    let failed = 0;

    for (const event of events) {
      const claimed = await this.repository.claimForProcessing(event.id);

      if (!claimed) continue;

      try {
        const envelope = await this.validationService.parse(event.payload);

        await this.projectionService.project(envelope, {
          organizationId: event.ghlIntegration.organizationId,

          ghlIntegrationId: event.ghlIntegration.id,

          locationId: event.ghlIntegration.locationId,
        });

        await this.repository.markProcessed(event.id);

        processed += 1;
      } catch (error) {
        await this.repository
          .markFailed(event.id, describeError(error))
          .catch(() => undefined);

        failed += 1;
      }
    }

    return { candidates: events.length, processed, failed };
  }

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
      await this.repository
        .markFailed(event.id, describeError(error))
        .catch(() => undefined);

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
