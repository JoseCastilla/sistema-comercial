import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';

import { webhookEnvelopeFixture } from '../../../test/fixtures/ghl-webhook.fixture';

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

  const validationService = {
    parse,
  } as unknown as WebhookValidationService;

  const repository = {
    findActiveIntegrationsByLocationId,
    create,
    findExisting,
  } as unknown as WebhookEventsRepository;

  let service: GhlWebhookService;

  beforeEach(() => {
    parse.mockReset();
    findActiveIntegrationsByLocationId.mockReset();
    create.mockReset();
    findExisting.mockReset();

    parse.mockResolvedValue(webhookEnvelopeFixture);

    findActiveIntegrationsByLocationId.mockResolvedValue([integration]);

    create.mockResolvedValue({
      id: 'webhook-event-001',
    });

    findExisting.mockResolvedValue(null);

    service = new GhlWebhookService(validationService, repository);
  });

  it('should persist an authorized webhook', async () => {
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

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('should reject an invalid secret', async () => {
    await expect(
      service.ingest(webhookEnvelopeFixture, 'incorrect-secret'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(create).not.toHaveBeenCalled();
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

  it('should return the existing event for a duplicate', async () => {
    create.mockRejectedValue({
      code: 'P2002',
    });

    findExisting.mockResolvedValue({
      id: 'webhook-event-existing',
    });

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

    expect(findExisting).toHaveBeenCalledTimes(1);
  });

  it('should rethrow errors unrelated to idempotency', async () => {
    const databaseError = new Error('Database unavailable');

    create.mockRejectedValue(databaseError);

    await expect(
      service.ingest(webhookEnvelopeFixture, webhookSecret),
    ).rejects.toBe(databaseError);
  });
});
