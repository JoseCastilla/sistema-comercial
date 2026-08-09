ALTER TABLE "dito_agent_identities"
  ADD COLUMN "is_shared_account" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "dito_import_rows"
  ADD COLUMN "manual_agent_user_id" UUID,
  ADD COLUMN "manual_team_id" UUID,
  ADD COLUMN "manual_assigned_by_user_id" UUID,
  ADD COLUMN "manual_assigned_at" TIMESTAMPTZ(3),
  ADD COLUMN "manual_assignment_reason" VARCHAR(50),
  ADD CONSTRAINT "dito_import_rows_manual_assignment_complete_check"
    CHECK (
      ("manual_agent_user_id" IS NULL
        AND "manual_team_id" IS NULL
        AND "manual_assigned_by_user_id" IS NULL
        AND "manual_assigned_at" IS NULL
        AND "manual_assignment_reason" IS NULL)
      OR
      ("manual_agent_user_id" IS NOT NULL
        AND "manual_team_id" IS NOT NULL
        AND "manual_assigned_by_user_id" IS NOT NULL
        AND "manual_assigned_at" IS NOT NULL
        AND "manual_assignment_reason" IS NOT NULL)
    );

ALTER TABLE "dito_import_rows"
  ADD CONSTRAINT "dito_import_rows_manual_agent_user_id_fkey"
    FOREIGN KEY ("manual_agent_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "dito_import_rows_manual_team_id_fkey"
    FOREIGN KEY ("manual_team_id") REFERENCES "commercial_teams"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "dito_import_rows_manual_assigned_by_user_id_fkey"
    FOREIGN KEY ("manual_assigned_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "dito_import_rows_manual_agent_assigned_idx"
  ON "dito_import_rows"("manual_agent_user_id", "manual_assigned_at");

CREATE INDEX "dito_import_rows_manual_team_assigned_idx"
  ON "dito_import_rows"("manual_team_id", "manual_assigned_at");
