import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';

import type { GhlWebhookEnvelopeV1 } from '@repo/contracts';

import { webhookEnvelopeFixture } from '../../../test/fixtures/ghl-webhook.fixture';

import type {
  GhlProjectionContext,
  GhlProjectionResult,
} from '../commercial-projection/ghl-commercial-projection.service';

import { GhlCommercialProjectionService } from '../commercial-projection/ghl-commercial-projection.service';

import { GhlWebhookService } from './ghl-webhook.service';

import type {
  ActiveGhlIntegration,
  CreateWebhookEventInput,
  PersistedWebhookEvent,
  WebhookEventIdentity,
} from './webhook-events.repository';

import { WebhookEventsRepository } from './webhook-events.repository';

import { WebhookValidationService } from './webhook-validation.service';

describe('GhlWebhookService', () => {
  const webhookSecret = 'test-webhook-secret';

  const webhookSecretHash = [
    'sha256',

    createHash('sha256').update(webhookSecret, 'utf8').digest('hex'),
  ].join(':');

  const integration: ActiveGhlIntegration = {
    id: 'integration-001',

    organizationId: 'organization-001',

    locationId: 'co3lqbHo94L7ZEYwP1u9',

    webhookSecretHash,
  };

  const parse = jest.fn<Promise<typeof webhookEnvelopeFixture>, [unknown]>();

  const findActiveIntegrationsByLocationId = jest.fn<
    Promise<ActiveGhlIntegration[]>,
    [string]
  >();

  const create = jest.fn<
    Promise<PersistedWebhookEvent>,
    [CreateWebhookEventInput]
  >();

  const findExisting = jest.fn<
    Promise<PersistedWebhookEvent | null>,
    [WebhookEventIdentity]
  >();

  const claimForProcessing = jest.fn<Promise<boolean>, [string]>();

  const markProcessed = jest.fn<Promise<void>, [string]>();

  const markFailed = jest.fn<Promise<void>, [string]>();

  const project = jest.fn<
    Promise<GhlProjectionResult>,
    [GhlWebhookEnvelopeV1, GhlProjectionContext]
  >();

  const validationService = {
    parse,
  } as unknown as WebhookValidationService;

  const repository = {
    findActiveIntegrationsByLocationId,
    create,
    findExisting,
    claimForProcessing,
    markProcessed,
    markFailed,
  } as unknown as WebhookEventsRepository;

  const projectionService = {
    project,
  } as unknown as GhlCommercialProjectionService;

  let service: GhlWebhookService;

  beforeEach(() => {
    parse.mockReset();

    findActiveIntegrationsByLocationId.mockReset();

    create.mockReset();
    findExisting.mockReset();

    claimForProcessing.mockReset();

    markProcessed.mockReset();
    markFailed.mockReset();

    project.mockReset();

    parse.mockResolvedValue(webhookEnvelopeFixture);

    findActiveIntegrationsByLocationId.mockResolvedValue([integration]);

    create.mockResolvedValue({
      id: 'webhook-event-001',

      status: 'RECEIVED',
    });

    findExisting.mockResolvedValue(null);

    claimForProcessing.mockResolvedValue(true);

    markProcessed.mockResolvedValue(undefined);

    markFailed.mockResolvedValue(undefined);

    project.mockResolvedValue({
      projectionType: 'CONTACT',

      contactId: 'contact-001',

      commercialRequestId: null,

      commercialServiceId: null,
    });

    service = new GhlWebhookService(
      validationService,
      repository,
      projectionService,
    );
  });

  it('should persist and project an authorized webhook', async () => {
    const response = await service.ingest(
      webhookEnvelopeFixture,
      webhookSecret,
    );

    expect(response).toEqual({
      accepted: true,

      duplicate: false,

      event_id: 'test-event-001',

      webhook_event_id: 'webhook-event-001',

      status: 'RECEIVED',
    });

    expect(claimForProcessing).toHaveBeenCalledWith('webhook-event-001');

    expect(project).toHaveBeenCalledWith(webhookEnvelopeFixture, {
      organizationId: 'organization-001',

      ghlIntegrationId: 'integration-001',

      locationId: 'co3lqbHo94L7ZEYwP1u9',
    });

    expect(markProcessed).toHaveBeenCalledWith('webhook-event-001');

    expect(markFailed).not.toHaveBeenCalled();
  });

  it('should reject an invalid secret', async () => {
    await expect(
      service.ingest(webhookEnvelopeFixture, 'incorrect-secret'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(create).not.toHaveBeenCalled();

    expect(project).not.toHaveBeenCalled();
  });

  it('should reject an unknown location', async () => {
    findActiveIntegrationsByLocationId.mockResolvedValue([]);

    await expect(
      service.ingest(webhookEnvelopeFixture, webhookSecret),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(create).not.toHaveBeenCalled();
  });

  it('should reject ambiguous active integrations', async () => {
    findActiveIntegrationsByLocationId.mockResolvedValue([
      integration,

      {
        ...integration,

        id: 'integration-002',
      },
    ]);

    await expect(
      service.ingest(webhookEnvelopeFixture, webhookSecret),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should ignore an already processed duplicate', async () => {
    create.mockRejectedValue({
      code: 'P2002',
    });

    findExisting.mockResolvedValue({
      id: 'webhook-event-existing',

      status: 'PROCESSED',
    });

    claimForProcessing.mockResolvedValue(false);

    const response = await service.ingest(
      webhookEnvelopeFixture,
      webhookSecret,
    );

    expect(response).toEqual({
      accepted: true,

      duplicate: true,

      event_id: 'test-event-001',

      webhook_event_id: 'webhook-event-existing',

      status: 'IGNORED_DUPLICATE',
    });

    expect(project).not.toHaveBeenCalled();
  });

  it('should retry a failed duplicate', async () => {
    create.mockRejectedValue({
      code: 'P2002',
    });

    findExisting.mockResolvedValue({
      id: 'webhook-event-failed',

      status: 'FAILED',
    });

    claimForProcessing.mockResolvedValue(true);

    const response = await service.ingest(
      webhookEnvelopeFixture,
      webhookSecret,
    );

    expect(response).toEqual({
      accepted: true,

      duplicate: true,

      event_id: 'test-event-001',

      webhook_event_id: 'webhook-event-failed',

      status: 'RECEIVED',
    });

    expect(project).toHaveBeenCalledTimes(1);

    expect(markProcessed).toHaveBeenCalledWith('webhook-event-failed');
  });

  it('should mark the event as failed when projection fails', async () => {
    const projectionError = new Error('Projection failed');

    project.mockRejectedValue(projectionError);

    await expect(
      service.ingest(webhookEnvelopeFixture, webhookSecret),
    ).rejects.toBe(projectionError);

    expect(markFailed).toHaveBeenCalledWith('webhook-event-001');

    expect(markProcessed).not.toHaveBeenCalled();
  });

  it('should rethrow errors unrelated to idempotency', async () => {
    const databaseError = new Error('Database unavailable');

    create.mockRejectedValue(databaseError);

    await expect(
      service.ingest(webhookEnvelopeFixture, webhookSecret),
    ).rejects.toBe(databaseError);

    expect(claimForProcessing).not.toHaveBeenCalled();

    expect(project).not.toHaveBeenCalled();
  });
});
