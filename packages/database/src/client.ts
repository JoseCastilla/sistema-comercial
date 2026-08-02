import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

/**
 * Cliente tipado utilizado por la API y el worker.
 */
export type DatabaseClient = PrismaClient;

/**
 * Crea una conexión Prisma usando PostgreSQL.
 *
 * Cada proceso de la plataforma debe crear una sola instancia:
 * - una para la API;
 * - una para el worker.
 */
export function createPrismaClient(
  connectionString: string | undefined =
    process.env.DATABASE_URL,
): DatabaseClient {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL no está configurada',
    );
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  return new PrismaClient({
    adapter,
  });
}
