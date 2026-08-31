-- SPEC-030 BR-035/BR-036: intentos de contacto inmutables por caso.

CREATE TYPE "RecoveryAttemptChannel" AS ENUM (
  'LLAMADA',
  'WHATSAPP',
  'SMS',
  'PRESENCIAL',
  'OTRO'
);

CREATE TYPE "RecoveryAttemptResult" AS ENUM (
  'SIN_RESPUESTA',
  'INTERESADO',
  'RECHAZA',
  'AGENDA',
  'NUMERO_ERRADO',
  'NO_CUMPLE_30D',
  'YA_ACTIVO',
  'DATOS_INVALIDOS',
  'VENDIDO'
);

CREATE TABLE "recovery_case_attempts" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "channel" "RecoveryAttemptChannel" NOT NULL,
  "result" "RecoveryAttemptResult" NOT NULL,
  "phone_used" VARCHAR(15),
  "observation" TEXT,
  "next_action_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recovery_case_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recovery_case_attempts_case_created_idx"
ON "recovery_case_attempts"("case_id", "created_at");

CREATE INDEX "recovery_case_attempts_org_created_idx"
ON "recovery_case_attempts"("organization_id", "created_at");

CREATE INDEX "recovery_case_attempts_actor_created_idx"
ON "recovery_case_attempts"("actor_user_id", "created_at");

ALTER TABLE "recovery_case_attempts"
ADD CONSTRAINT "recovery_case_attempts_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recovery_case_attempts"
ADD CONSTRAINT "recovery_case_attempts_case_id_fkey"
FOREIGN KEY ("case_id") REFERENCES "recovery_cases"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recovery_case_attempts"
ADD CONSTRAINT "recovery_case_attempts_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
