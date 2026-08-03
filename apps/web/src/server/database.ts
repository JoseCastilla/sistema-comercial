import "server-only";

import { createPrismaClient } from "@repo/database";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

const globalForDatabase = globalThis as typeof globalThis & {
  sistemaComercialDatabase?: DatabaseClient;
};

export const database =
  globalForDatabase.sistemaComercialDatabase ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.sistemaComercialDatabase = database;
}
