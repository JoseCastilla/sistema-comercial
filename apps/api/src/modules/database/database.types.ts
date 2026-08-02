import type { DatabaseClient } from '@repo/database';

/**
 * Cliente Prisma compartido por los repositorios de la API.
 */
export type DatabaseClientPort = DatabaseClient;
