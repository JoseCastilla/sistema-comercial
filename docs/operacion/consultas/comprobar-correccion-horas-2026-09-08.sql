-- SPEC-048 fase 0 — ¿Se aplicó la corrección de horas? Solo lectura.
--
-- La primera ejecución del script de corrección (08/09/2026) mostró el enum
-- sin NEXT_ACTION_CORRECTED (la migración aún no había corrido), 29 citas a
-- corregir en vez de 30, y 12 citas todavía a las 04:00 después de «correr».
-- Todo apunta a que la transacción se anuló en el INSERT de eventos. Esta
-- consulta lo confirma o lo desmiente.

-- 1. ¿Existe ya el tipo de evento? Debe devolver una fila.
SELECT unnest(enum_range(NULL::"RecoveryCaseEventType"))::text AS tipo
WHERE unnest(enum_range(NULL::"RecoveryCaseEventType"))::text = 'NEXT_ACTION_CORRECTED';

-- 2. ¿Cuántos eventos de corrección hay? Si la corrección entró, 29 o 30;
--    si no entró, 0.
SELECT COUNT(*) AS eventos_de_correccion
FROM recovery_case_events
WHERE type::text = 'NEXT_ACTION_CORRECTED';

-- 3. Citas vigentes por hora de Lima. Corregidas: nada antes de las 08:00.
SELECT
  EXTRACT(HOUR FROM c.next_action_at AT TIME ZONE 'America/Lima')::int AS hora_lima,
  COUNT(*) AS citas
FROM recovery_cases c
JOIN LATERAL (
  SELECT result, next_action_at
  FROM recovery_case_attempts
  WHERE case_id = c.id
  ORDER BY created_at DESC
  LIMIT 1
) a ON TRUE
WHERE c.source = 'NATIONAL_BASE'
  AND c.status = 'SCHEDULED'
  AND a.result = 'AGENDA'
  AND a.next_action_at = c.next_action_at
GROUP BY 1
ORDER BY 1;

-- 4. Última cita registrada y su hora: sirve para fijar el corte real.
--    Una acordada antes de las 08:00 de Lima se registró con el código viejo.
SELECT
  a.created_at                                  AS registrada_utc,
  a.created_at AT TIME ZONE 'America/Lima'      AS registrada_lima,
  a.next_action_at AT TIME ZONE 'America/Lima'  AS acordada_lima,
  c.holder_name                                 AS cliente
FROM recovery_case_attempts a
JOIN recovery_cases c ON c.id = a.case_id
WHERE a.result = 'AGENDA'
ORDER BY a.created_at DESC
LIMIT 5;
