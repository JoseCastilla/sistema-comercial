import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import type { DatabaseClientPort } from './database.types';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(private readonly client: DatabaseClientPort) {}

  getClient(): DatabaseClientPort {
    return this.client;
  }

  async ping(): Promise<number> {
    const startedAt = Date.now();

    await this.client.$queryRaw`
      SELECT 1::integer AS connection_ok
    `;

    return Date.now() - startedAt;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
