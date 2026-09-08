-- SPEC-048 §2.2 — ¿Las citas acordadas se guardan cinco horas antes?
--
-- El formulario envía la hora sin zona y el servidor la interpreta en la zona
-- del proceso. Si el contenedor corre en UTC, una cita a las 10:00 de Lima
-- queda como 05:00 de Lima. Esta consulta reparte por hora de Lima las citas
-- registradas con resultado AGENDA: si se concentran entre las 03:00 y las
-- 09:00 (horas en que nadie acuerda una llamada), el defecto está confirmado.
-- Solo lectura.

-- 1. Distribución por hora de Lima de la hora acordada.
SELECT
  EXTRACT(HOUR FROM a.next_action_at AT TIME ZONE 'America/Lima')::int AS hora_lima,
  COUNT(*)                                                             AS citas
FROM recovery_case_attempts a
WHERE a.result = 'AGENDA'
  AND a.next_action_at IS NOT NULL
GROUP BY 1
ORDER BY 1;

-- 2. Citas vigentes (BR-007: caso SCHEDULED, último intento AGENDA, misma
--    próxima acción). Es la población que el relleno inicial convertiría en
--    citas PENDING; las de hora sospechosa (00:00–08:00 Lima) van a José.
WITH ultimo AS (
  SELECT DISTINCT ON (a.case_id)
    a.case_id, a.id AS attempt_id, a.result, a.next_action_at, a.actor_user_id, a.created_at
  FROM recovery_case_attempts a
  ORDER BY a.case_id, a.created_at DESC
)
SELECT
  c.id                                                    AS caso,
  c.holder_name                                           AS cliente,
  u.name                                                  AS asesor,
  to_char(c.next_action_at AT TIME ZONE 'America/Lima', 'DD/MM HH24:MI') AS acordada_lima,
  CASE WHEN EXTRACT(HOUR FROM c.next_action_at AT TIME ZONE 'America/Lima') < 8
       THEN 'sospechosa' ELSE 'normal' END                AS hora,
  to_char(l.created_at AT TIME ZONE 'America/Lima', 'DD/MM HH24:MI')     AS registrada_lima
FROM recovery_cases c
JOIN ultimo l ON l.case_id = c.id
LEFT JOIN users u ON u.id = c.assigned_user_id
WHERE c.source = 'NATIONAL_BASE'
  AND c.status = 'SCHEDULED'
  AND l.result = 'AGENDA'
  AND l.next_action_at IS NOT NULL
  AND l.next_action_at = c.next_action_at
ORDER BY hora DESC, c.next_action_at;
