-- SPEC-048 fase 0 — Corregir las citas acordadas guardadas cinco horas antes.
--
-- Hasta el despliegue de la corrección (parseLimaDateTimeLocal), la web
-- interpretaba la hora del formulario en la zona del servidor (UTC): una cita
-- escrita como 10:00 de Lima quedó guardada como 05:00 de Lima. La lectura de
-- producción del 08/09/2026 lo confirmó: 32 de 45 citas entre las 02:00 y las
-- 07:00, y las restantes con la misma hora de registro menos cinco (por
-- ejemplo, registrada a las 18:35, «acordada» a las 13:35). Todas están
-- corridas, no solo las de madrugada.
--
-- Qué hace, en una sola transacción:
--   1. suma cinco horas a la próxima acción de los casos SCHEDULED cuyo último
--      intento es AGENDA y coincide con esa próxima acción (las citas vigentes);
--   2. suma cinco horas a next_action_at de todos los intentos AGENDA
--      anteriores al corte, para que el historial diga la hora que el asesor
--      escribió (es una corrección de evidencia, no una edición: queda el
--      evento con el valor anterior);
--   3. deja un evento NEXT_ACTION_CORRECTED por caso corregido con la hora
--      anterior, la nueva y el intento.
--
-- Cómo ejecutarlo (psql), después de `migrate deploy` y del despliegue del
-- código corregido, y solo una vez:
--
--   psql "$DATABASE_URL" -v corte="'2026-09-08T23:00:00Z'" -f corregir-horas-agendadas-2026-09-08.sql
--
-- `corte` es el instante UTC en que quedó desplegado el código corregido:
-- lo registrado después ya está bien y no debe tocarse. Antes de ejecutar,
-- revisar el conteo que imprime el paso 0 contra la lectura previa (30
-- vigentes el 08/09/2026).

\set ON_ERROR_STOP on

BEGIN;

-- 0. Población a corregir.
CREATE TEMP TABLE citas_a_corregir ON COMMIT DROP AS
SELECT
  c.id               AS case_id,
  c.organization_id,
  c.next_action_at   AS anterior,
  c.next_action_at + INTERVAL '5 hours' AS nueva,
  a.id               AS attempt_id
FROM recovery_cases c
JOIN LATERAL (
  SELECT id, result, next_action_at, created_at
  FROM recovery_case_attempts
  WHERE case_id = c.id
  ORDER BY created_at DESC
  LIMIT 1
) a ON TRUE
WHERE c.source = 'NATIONAL_BASE'
  AND c.status = 'SCHEDULED'
  AND a.result = 'AGENDA'
  AND a.next_action_at IS NOT NULL
  AND a.next_action_at = c.next_action_at
  AND a.created_at < :corte::timestamptz;

SELECT COUNT(*) AS citas_vigentes_a_corregir FROM citas_a_corregir;

-- 1. Próxima acción de los casos vigentes.
UPDATE recovery_cases c
SET next_action_at = x.nueva,
    updated_at = NOW()
FROM citas_a_corregir x
WHERE c.id = x.case_id;

-- 2. Hora acordada en los intentos AGENDA anteriores al corte.
UPDATE recovery_case_attempts a
SET next_action_at = a.next_action_at + INTERVAL '5 hours'
WHERE a.result = 'AGENDA'
  AND a.next_action_at IS NOT NULL
  AND a.created_at < :corte::timestamptz;

-- 3. Evidencia por caso corregido.
INSERT INTO recovery_case_events (
  id, organization_id, case_id, type, actor_user_id,
  previous_status, new_status, observation, metadata, created_at
)
SELECT
  gen_random_uuid(),
  x.organization_id,
  x.case_id,
  'NEXT_ACTION_CORRECTED',
  NULL,
  'SCHEDULED',
  'SCHEDULED',
  'Corrección de zona horaria: la hora acordada se había guardado cinco horas antes (SPEC-048 §2.2).',
  jsonb_build_object(
    'previousNextActionAt', x.anterior,
    'nextActionAt', x.nueva,
    'attemptId', x.attempt_id,
    'corte', :corte::timestamptz
  ),
  NOW()
FROM citas_a_corregir x;

-- Lectura final: debe coincidir con el conteo del paso 0.
SELECT
  COUNT(*) AS casos_corregidos,
  MIN(nueva AT TIME ZONE 'America/Lima') AS primera_cita_lima,
  MAX(nueva AT TIME ZONE 'America/Lima') AS ultima_cita_lima
FROM citas_a_corregir;

COMMIT;
