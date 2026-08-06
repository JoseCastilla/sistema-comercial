CREATE UNIQUE INDEX "commercial_teams_org_active_name_unique"
  ON "commercial_teams"("organization_id", "normalized_name")
  WHERE "status" = 'ACTIVE';
