CREATE TYPE "CommercialTeamAuditAction" AS ENUM (
  'TEAM_CREATED',
  'TEAM_DISABLED',
  'MEMBER_ASSIGNED'
);

CREATE TABLE "commercial_team_audit_logs" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "action" "CommercialTeamAuditAction" NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "target_user_id" UUID,
  "previous_values" JSONB,
  "new_values" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_team_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commercial_team_audit_org_created_idx"
  ON "commercial_team_audit_logs"("organization_id", "created_at");
CREATE INDEX "commercial_team_audit_team_created_idx"
  ON "commercial_team_audit_logs"("team_id", "created_at");
CREATE INDEX "commercial_team_audit_actor_created_idx"
  ON "commercial_team_audit_logs"("actor_user_id", "created_at");

ALTER TABLE "commercial_team_audit_logs"
  ADD CONSTRAINT "commercial_team_audit_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_team_audit_logs"
  ADD CONSTRAINT "commercial_team_audit_logs_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "commercial_teams"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_team_audit_logs"
  ADD CONSTRAINT "commercial_team_audit_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_team_audit_logs"
  ADD CONSTRAINT "commercial_team_audit_logs_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
