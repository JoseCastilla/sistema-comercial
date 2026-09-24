// Guarda de las operaciones de base del CRM (auditoría del 24/09/2026, A3).
//
// Prisma toma DATABASE_URL de la terminal antes que de apps/crm/.env
// (dotenv no pisa una variable ya exportada). Si en la terminal quedó la base
// del Sistema Comercial —o la de producción—, `db:reset` la vaciaría entera.
// Esta guarda resuelve la URL igual que prisma.config.ts y solo deja seguir
// si la base se llama crm_…
import process from "node:process";

import "dotenv/config";

const raw = process.env.DATABASE_URL ?? "";
let databaseName = "";

try {
  databaseName = decodeURIComponent(new URL(raw).pathname.replace(/^\//, ""));
} catch {
  databaseName = "";
}

if (!databaseName.startsWith("crm_")) {
  console.error(
    `✗ El CRM solo opera sobre bases «crm_…», y DATABASE_URL apunta a «${databaseName || "(sin base)"}».`,
  );
  console.error(
    "  Revisa si la terminal tiene exportada la DATABASE_URL de otra app.",
  );
  process.exit(1);
}
