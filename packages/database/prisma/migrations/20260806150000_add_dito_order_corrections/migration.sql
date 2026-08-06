CREATE TYPE "DitoOrderCorrectionSource" AS ENUM ('MANUAL_ADMIN');

CREATE TABLE "dito_order_corrections" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "dito_order_id" UUID NOT NULL,
  "source" "DitoOrderCorrectionSource" NOT NULL,
  "actor_user_id" UUID,
  "reason" VARCHAR(500) NOT NULL,
  "previous_values" JSONB NOT NULL,
  "new_values" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dito_order_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dito_order_corrections_org_created_idx"
  ON "dito_order_corrections"("organization_id", "created_at");
CREATE INDEX "dito_order_corrections_order_created_idx"
  ON "dito_order_corrections"("dito_order_id", "created_at");
CREATE INDEX "dito_order_corrections_actor_created_idx"
  ON "dito_order_corrections"("actor_user_id", "created_at");

ALTER TABLE "dito_order_corrections"
  ADD CONSTRAINT "dito_order_corrections_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dito_order_corrections"
  ADD CONSTRAINT "dito_order_corrections_dito_order_id_fkey"
  FOREIGN KEY ("dito_order_id") REFERENCES "dito_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dito_order_corrections"
  ADD CONSTRAINT "dito_order_corrections_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Clasifica registros históricos provenientes de extensiones antiguas sin
-- descartarlos, para que ADMIN pueda encontrarlos por código y corregirlos.
UPDATE "dito_orders"
SET
  "parse_status" = 'PARTIAL',
  "match_status" = 'NEEDS_REVIEW',
  "updated_at" = CURRENT_TIMESTAMP
WHERE
  "operation_raw" ILIKE '%N/A%N/A%'
  OR BTRIM("operation_raw") IN ('', 'N/A', '-')
  OR BTRIM("holder_full_name_raw") IN ('', 'N/A', '-')
  OR "holder_document_number" !~ '^\d{8,11}$'
  OR "service_number" !~ '^\d{7,15}$'
  OR BTRIM("department") IN ('', 'N/A', '-')
  OR BTRIM("province") IN ('', 'N/A', '-')
  OR BTRIM("district") IN ('', 'N/A', '-')
  OR "delivery_method" = 'UNKNOWN'
  OR "commercial_operation" = 'UNKNOWN'
  OR (
    "commercial_operation" <> 'NEW_LINE'
    AND "carrier" = 'UNKNOWN'
  );
