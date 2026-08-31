-- SPEC-038: cuotas de portabilidades entregadas por período y ventana.

CREATE TYPE "PerformanceQuotaWindow" AS ENUM ('ONE', 'TWO');

CREATE TABLE "performance_quotas" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "period_key" VARCHAR(7) NOT NULL,
  "window" "PerformanceQuotaWindow" NOT NULL,
  "team_id" UUID,
  "user_id" UUID,
  "target" INTEGER NOT NULL,
  "previous_target" INTEGER,
  "assigned_by_user_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "performance_quotas_pkey" PRIMARY KEY ("id")
);

-- El destinatario es un equipo o un asesor, nunca ambos ni ninguno.
ALTER TABLE "performance_quotas"
ADD CONSTRAINT "performance_quotas_single_target_check"
CHECK (("team_id" IS NULL) <> ("user_id" IS NULL));

-- Una cuota vigente por destinatario, período y ventana. Son índices
-- parciales porque en Postgres los NULL no colisionan entre sí.
CREATE UNIQUE INDEX "performance_quotas_team_period_window_key"
ON "performance_quotas"("organization_id", "period_key", "window", "team_id")
WHERE "team_id" IS NOT NULL;

CREATE UNIQUE INDEX "performance_quotas_user_period_window_key"
ON "performance_quotas"("organization_id", "period_key", "window", "user_id")
WHERE "user_id" IS NOT NULL;

CREATE INDEX "performance_quotas_org_period_window_idx"
ON "performance_quotas"("organization_id", "period_key", "window");

ALTER TABLE "performance_quotas"
ADD CONSTRAINT "performance_quotas_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "performance_quotas"
ADD CONSTRAINT "performance_quotas_team_id_fkey"
FOREIGN KEY ("team_id") REFERENCES "commercial_teams"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "performance_quotas"
ADD CONSTRAINT "performance_quotas_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "performance_quotas"
ADD CONSTRAINT "performance_quotas_assigned_by_user_id_fkey"
FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
