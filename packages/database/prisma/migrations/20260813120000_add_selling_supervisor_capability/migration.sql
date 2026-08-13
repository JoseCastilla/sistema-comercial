-- Separa la autoridad jerarquica de la capacidad comercial. Un supervisor
-- puede seguir vendiendo temporalmente sin introducir un rol combinado.
ALTER TABLE "commercial_team_members"
  ADD COLUMN "sales_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "commercial_team_members"
SET "sales_enabled" = true
WHERE "member_role" = 'AGENT';

DROP INDEX IF EXISTS "commercial_team_members_one_primary_agent_key";

CREATE UNIQUE INDEX "commercial_team_members_one_primary_seller_key"
ON "commercial_team_members" ("organization_id", "user_id")
WHERE
  "sales_enabled" = true
  AND "is_primary" = true
  AND "is_active" = true;

CREATE INDEX "commercial_team_members_user_sales_active_idx"
ON "commercial_team_members" ("user_id", "sales_enabled", "is_active");

ALTER TABLE "commercial_team_members"
  ADD CONSTRAINT "commercial_team_members_primary_requires_sales_check"
  CHECK (NOT "is_primary" OR "sales_enabled") NOT VALID;
