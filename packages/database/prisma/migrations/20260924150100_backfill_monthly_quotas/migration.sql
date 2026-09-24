-- SPEC-064 P-01 (decisión de José del 24/09/2026): todas las cuotas cargadas
-- se pensaron para el mes completo. La pantalla de Cuotas abría en la ventana
-- vigente, así que la cuota del mes quedó en la fila de la primera ventana; si
-- no la hay, en la de la segunda. Se copia a una fila MONTH y las filas por
-- ventana se conservan como historia (SPEC-038 BR-010, BR-011).
--
-- Idempotente: solo crea la fila mensual que todavía no existe.
INSERT INTO "performance_quotas" (
  "id",
  "organization_id",
  "period_key",
  "window",
  "team_id",
  "user_id",
  "target",
  "previous_target",
  "assigned_by_user_id",
  "assigned_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  q."organization_id",
  q."period_key",
  'MONTH',
  q."team_id",
  q."user_id",
  q."target",
  NULL,
  q."assigned_by_user_id",
  q."assigned_at",
  now(),
  now()
FROM "performance_quotas" q
WHERE q."window" IN ('ONE', 'TWO')
  -- La primera ventana manda; la segunda solo si no hay primera.
  AND (
    q."window" = 'ONE'
    OR NOT EXISTS (
      SELECT 1
      FROM "performance_quotas" one
      WHERE one."window" = 'ONE'
        AND one."organization_id" = q."organization_id"
        AND one."period_key" = q."period_key"
        AND one."team_id" IS NOT DISTINCT FROM q."team_id"
        AND one."user_id" IS NOT DISTINCT FROM q."user_id"
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "performance_quotas" month
    WHERE month."window" = 'MONTH'
      AND month."organization_id" = q."organization_id"
      AND month."period_key" = q."period_key"
      AND month."team_id" IS NOT DISTINCT FROM q."team_id"
      AND month."user_id" IS NOT DISTINCT FROM q."user_id"
  );
