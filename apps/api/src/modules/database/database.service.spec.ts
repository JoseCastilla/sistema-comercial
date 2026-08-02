import { DatabaseService } from './database.service';
import type { DatabaseClientPort } from './database.types';

describe('DatabaseService', () => {
  const connect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

  const disconnect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

  const queryRawUnsafe = jest.fn<Promise<unknown>, [string, ...unknown[]]>();

  const client: DatabaseClientPort = {
    $connect: connect,
    $disconnect: disconnect,
    $queryRawUnsafe: queryRawUnsafe,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute a database ping', async () => {
    queryRawUnsafe.mockResolvedValue([
      {
        connection_ok: 1,
      },
    ]);

    const service = new DatabaseService(client);

    const latency = await service.ping();

    expect(queryRawUnsafe).toHaveBeenCalledWith(
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
