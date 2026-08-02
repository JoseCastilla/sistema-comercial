import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import type { DatabaseClientPort } from './database.types';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(private readonly client: DatabaseClientPort) {}

  /**
   * Ejecuta una consulta mínima y devuelve su latencia.
   */
  async ping(): Promise<number> {
    const startedAt = Date.now();

    await this.client.$queryRawUnsafe('SELECT 1::integer AS connection_ok');

    return Date.now() - startedAt;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
