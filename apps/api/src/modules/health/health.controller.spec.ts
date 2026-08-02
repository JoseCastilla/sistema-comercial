import { ServiceUnavailableException } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import type {
  LivenessHealthResponse,
  ReadinessHealthResponse,
} from './health.types';

describe('HealthController', () => {
  const getLiveness = jest.fn<LivenessHealthResponse, []>();

  const getReadiness = jest.fn<Promise<ReadinessHealthResponse>, []>();

  const healthService = {
    getLiveness,
    getReadiness,
  } as unknown as HealthService;

  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new HealthController(healthService);
  });

  it('should return liveness status', () => {
    getLiveness.mockReturnValue({
      status: 'ok',
      service: 'sistema-comercial-api',
      version: '0.1.0',
      businessTimezone: 'America/Lima',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 1,
    });

    const response = controller.getLiveness();

    expect(response.status).toBe('ok');
  });

  it('should return readiness status', async () => {
    getReadiness.mockResolvedValue({
      status: 'ok',
      service: 'sistema-comercial-api',
      version: '0.1.0',
      businessTimezone: 'America/Lima',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 1,

      checks: {
        database: {
          status: 'up',
          latencyMs: 3,
        },
      },
    });

    const response = await controller.getReadiness();

    expect(response.status).toBe('ok');
    expect(response.checks.database.status).toBe('up');
  });

  it('should throw 503 when database is down', async () => {
    getReadiness.mockResolvedValue({
      status: 'error',
      service: 'sistema-comercial-api',
      version: '0.1.0',
      businessTimezone: 'America/Lima',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 1,

      checks: {
        database: {
          status: 'down',
          latencyMs: null,
        },
      },
    });

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
