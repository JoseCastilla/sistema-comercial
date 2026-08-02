import { DatabaseService } from './database.service';
import type { DatabaseClientPort } from './database.types';

describe('DatabaseService', () => {
  const disconnect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

  const queryRaw = jest.fn<
    Promise<unknown>,
    [TemplateStringsArray, ...unknown[]]
  >();

  const client = {
    $connect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),

    $disconnect: disconnect,
    $queryRaw: queryRaw,
  } as unknown as DatabaseClientPort;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should expose the database client', () => {
    const service = new DatabaseService(client);

    expect(service.getClient()).toBe(client);
  });

  it('should execute a database ping', async () => {
    queryRaw.mockResolvedValue([
      {
        connection_ok: 1,
      },
    ]);

    const service = new DatabaseService(client);

    const latency = await service.ping();

    expect(queryRaw).toHaveBeenCalledTimes(1);

    const firstCall = queryRaw.mock.calls[0];

    expect(firstCall?.[0].join(' ')).toContain(
      'SELECT 1::integer AS connection_ok',
    );

    expect(latency).toBeGreaterThanOrEqual(0);
  });

  it('should disconnect on shutdown', async () => {
    const service = new DatabaseService(client);

    await service.onApplicationShutdown();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
