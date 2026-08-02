import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health', async () => {
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
