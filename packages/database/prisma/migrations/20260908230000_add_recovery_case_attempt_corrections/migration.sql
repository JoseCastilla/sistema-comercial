-- SPEC-049 fase 4 (BR-017/BR-018): rectificación de un intento como registro
-- aparte. El intento original no se edita ni se borra (SPEC-030 BR-035); la
-- rectificación declara el resultado efectivo con autor, motivo y momento, y
-- no cuenta como contacto nuevo.

ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'ATTEMPT_CORRECTED';

CREATE TABLE "recovery_case_attempt_corrections" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "effective_result" "RecoveryAttemptResult" NOT NULL,
  "effective_reason" "RecoveryAttemptReason",
  "observation" TEXT,
  "correction_reason" TEXT NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recovery_case_attempt_corrections_pkey" PRIMARY KEY ("id")
);

-- Una rectificación por intento (BR-017).
CREATE UNIQUE INDEX "recovery_case_attempt_corrections_attempt_id_key"
ON "recovery_case_attempt_corrections"("attempt_id");

CREATE INDEX "recovery_case_attempt_corrections_case_created_idx"
ON "recovery_case_attempt_corrections"("case_id", "created_at");

CREATE INDEX "recovery_case_attempt_corrections_org_created_idx"
ON "recovery_case_attempt_corrections"("organization_id", "created_at");

ALTER TABLE "recovery_case_attempt_corrections"
ADD CONSTRAINT "recovery_case_attempt_corrections_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recovery_case_attempt_corrections"
ADD CONSTRAINT "recovery_case_attempt_corrections_case_id_fkey"
FOREIGN KEY ("case_id") REFERENCES "recovery_cases"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recovery_case_attempt_corrections"
ADD CONSTRAINT "recovery_case_attempt_corrections_attempt_id_fkey"
FOREIGN KEY ("attempt_id") REFERENCES "recovery_case_attempts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recovery_case_attempt_corrections"
ADD CONSTRAINT "recovery_case_attempt_corrections_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
