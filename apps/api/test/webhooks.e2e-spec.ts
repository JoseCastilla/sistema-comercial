import { type INestApplication } from '@nestjs/common';

import { Test, type TestingModule } from '@nestjs/testing';

import { createHash } from 'node:crypto';

import type { Server } from 'node:http';

import request from 'supertest';

import type {
  GhlWebhookEnvelopeV1,
  WebhookIngestionResponse,
} from '@repo/contracts';

import { AppModule } from '../src/app.module';

import {
  GhlCommercialProjectionService,
  type GhlProjectionContext,
  type GhlProjectionResult,
} from '../src/modules/commercial-projection/ghl-commercial-projection.service';

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

  const ping = jest.fn<Promise<number>, []>();

  const shutdown = jest.fn<Promise<void>, []>();

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
    claimForProcessing,
    markProcessed,
    markFailed,
  } satisfies Pick<
    WebhookEventsRepository,
    | 'findActiveIntegrationsByLocationId'
    | 'create'
    | 'findExisting'
    | 'claimForProcessing'
    | 'markProcessed'
    | 'markFailed'
  >;

  const projectionServiceMock = {
    project,
  } satisfies Pick<GhlCommercialProjectionService, 'project'>;

  beforeEach(async () => {
    ping.mockReset();
    shutdown.mockReset();

    parse.mockReset();

    findActiveIntegrationsByLocationId.mockReset();

    create.mockReset();
    findExisting.mockReset();

    claimForProcessing.mockReset();

    markProcessed.mockReset();
    markFailed.mockReset();

    project.mockReset();

    ping.mockResolvedValue(1);

    shutdown.mockResolvedValue(undefined);

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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(databaseServiceMock)
      .overrideProvider(WebhookValidationService)
      .useValue(validationServiceMock)
      .overrideProvider(WebhookEventsRepository)
      .useValue(repositoryMock)
      .overrideProvider(GhlCommercialProjectionService)
      .useValue(projectionServiceMock)
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
      throw new Error('La aplicacion no fue inicializada');
    }

    return app.getHttpServer() as Server;
  }

  it('accepts, persists and projects a valid webhook', async () => {
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

    expect(claimForProcessing).toHaveBeenCalledWith('webhook-event-001');

    expect(project).toHaveBeenCalledWith(webhookEnvelopeFixture, {
      organizationId: 'organization-001',

      ghlIntegrationId: 'integration-001',

      locationId: 'co3lqbHo94L7ZEYwP1u9',
    });

    expect(markProcessed).toHaveBeenCalledWith('webhook-event-001');

    expect(markFailed).not.toHaveBeenCalled();
  });

  it('rejects an invalid secret', async () => {
    await request(getServer())
      .post('/api/v1/webhooks/ghl')
      .set('x-webhook-secret', 'incorrect-secret')
      .send(webhookEnvelopeFixture)
      .expect(401);

    expect(create).not.toHaveBeenCalled();

    expect(project).not.toHaveBeenCalled();
  });

  it('rejects an unknown location', async () => {
    findActiveIntegrationsByLocationId.mockResolvedValueOnce([]);

    await request(getServer())
      .post('/api/v1/webhooks/ghl')
      .set('x-webhook-secret', webhookSecret)
      .send(webhookEnvelopeFixture)
      .expect(401);

    expect(create).not.toHaveBeenCalled();

    expect(project).not.toHaveBeenCalled();
  });

  it('returns the previous event when duplicated', async () => {
    create.mockRejectedValueOnce({
      code: 'P2002',
    });

    findExisting.mockResolvedValueOnce({
      id: 'webhook-event-existing',

      status: 'PROCESSED',
    });

    claimForProcessing.mockResolvedValueOnce(false);

    const response = await request(getServer())
      .post('/api/v1/webhooks/ghl')
      .set('x-webhook-secret', webhookSecret)
      .send(webhookEnvelopeFixture)
      .expect(202);

    const body = response.body as unknown as WebhookIngestionResponse;

    expect(body).toEqual({
      accepted: true,

      duplicate: true,

      event_id: 'test-event-001',

      webhook_event_id: 'webhook-event-existing',

      status: 'IGNORED_DUPLICATE',
    });

    expect(project).not.toHaveBeenCalled();

    expect(markProcessed).not.toHaveBeenCalled();
  });

  it('marks the event as failed when projection fails', async () => {
    const projectionError = new Error('Projection failed');

    project.mockRejectedValueOnce(projectionError);

    await request(getServer())
      .post('/api/v1/webhooks/ghl')
      .set('x-webhook-secret', webhookSecret)
      .send(webhookEnvelopeFixture)
      .expect(500);

    expect(markFailed).toHaveBeenCalledWith('webhook-event-001');

    expect(markProcessed).not.toHaveBeenCalled();
  });
});
