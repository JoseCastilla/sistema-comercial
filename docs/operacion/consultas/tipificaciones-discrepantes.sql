-- SPEC-049 BR-019 — Tipificaciones cuya observación podría contradecir al
-- resultado. Solo lectura: nada cambia desde aquí. Sirve para medir cuánto
-- hay antes de revisarlo caso por caso en Seguimiento → «Revisar
-- tipificaciones», y para auditar después de la revisión.
--
-- Las heurísticas son las mismas que aplica la plataforma
-- (recovery-attempt-quality.ts). Se excluyen los intentos ya rectificados.
--
-- DbGate ejecuta cada sentencia por separado, así que la clasificación vive
-- en una vista temporal (dura lo que la sesión) y las dos lecturas la usan.
-- Ejecutar el archivo completo, en orden.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE TEMP VIEW tipificaciones_discrepantes AS
WITH intentos AS (
  SELECT
    a.id,
    a.case_id,
    a.actor_user_id,
    a.created_at,
    a.result::text AS resultado,
    lower(unaccent(coalesce(a.observation, ''))) AS obs,
    a.observation
  FROM recovery_case_attempts a
  LEFT JOIN recovery_case_attempt_corrections x ON x.attempt_id = a.id
  WHERE x.id IS NULL
    AND a.created_at >= now() - interval '30 days'
)
SELECT
  i.*,
  CASE
    WHEN resultado <> 'YA_ACTIVO'
      AND (obs LIKE '%ya es movistar%' OR obs LIKE '%ya tiene movistar%' OR obs LIKE '%ya esta en movistar%' OR obs LIKE '%ya activo%' OR obs LIKE '%ya porto%' OR obs LIKE '%ya migro%')
      THEN 'movistar_sin_verificar'
    WHEN resultado <> 'NUMERO_ERRADO'
      AND (obs LIKE '%equivocad%' OR obs LIKE '%numero errado%' OR obs LIKE '%no es el%' OR obs LIKE '%otra persona%' OR obs LIKE '%no conoce%')
      THEN 'numero_errado_sin_marcar'
    WHEN resultado = 'SIN_RESPUESTA'
      AND (obs LIKE '%llamar manana%' OR obs LIKE '%llame manana%' OR obs LIKE '%llamar mas tarde%' OR obs LIKE '%llamar a las%' OR obs LIKE '%volver a llamar%' OR obs LIKE '%manana%' OR obs LIKE '%agend%' OR obs LIKE '%cita%')
      THEN 'agenda_sin_fecha'
    WHEN resultado = 'SIN_RESPUESTA'
      AND (obs LIKE '%interesad%' OR obs LIKE '%quiere%' OR obs LIKE '%acept%' OR obs LIKE '%dijo%' OR obs LIKE '%me dice%' OR obs LIKE '%pide%' OR obs LIKE '%cotiz%' OR obs LIKE '%le explique%' OR obs LIKE '%conversamos%' OR obs LIKE '%hable con%' OR obs LIKE '%hablamos%')
      THEN 'contacto_como_no_contesta'
    WHEN resultado = 'RECHAZA'
      AND (obs LIKE '%huella%' OR obs LIKE '%deuda%' OR obs LIKE '%no puede%' OR obs LIKE '%sistema%' OR obs LIKE '%problema%' OR obs LIKE '%error%' OR obs LIKE '%no procede%')
      THEN 'impedimento_como_rechazo'
    WHEN resultado = 'RECHAZA'
      AND obs NOT LIKE '%no quiere%' AND obs NOT LIKE '%no le interesa%' AND obs NOT LIKE '%no acepta%'
      AND (obs LIKE '%interesad%' OR obs LIKE '%quiere%' OR obs LIKE '%acept%' OR obs LIKE '%le gusto%' OR obs LIKE '%cotiz%')
      THEN 'interes_como_rechazo'
  END AS discrepancia
FROM intentos i;

-- 1. Cuántas por tipo (últimos 30 días).
SELECT discrepancia, COUNT(*) AS intentos
FROM tipificaciones_discrepantes
WHERE discrepancia IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;

-- 2. Detalle para revisar caso por caso.
SELECT
  to_char(t.created_at AT TIME ZONE 'America/Lima', 'DD/MM HH24:MI') AS registrada_lima,
  u.name                                                              AS asesor,
  rc.holder_name                                                      AS cliente,
  t.resultado,
  t.discrepancia,
  t.observation
FROM tipificaciones_discrepantes t
JOIN recovery_cases rc ON rc.id = t.case_id
JOIN users u ON u.id = t.actor_user_id
WHERE t.discrepancia IS NOT NULL
ORDER BY t.created_at DESC;
