-- SPEC-049 fase 1 (BR-001 a BR-006, BR-009 a BR-011): cada resultado con su
-- consecuencia. Motivo del intento, fecha de seguimiento, apoyo del
-- supervisor, línea afectada, fecha de portación informada por el cliente y
-- tres resultados nuevos. Nada se reescribe: los registros anteriores quedan
-- con motivo nulo y CANCELADO se conserva en el historial.

ALTER TYPE "RecoveryAttemptResult" ADD VALUE 'NO_CONTACTAR';
ALTER TYPE "RecoveryAttemptResult" ADD VALUE 'TIENE_PEDIDO';
ALTER TYPE "RecoveryAttemptResult" ADD VALUE 'IMPEDIMENTO';

CREATE TYPE "RecoveryAttemptReason" AS ENUM (
  'NO_CONTESTA',
  'APAGADO',
  'OCUPADO',
  'HUELLA',
  'OTRO'
);

ALTER TABLE "recovery_case_attempts"
  ADD COLUMN "reason" "RecoveryAttemptReason",
  ADD COLUMN "follow_up_at" TIMESTAMPTZ(3),
  ADD COLUMN "needs_supervisor" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "affected_service_id" UUID;

ALTER TABLE "recovery_case_attempts"
ADD CONSTRAINT "recovery_case_attempts_affected_service_id_fkey"
FOREIGN KEY ("affected_service_id") REFERENCES "recovery_case_services"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recovery_case_services"
  ADD COLUMN "portability_reported_at" TIMESTAMPTZ(3);

-- SPEC-048 BR-006 (pendiente allí): la habilitación del caso es la más
-- temprana de sus líneas activas. Hasta hoy la columna del caso se leía en
-- la bandeja, Repartir y la toma de bloques, y nadie la escribía.
UPDATE "recovery_cases" c
SET "portability_eligible_at" = s."eligible_at"
FROM (
  SELECT "case_id", MIN("portability_eligible_at") AS "eligible_at"
  FROM "recovery_case_services"
  WHERE "discarded_at" IS NULL AND "portability_eligible_at" IS NOT NULL
  GROUP BY "case_id"
) s
WHERE s."case_id" = c."id"
  AND c."portability_eligible_at" IS DISTINCT FROM s."eligible_at";
