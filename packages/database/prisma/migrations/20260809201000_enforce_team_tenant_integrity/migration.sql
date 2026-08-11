-- Impide que una membresía declare una organización distinta a la del equipo.
CREATE UNIQUE INDEX "commercial_teams_id_organization_key"
ON "commercial_teams" ("id", "organization_id");

ALTER TABLE "commercial_team_members"
  DROP CONSTRAINT "commercial_team_members_team_id_fkey",
  ADD CONSTRAINT "commercial_team_members_team_organization_fkey"
    FOREIGN KEY ("team_id", "organization_id")
    REFERENCES "commercial_teams" ("id", "organization_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
