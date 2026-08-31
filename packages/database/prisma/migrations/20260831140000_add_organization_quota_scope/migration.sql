-- SPEC-038: la cuota gana un nivel por encima de los equipos. Una fila sin
-- equipo ni asesor es la cuota de toda la organización, que el dueño fija y
-- la administración reparte entre los equipos.

ALTER TABLE "performance_quotas"
DROP CONSTRAINT "performance_quotas_single_target_check";

-- Equipo o asesor, nunca ambos. Ninguno de los dos significa organización.
ALTER TABLE "performance_quotas"
ADD CONSTRAINT "performance_quotas_single_target_check"
CHECK (NOT ("team_id" IS NOT NULL AND "user_id" IS NOT NULL));

-- Una sola cuota de organización por período y ventana.
CREATE UNIQUE INDEX "performance_quotas_org_period_window_key"
ON "performance_quotas"("organization_id", "period_key", "window")
WHERE "team_id" IS NULL AND "user_id" IS NULL;
