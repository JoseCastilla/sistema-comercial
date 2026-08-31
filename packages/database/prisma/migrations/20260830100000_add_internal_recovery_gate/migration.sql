-- SPEC-030 Fase 5: puerta interna de recuperación (BR-061 a BR-073).

CREATE TYPE "RecoveryEntryReason" AS ENUM (
  'NO_ENTREGADO',
  'INCIDENCIA_LOGISTICA',
  'PROMESA_COMERCIAL_INCORRECTA',
  'DEUDA',
  'ANTIGUEDAD_PORTA',
  'OTRO'
);

CREATE TYPE "RecoveryCasePriority" AS ENUM (
  'CRITICA',
  'ALTA',
  'MEDIA',
  'CONDICIONADA'
);

ALTER TABLE "recovery_cases"
ADD COLUMN "source_dito_order_id" UUID,
ADD COLUMN "original_agent_user_id" UUID,
ADD COLUMN "original_team_id" UUID,
ADD COLUMN "entry_reason" "RecoveryEntryReason",
ADD COLUMN "entry_observation" TEXT,
ADD COLUMN "priority" "RecoveryCasePriority";

ALTER TABLE "recovery_cases"
ADD CONSTRAINT "recovery_cases_source_dito_order_id_fkey"
FOREIGN KEY ("source_dito_order_id") REFERENCES "dito_orders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recovery_cases"
ADD CONSTRAINT "recovery_cases_original_agent_user_id_fkey"
FOREIGN KEY ("original_agent_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recovery_cases"
ADD CONSTRAINT "recovery_cases_original_team_id_fkey"
FOREIGN KEY ("original_team_id") REFERENCES "commercial_teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "recovery_cases_source_order_status_idx"
ON "recovery_cases"("source_dito_order_id", "status");

CREATE INDEX "recovery_cases_org_priority_status_idx"
ON "recovery_cases"("organization_id", "priority", "status");

-- BR-061: una orden origen tiene a lo sumo un caso abierto. El índice parcial
-- hace que la idempotencia la garantice la base, no solo la transacción.
CREATE UNIQUE INDEX "recovery_cases_source_order_open_unique"
ON "recovery_cases"("source_dito_order_id")
WHERE "source_dito_order_id" IS NOT NULL
  AND "status" NOT IN ('RECOVERED', 'LOST', 'DISCARDED');
