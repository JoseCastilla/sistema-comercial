-- Cómo llegan las respuestas de Máximo — auditoría del 13/11/2026
--
-- Máximo devuelve, por cada pedido, la lista de eventos con su fecha, motivo,
-- submotivo, usuario que lo registró, tiempo, distancia y comentario. El
-- sistema la guarda en raw_payload->'historial' de la foto y la ficha del
-- pedido la oculta. Estas consultas la abren. Solo lectura; cada una es
-- autónoma (DbGate separa sentencias).
--
-- Solo traen historial las fotos tomadas desde el 23/10/2026 (cambio de
-- fuente); las anteriores conservan la forma vieja y aquí no aparecen.

-- 1. Lo que dijo el motorizado en la visita frente a la etiqueta final.
--    Cada fila: motivo de un evento NO ENTREGADO y cómo terminó ese pedido.
SELECT e->>'motivo' AS motivo_en_la_visita,
       e->>'submotivo' AS submotivo_en_la_visita,
       s.estado_pedido AS estado_final,
       s.motivo_rechazo AS motivo_final,
       s.submotivo_rechazo AS submotivo_final,
       count(*) AS visitas_fallidas,
       count(DISTINCT s.id) AS pedidos
FROM agr_delivery_order_snapshots s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.raw_payload->'historial') = 'array'
       THEN s.raw_payload->'historial' ELSE '[]'::jsonb END) e
WHERE e->>'estado' = 'NO ENTREGADO'
GROUP BY 1, 2, 3, 4, 5
ORDER BY pedidos DESC;

-- 2. Visitas reales antes de cada etiqueta final: cuántos pedidos tienen
--    1, 2, 3 o más eventos NO ENTREGADO según su motivo final.
SELECT s.estado_pedido AS estado_final,
       coalesce(s.motivo_rechazo, '(sin motivo)') AS motivo_final,
       coalesce(s.submotivo_rechazo, '(sin submotivo)') AS submotivo_final,
       (s.raw_payload->>'intentos_no_entregado') AS visitas_fallidas,
       count(*) AS pedidos
FROM agr_delivery_order_snapshots s
WHERE s.estado_pedido IN ('RECHAZADO', 'CANCELADO')
  AND jsonb_typeof(s.raw_payload->'historial') = 'array'
GROUP BY 1, 2, 3, 4
ORDER BY 2, 3, 4;

-- 3. Los eventos tal como llegan: los 200 más recientes con todo lo que
--    Máximo manda y la ficha no muestra (usuario, tiempo, distancia y
--    comentario). Para leer con los ojos qué escribe el motorizado.
SELECT o.order_code_raw AS pedido_dito,
       (o.registered_at AT TIME ZONE 'America/Lima') AS registrada_lima,
       (e->>'seq')::int AS seq,
       e->>'estado' AS estado,
       e->>'fecha' AS fecha_segun_maximo,
       e->>'motivo' AS motivo,
       e->>'submotivo' AS submotivo,
       e->>'usuario' AS usuario,
       e->>'tiempo_hrs' AS tiempo_hrs,
       e->>'distancia' AS distancia,
       e->>'comentario' AS comentario
FROM agr_delivery_order_snapshots s
JOIN dito_orders o ON o.id = s.dito_order_id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.raw_payload->'historial') = 'array'
       THEN s.raw_payload->'historial' ELSE '[]'::jsonb END) e
WHERE s.estado_pedido IN ('RECHAZADO', 'CANCELADO', 'NO ENTREGADO')
ORDER BY o.registered_at DESC, (e->>'seq')::int
LIMIT 200;

-- 4. Quién registra los rechazos y los no entregados: eventos por usuario
--    y estado. Sirve para ver si los cierres los hace el motorizado o una
--    persona de mesa.
SELECT e->>'usuario' AS usuario,
       e->>'estado' AS estado,
       count(*) AS eventos,
       count(DISTINCT s.id) AS pedidos
FROM agr_delivery_order_snapshots s
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.raw_payload->'historial') = 'array'
       THEN s.raw_payload->'historial' ELSE '[]'::jsonb END) e
WHERE e->>'estado' IN ('NO ENTREGADO', 'RECHAZADO', 'PRECANCELADO', 'CANCELADO')
GROUP BY 1, 2
ORDER BY eventos DESC
LIMIT 100;

-- 5. Corridas de los últimos 30 días con errores: una corrida puede cerrar
--    como «Completada» aunque todas sus consultas hayan fallado.
SELECT started_at AT TIME ZONE 'America/Lima' AS inicio,
       "trigger"::text AS disparo, status::text AS estado,
       candidate_orders, consulted_orders, found_orders, changed_orders,
       error_orders, error_message
FROM agr_delivery_sync_runs
WHERE started_at >= now() - interval '30 days'
  AND (error_orders > 0 OR found_orders = 0 OR status::text <> 'COMPLETED')
ORDER BY started_at DESC;

-- 6. Horas programadas que no corrieron: corridas automáticas por día.
--    Deben ser 4 (08, 12, 15 y 18). Menos de 4 es una hora perdida.
SELECT (started_at AT TIME ZONE 'America/Lima')::date AS dia,
       count(*) FILTER (WHERE "trigger"::text = 'SCHEDULED') AS automaticas,
       count(*) FILTER (WHERE "trigger"::text = 'MANUAL') AS manuales,
       string_agg(to_char(started_at AT TIME ZONE 'America/Lima', 'HH24:MI'), ', ' ORDER BY started_at) AS horas
FROM agr_delivery_sync_runs
WHERE started_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;
