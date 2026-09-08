-- SPEC-048 fase 1 (BR-002, BR-005, BR-007): la cita acordada con el cliente
-- como registro propio. Lo demás que aparece en la agenda —reintentos,
-- seguimientos, habilitaciones, verificación— se deriva del caso y no se
-- guarda dos veces.

CREATE TYPE "RecoveryCommitmentStatus" AS ENUM (
  'PENDING',
  'DONE',
  'RESCHEDULED',
  'CANCELLED'
);

CREATE TYPE "RecoveryCommitmentNextAction" AS ENUM (
  'RESUME_TODAY',
  'PAUSE_1D',
  'PAUSE_2D'
);

ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'COMMITMENT_RESCHEDULED';
ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'COMMITMENT_CANCELLED';

CREATE TABLE "recovery_case_commitments" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
  "duration_minutes" INTEGER,
  "status" "RecoveryCommitmentStatus" NOT NULL DEFAULT 'PENDING',
  "origin_attempt_id" UUID,
  "resolved_attempt_id" UUID,
  "superseded_by_id" UUID,
  "reason" TEXT,
  "cancel_next_action" "RecoveryCommitmentNextAction",
  "created_by_user_id" UUID NOT NULL,
  "closed_by_user_id" UUID,
  "closed_at" TIMESTAMPTZ(3),
  "client_request_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recovery_case_commitments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recovery_case_commitments_case_request_key"
ON "recovery_case_commitments"("case_id", "client_request_id");

-- BR-002: a lo sumo una cita pendiente por caso. Prisma no expresa índices
-- parciales; vive solo aquí.
CREATE UNIQUE INDEX "recovery_case_commitments_one_pending_per_case_key"
ON "recovery_case_commitments"("case_id")
WHERE "status" = 'PENDING';

CREATE INDEX "recovery_case_commitments_case_created_idx"
ON "recovery_case_commitments"("case_id", "created_at");

CREATE INDEX "recovery_case_commitments_org_status_scheduled_idx"
ON "recovery_case_commitments"("organization_id", "status", "scheduled_at");

ALTER TABLE "recovery_case_commitments"
ADD CONSTRAINT "recovery_case_commitments_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recovery_case_commitments"
ADD CONSTRAINT "recovery_case_commitments_case_id_fkey"
FOREIGN KEY ("case_id") REFERENCES "recovery_cases"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recovery_case_commitments"
ADD CONSTRAINT "recovery_case_commitments_origin_attempt_id_fkey"
FOREIGN KEY ("origin_attempt_id") REFERENCES "recovery_case_attempts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recovery_case_commitments"
ADD CONSTRAINT "recovery_case_commitments_resolved_attempt_id_fkey"
FOREIGN KEY ("resolved_attempt_id") REFERENCES "recovery_case_attempts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recovery_case_commitments"
ADD CONSTRAINT "recovery_case_commitments_superseded_by_id_fkey"
FOREIGN KEY ("superseded_by_id") REFERENCES "recovery_case_commitments"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recovery_case_commitments"
ADD CONSTRAINT "recovery_case_commitments_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recovery_case_commitments"
ADD CONSTRAINT "recovery_case_commitments_closed_by_user_id_fkey"
FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- BR-007: relleno inicial. Solo los casos SCHEDULED cuyo intento más reciente
-- es AGENDA y cuya próxima acción coincide con la de ese intento se
-- convierten en cita PENDING (30 en producción el 08/09/2026, ya con la hora
-- corregida). Ningún otro registro se convierte en cita. Idempotente: no
-- crea una segunda cita si el caso ya tiene una pendiente.
INSERT INTO "recovery_case_commitments" (
  "id", "organization_id", "case_id", "scheduled_at", "status",
  "origin_attempt_id", "created_by_user_id", "created_at"
)
SELECT
  gen_random_uuid(),
  c."organization_id",
  c."id",
  c."next_action_at",
  'PENDING',
  a."id",
  a."actor_user_id",
  a."created_at"
FROM "recovery_cases" c
JOIN LATERAL (
  SELECT "id", "result", "next_action_at", "actor_user_id", "created_at"
  FROM "recovery_case_attempts"
  WHERE "case_id" = c."id"
  ORDER BY "created_at" DESC
  LIMIT 1
) a ON TRUE
WHERE c."status" = 'SCHEDULED'
  AND c."next_action_at" IS NOT NULL
  AND a."result" = 'AGENDA'
  AND a."next_action_at" = c."next_action_at"
  AND NOT EXISTS (
    SELECT 1 FROM "recovery_case_commitments" x
    WHERE x."case_id" = c."id" AND x."status" = 'PENDING'
  );
