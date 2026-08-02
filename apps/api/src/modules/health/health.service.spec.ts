import { DatabaseService } from '../database/database.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const ping = jest.fn<Promise<number>, []>();

  const databaseService = {
    ping,
  } as unknown as DatabaseService;

  let service: HealthService;

  beforeEach(() => {
    ping.mockReset();

    service = new HealthService(databaseService);
  });

  it('should return liveness status', () => {
    const response = service.getLiveness();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('sistema-comercial-api');
    expect(response.businessTimezone).toBe('America/Lima');
    expect(ping).not.toHaveBeenCalled();
  });

  it('should report database as ready', async () => {
    ping.mockResolvedValue(7);

    const response = await service.getReadiness();

    expect(response.status).toBe('ok');
    expect(response.checks.database).toEqual({
      status: 'up',
      latencyMs: 7,
    });
  });

  it('should report database as unavailable', async () => {
    ping.mockRejectedValue(new Error('Database unavailable'));

    const response = await service.getReadiness();

    expect(response.status).toBe('error');
    expect(response.checks.database).toEqual({
      status: 'down',
      latencyMs: null,
    });
  });
});
