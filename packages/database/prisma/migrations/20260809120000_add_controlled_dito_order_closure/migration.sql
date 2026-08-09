ALTER TABLE "dito_orders"
  ADD COLUMN "closed_by_user_id" UUID,
  ADD COLUMN "closed_at" TIMESTAMPTZ(3),
  ADD CONSTRAINT "dito_orders_closed_by_user_id_fkey"
    FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "dito_orders_closure_audit_complete_check"
    CHECK (
      ("closed_by_user_id" IS NULL AND "closed_at" IS NULL)
      OR
      ("closed_by_user_id" IS NOT NULL AND "closed_at" IS NOT NULL)
    );

WITH "latest_closure" AS (
  SELECT DISTINCT ON ("dito_order_id")
    "dito_order_id",
    "changed_by_user_id",
    "changed_at"
  FROM "dito_order_status_history"
  WHERE "new_status" = 'CLOSED'
  ORDER BY "dito_order_id", "changed_at" DESC, "id" DESC
)
UPDATE "dito_orders" AS "orders"
SET
  "closed_by_user_id" = "latest_closure"."changed_by_user_id",
  "closed_at" = "latest_closure"."changed_at"
FROM "latest_closure"
WHERE "orders"."id" = "latest_closure"."dito_order_id"
  AND "orders"."status" = 'CLOSED';

CREATE INDEX "dito_orders_org_closed_at_idx"
  ON "dito_orders"("organization_id", "closed_at");
