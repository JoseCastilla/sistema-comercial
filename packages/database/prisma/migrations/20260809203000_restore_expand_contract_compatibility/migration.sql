-- Esta migración es idempotente. En una base nueva no modifica nada; restaura
-- las columnas de compatibilidad cuando la primera versión de SPEC-015 llegó a
-- ejecutarse localmente antes de adoptar el despliegue expand/contract.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DitoMatchStatus') THEN
    CREATE TYPE "DitoMatchStatus" AS ENUM (
      'UNMATCHED',
      'SUGGESTED',
      'LINKED',
      'NEEDS_REVIEW',
      'DISMISSED'
    );
  END IF;
END $$;

ALTER TABLE "dito_orders"
  ADD COLUMN IF NOT EXISTS "match_status" "DitoMatchStatus"
    NOT NULL DEFAULT 'UNMATCHED',
  ADD COLUMN IF NOT EXISTS "order_code_suffix" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "displayed_order_code" VARCHAR(100);

UPDATE "dito_orders"
SET
  "order_code_suffix" = COALESCE("order_code_suffix", 'A'),
  "displayed_order_code" = COALESCE("displayed_order_code", "order_code_raw");

ALTER TABLE "dito_orders"
  ALTER COLUMN "order_code_suffix" SET DEFAULT 'A',
  ALTER COLUMN "order_code_suffix" SET NOT NULL;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_hash" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "dito_orders_org_match_captured_idx"
ON "dito_orders" ("organization_id", "match_status", "captured_at");
