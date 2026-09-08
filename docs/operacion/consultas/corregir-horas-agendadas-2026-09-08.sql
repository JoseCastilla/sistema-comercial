-- SPEC-048 fase 0 — Corregir las citas acordadas guardadas cinco horas antes.
--
-- Hasta el despliegue de la corrección (parseLimaDateTimeLocal, main 787d26b
-- del 08/09/2026 a las 16:26 UTC), la web interpretaba la hora del formulario
-- en la zona del servidor (UTC): una cita escrita como 10:00 de Lima quedó
-- guardada como 05:00 de Lima. La lectura de producción del 08/09/2026 lo
-- confirmó: 32 de 45 citas entre las 02:00 y las 07:00, y las restantes con
-- la misma hora de registro menos cinco (registrada a las 18:35, «acordada»
-- a las 13:35). Todas están corridas, no solo las de madrugada.
--
-- Qué hace, en una sola transacción:
--   1. suma cinco horas a la próxima acción de los casos SCHEDULED cuyo último
--      intento es AGENDA y coincide con esa próxima acción (las citas vigentes);
--   2. suma cinco horas a next_action_at de todos los intentos AGENDA
--      anteriores al corte, para que el historial diga la hora que el asesor
--      escribió (corrección de evidencia con evento, no edición silenciosa);
--   3. deja un evento NEXT_ACTION_CORRECTED por caso corregido con la hora
--      anterior, la nueva y el intento.
--
-- Cómo ejecutarlo en DbGate (o cualquier cliente), una sola vez:
--   a) Ejecutar primero el bloque «0. Antes de corregir» y leer sus tres
--      resultados: el enum debe incluir NEXT_ACTION_CORRECTED (la migración
--      ya corrió); las citas vigentes deben ser 30; y no debe haber citas
--      registradas después del corte (si las hay, la web nueva ya estaba
--      arriba cuando se registraron y NO deben corregirse: subir el corte
--      a un instante anterior a la primera de ellas no sirve; hay que
--      dejarlas fuera, y el corte ya lo hace mientras sea anterior).
--   b) Ajustar el literal del corte en «CREATE TEMP TABLE corte»: el instante
--      UTC en que la web nueva quedó arriba. Nunca anterior al arranque real
--      del contenedor nuevo.
--   c) Seleccionar desde BEGIN hasta COMMIT y ejecutarlo como un solo lote.
--      El conteo del paso 1 debe coincidir con el del paso 0; si no, ejecutar
--      ROLLBACK en vez de COMMIT y avisar.

-- =====================================================================
-- 0. Antes de corregir (solo lectura; ejecutar aparte)
-- =====================================================================

-- 0a. ¿La migración ya corrió? Debe aparecer NEXT_ACTION_CORRECTED.
SELECT unnest(enum_range(NULL::"RecoveryCaseEventType")) AS tipo_de_evento;

-- 0b. Citas vigentes que se corregirían (esperado el 08/09/2026: 30).
SELECT COUNT(*) AS citas_vigentes
FROM recovery_cases c
JOIN LATERAL (
  SELECT result, next_action_at, created_at
  FROM recovery_case_attempts
  WHERE case_id = c.id
  ORDER BY created_at DESC
  LIMIT 1
) a ON TRUE
WHERE c.source = 'NATIONAL_BASE'
  AND c.status = 'SCHEDULED'
  AND a.result = 'AGENDA'
  AND a.next_action_at IS NOT NULL
  AND a.next_action_at = c.next_action_at;

-- 0c. Citas registradas después del despliegue (esperado: ninguna, o solo
--     las hechas con el código nuevo, que quedan fuera por el corte).
SELECT
  a.created_at AT TIME ZONE 'America/Lima'     AS registrada_lima,
  a.next_action_at AT TIME ZONE 'America/Lima' AS acordada_lima,
  c.holder_name                                 AS cliente
FROM recovery_case_attempts a
JOIN recovery_cases c ON c.id = a.case_id
WHERE a.result = 'AGENDA'
  AND a.created_at >= '2026-09-08T16:26:00Z'::timestamptz
ORDER BY a.created_at;

-- =====================================================================
-- Corrección (seleccionar desde BEGIN hasta COMMIT y ejecutar como un lote)
-- =====================================================================

BEGIN;

-- Instante UTC en que la web corregida quedó arriba. AJUSTAR antes de correr.
CREATE TEMP TABLE corte ON COMMIT DROP AS
SELECT '2026-09-08T16:40:00Z'::timestamptz AS momento;

-- 1. Población a corregir.
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
  AND a.created_at < (SELECT momento FROM corte);

SELECT COUNT(*) AS citas_vigentes_a_corregir FROM citas_a_corregir;

-- 2. Próxima acción de los casos vigentes.
UPDATE recovery_cases c
SET next_action_at = x.nueva,
    updated_at = NOW()
FROM citas_a_corregir x
WHERE c.id = x.case_id;

-- 3. Hora acordada en los intentos AGENDA anteriores al corte.
UPDATE recovery_case_attempts a
SET next_action_at = a.next_action_at + INTERVAL '5 hours'
WHERE a.result = 'AGENDA'
  AND a.next_action_at IS NOT NULL
  AND a.created_at < (SELECT momento FROM corte);

-- 4. Evidencia por caso corregido.
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
    'corte', (SELECT momento FROM corte)
  ),
  NOW()
FROM citas_a_corregir x;

-- 5. Lectura final: debe coincidir con el conteo del paso 1.
SELECT
  COUNT(*)                                        AS casos_corregidos,
  MIN(nueva AT TIME ZONE 'America/Lima')          AS primera_cita_lima,
  MAX(nueva AT TIME ZONE 'America/Lima')          AS ultima_cita_lima
FROM citas_a_corregir;

COMMIT;

-- =====================================================================
-- Después de corregir (solo lectura): las horas deben verse de jornada.
-- =====================================================================
SELECT
  EXTRACT(HOUR FROM c.next_action_at AT TIME ZONE 'America/Lima')::int AS hora_lima,
  COUNT(*) AS citas
FROM recovery_cases c
WHERE c.source = 'NATIONAL_BASE' AND c.status = 'SCHEDULED'
GROUP BY 1
ORDER BY 1;
