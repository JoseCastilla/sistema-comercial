import { Test, TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return the API health status', () => {
    const response = controller.getHealth();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('sistema-comercial-api');
    expect(response.version).toBe('0.1.0');
    expect(response.businessTimezone).toBe('America/Lima');

    expect(typeof response.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);

    expect(typeof response.uptimeSeconds).toBe('number');
    expect(response.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
