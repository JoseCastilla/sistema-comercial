-- Separa el vínculo comercial de la asignación operativa. Los valores LINKED
-- creados por importaciones antiguas no representan un vínculo con CRM, por lo
-- que el estado se reconstruye desde commercial_service_id.
DROP INDEX IF EXISTS "dito_orders_org_match_captured_idx";

ALTER TYPE "DitoMatchStatus" RENAME TO "DitoCommercialLinkStatus";

ALTER TABLE "dito_orders"
  RENAME COLUMN "match_status" TO "commercial_link_status";

UPDATE "dito_orders"
SET "commercial_link_status" = CASE
  WHEN "commercial_service_id" IS NOT NULL
    THEN 'LINKED'::"DitoCommercialLinkStatus"
  ELSE 'UNMATCHED'::"DitoCommercialLinkStatus"
END;

-- El código original y el normalizado son las dos representaciones canónicas.
-- displayed_order_code duplicaba order_code_raw y el sufijo ya forma parte del
-- valor original conservado como evidencia.
ALTER TABLE "dito_orders"
  DROP COLUMN "displayed_order_code",
  DROP COLUMN "order_code_suffix";

-- Better Auth conserva las credenciales en auth_accounts. Esta columna nunca
-- fue utilizada y mantener dos almacenes de contraseña sería riesgoso.
ALTER TABLE "users" DROP COLUMN "password_hash";

-- La membresía primaria debe ser única dentro de cada organización, no de
-- forma global para el usuario.
ALTER TABLE "commercial_team_members"
  ADD COLUMN "organization_id" UUID;

UPDATE "commercial_team_members" AS member
SET "organization_id" = team."organization_id"
FROM "commercial_teams" AS team
WHERE team."id" = member."team_id";

ALTER TABLE "commercial_team_members"
  ALTER COLUMN "organization_id" SET NOT NULL,
  ADD CONSTRAINT "commercial_team_members_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "commercial_team_members_one_primary_agent_key";

CREATE UNIQUE INDEX "commercial_team_members_one_primary_agent_key"
ON "commercial_team_members" ("organization_id", "user_id")
WHERE
  "member_role" = 'AGENT'
  AND "is_primary" = true
  AND "is_active" = true;

-- Las restricciones se crean NOT VALID deliberadamente: protegen escrituras
-- nuevas y permiten auditar producción antes de validar el histórico.
ALTER TABLE "dito_orders"
  ADD CONSTRAINT "dito_orders_fixed_charge_nonnegative_check"
    CHECK ("fixed_charge" IS NULL OR "fixed_charge" >= 0) NOT VALID,
  ADD CONSTRAINT "dito_orders_billing_cycle_day_check"
    CHECK ("billing_cycle_day" IS NULL OR "billing_cycle_day" BETWEEN 1 AND 31) NOT VALID,
  ADD CONSTRAINT "dito_orders_payment_due_day_check"
    CHECK ("payment_due_day" IS NULL OR "payment_due_day" BETWEEN 1 AND 31) NOT VALID,
  ADD CONSTRAINT "dito_orders_coordinates_pair_check"
    CHECK (("delivery_latitude" IS NULL) = ("delivery_longitude" IS NULL)) NOT VALID,
  ADD CONSTRAINT "dito_orders_latitude_range_check"
    CHECK ("delivery_latitude" IS NULL OR "delivery_latitude" BETWEEN -90 AND 90) NOT VALID,
  ADD CONSTRAINT "dito_orders_longitude_range_check"
    CHECK ("delivery_longitude" IS NULL OR "delivery_longitude" BETWEEN -180 AND 180) NOT VALID,
  ADD CONSTRAINT "dito_orders_delivery_window_order_check"
    CHECK (
      "delivery_window_start" IS NULL
      OR "delivery_window_end" IS NULL
      OR "delivery_window_start" < "delivery_window_end"
    ) NOT VALID;

ALTER TABLE "dito_import_batches"
  ADD CONSTRAINT "dito_import_batches_nonnegative_counts_check"
    CHECK (
      "file_size" >= 0
      AND "header_row" >= 1
      AND "source_rows" >= 0
      AND "importable_rows" >= 0
      AND "excluded_rows" >= 0
      AND "invalid_rows" >= 0
      AND "new_rows" >= 0
      AND "enrichment_rows" >= 0
      AND "unchanged_rows" >= 0
      AND "blocked_rows" >= 0
      AND "conflict_rows" >= 0
    ) NOT VALID;
