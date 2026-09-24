import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

export type DatabaseClient = PrismaClient;

const globalForDatabase = globalThis as typeof globalThis & {
  crmDatabase?: DatabaseClient;
};

function createClient(): DatabaseClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const database = globalForDatabase.crmDatabase ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.crmDatabase = database;
}
