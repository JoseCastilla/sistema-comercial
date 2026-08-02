import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/modules/database/database.service';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication | undefined;

  const databaseServiceMock = {
    ping: jest.fn<Promise<number>, []>().mockResolvedValue(0),

    onApplicationShutdown: jest
      .fn<Promise<void>, []>()
      .mockResolvedValue(undefined),
  } satisfies Pick<DatabaseService, 'ping' | 'onApplicationShutdown'>;

  beforeEach(async () => {
    jest.clearAllMocks();

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

  it('GET /api/v1/health', async () => {
    if (!app) {
      throw new Error('La aplicación de prueba no fue inicializada');
    }

    const server = app.getHttpServer() as Server;

    const response = await request(server).get('/api/v1/health').expect(200);

    const body = response.body as {
      status: unknown;
      service: unknown;
      businessTimezone: unknown;
    };

    expect(body.status).toBe('ok');
    expect(body.service).toBe('sistema-comercial-api');
    expect(body.businessTimezone).toBe('America/Lima');
  });
});
