import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createHash } from 'node:crypto';

import type { Server } from 'node:http';
import request from 'supertest';

import type { WebhookIngestionResponse } from '@repo/contracts';

import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/modules/database/database.service';

import type {
  ActiveGhlIntegration,
  CreateWebhookEventInput,
  PersistedWebhookEvent,
  WebhookEventIdentity,
} from '../src/modules/webhooks/webhook-events.repository';

import { WebhookEventsRepository } from '../src/modules/webhooks/webhook-events.repository';
import { WebhookValidationService } from '../src/modules/webhooks/webhook-validation.service';

import { webhookEnvelopeFixture } from './fixtures/ghl-webhook.fixture';

describe('GHL webhook endpoint (e2e)', () => {
  let app: INestApplication | undefined;

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

  const ping = jest.fn<Promise<number>, []>().mockResolvedValue(1);

  const shutdown = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

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

  const databaseServiceMock = {
    ping,
    onApplicationShutdown: shutdown,
  } satisfies Pick<DatabaseService, 'ping' | 'onApplicationShutdown'>;

  const validationServiceMock = {
    parse,
  } satisfies Pick<WebhookValidationService, 'parse'>;

  const repositoryMock = {
    findActiveIntegrationsByLocationId,
    create,
    findExisting,
  } satisfies Pick<
    WebhookEventsRepository,
    'findActiveIntegrationsByLocationId' | 'create' | 'findExisting'
  >;

  beforeEach(async () => {
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(databaseServiceMock)
      .overrideProvider(WebhookValidationService)
      .useValue(validationServiceMock)
      .overrideProvider(WebhookEventsRepository)
      .useValue(repositoryMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  function getServer(): Server {
    if (!app) {
      throw new Error('La aplicación no fue inicializada');
    }

    return app.getHttpServer() as Server;
  }

  it('accepts and persists a valid webhook', async () => {
    const response = await request(getServer())
      .post('/api/v1/webhooks/ghl')
      .set('x-webhook-secret', webhookSecret)
      .send(webhookEnvelopeFixture)
      .expect(202);

    const body = response.body as unknown as WebhookIngestionResponse;

    expect(body).toEqual({
      accepted: true,
      duplicate: false,
      event_id: 'test-event-001',
      webhook_event_id: 'webhook-event-001',
      status: 'RECEIVED',
    });
  });

  it('rejects an invalid secret', async () => {
    await request(getServer())
      .post('/api/v1/webhooks/ghl')
      .set('x-webhook-secret', 'incorrect-secret')
      .send(webhookEnvelopeFixture)
      .expect(401);

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an unknown location', async () => {
    findActiveIntegrationsByLocationId.mockResolvedValueOnce([]);

    await request(getServer())
      .post('/api/v1/webhooks/ghl')
      .set('x-webhook-secret', webhookSecret)
      .send(webhookEnvelopeFixture)
      .expect(401);

    expect(create).not.toHaveBeenCalled();
  });

  it('returns the previous event when duplicated', async () => {
    create.mockRejectedValueOnce({
      code: 'P2002',
    });

    findExisting.mockResolvedValueOnce({
      id: 'webhook-event-existing',
    });

    const response = await request(getServer())
      .post('/api/v1/webhooks/ghl')
      .set('x-webhook-secret', webhookSecret)
      .send(webhookEnvelopeFixture)
      .expect(202);

    const body = response.body as unknown as WebhookIngestionResponse;

    expect(body.duplicate).toBe(true);
    expect(body.status).toBe('IGNORED_DUPLICATE');
    expect(body.webhook_event_id).toBe('webhook-event-existing');
  });
});
