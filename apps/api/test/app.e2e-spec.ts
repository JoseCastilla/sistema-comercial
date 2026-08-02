import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import type {
  LivenessHealthResponse,
  ReadinessHealthResponse,
} from '../src/modules/health/health.types';

describe('Health endpoints (e2e)', () => {
  let app: INestApplication | undefined;

  const ping = jest.fn<Promise<number>, []>();

  const shutdown = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

  const databaseServiceMock = {
    ping,
    onApplicationShutdown: shutdown,
  } satisfies Pick<DatabaseService, 'ping' | 'onApplicationShutdown'>;

  beforeEach(async () => {
    ping.mockReset();
    ping.mockResolvedValue(4);

    shutdown.mockClear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(databaseServiceMock)
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

  it('GET /api/v1/health/live', async () => {
    const response = await request(getServer())
      .get('/api/v1/health/live')
      .expect(200);

    const body = response.body as unknown as LivenessHealthResponse;

    expect(body.status).toBe('ok');
    expect(body.service).toBe('sistema-comercial-api');
    expect(ping).not.toHaveBeenCalled();
  });

  it('GET /api/v1/health/ready', async () => {
    const response = await request(getServer())
      .get('/api/v1/health/ready')
      .expect(200);

    const body = response.body as unknown as ReadinessHealthResponse;

    expect(body.status).toBe('ok');
    expect(body.checks.database).toEqual({
      status: 'up',
      latencyMs: 4,
    });
  });

  it('GET /api/v1/health remains compatible', async () => {
    const response = await request(getServer())
      .get('/api/v1/health')
      .expect(200);

    const body = response.body as unknown as ReadinessHealthResponse;

    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('up');
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    ping.mockRejectedValueOnce(new Error('Database unavailable'));

    const response = await request(getServer())
      .get('/api/v1/health/ready')
      .expect(503);

    const body = response.body as unknown as ReadinessHealthResponse;

    expect(body.status).toBe('error');
    expect(body.checks.database).toEqual({
      status: 'down',
      latencyMs: null,
    });
  });
});
