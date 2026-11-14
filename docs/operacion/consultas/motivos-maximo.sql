-- Motivos que reporta Máximo y qué pasó después — 13/11/2026
--
-- Para decidir dónde hay oportunidad real de recupero sin guiarse solo por lo
-- que anota el motorizado. Solo lectura. Cada consulta es autónoma (DbGate
-- separa sentencias). Nombres contrastados con
-- packages/database/prisma/schema/agr-delivery.prisma y dito.prisma.
--
-- Límite: la foto de Máximo guarda el ÚLTIMO estado de cada venta, y las
-- ventas de meses anteriores ya no se reconsultan (SPEC-087), así que su
-- motivo es el que tenían la última vez que se miraron.

-- 1. Catálogo completo: estado × motivo × submotivo, con cuántas ventas
SELECT s.estado_pedido AS estado,
       coalesce(s.motivo_rechazo, '(sin motivo)') AS motivo,
       coalesce(s.submotivo_rechazo, '(sin submotivo)') AS submotivo,
       count(*) AS ventas,
       count(*) FILTER (WHERE o.registered_at >= date_trunc('month', now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima') AS ventas_de_este_mes,
       (min(o.registered_at) AT TIME ZONE 'America/Lima')::date AS primera_venta,
       (max(o.registered_at) AT TIME ZONE 'America/Lima')::date AS ultima_venta
FROM agr_delivery_order_snapshots s
JOIN dito_orders o ON o.id = s.dito_order_id
WHERE s.estado_pedido NOT IN ('ENTREGADO', 'CERRADO', 'AGENDADO')
GROUP BY 1, 2, 3
ORDER BY ventas DESC;

-- 2. Reingreso: de las ventas que cayeron por cada motivo, cuántas tuvieron
--    después otra venta del mismo titular (mismo documento) y cuántas de esas
--    se entregaron. Es la tasa de recupero REAL por motivo, la haya registrado
--    alguien o no.
--    Cuidado al leerla: «otra venta posterior del mismo documento» también
--    cuenta una segunda línea del mismo cliente; es un techo, no un conteo
--    exacto de reingresos.
SELECT s.estado_pedido AS estado,
       coalesce(s.motivo_rechazo, '(sin motivo)') AS motivo,
       coalesce(s.submotivo_rechazo, '(sin submotivo)') AS submotivo,
       count(*) AS ventas_caidas,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM dito_orders o2
         WHERE o2.organization_id = o.organization_id
           AND o2.holder_document_number = o.holder_document_number
           AND o2.id <> o.id
           AND o2.registered_at > o.registered_at
       )) AS con_venta_posterior,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM dito_orders o2
         LEFT JOIN agr_delivery_order_snapshots s2 ON s2.dito_order_id = o2.id
         WHERE o2.organization_id = o.organization_id
           AND o2.holder_document_number = o.holder_document_number
           AND o2.id <> o.id
           AND o2.registered_at > o.registered_at
           AND (o2.delivered_at IS NOT NULL OR s2.estado_pedido IN ('ENTREGADO', 'CERRADO'))
       )) AS venta_posterior_entregada,
       round(100.0 * count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM dito_orders o2
         LEFT JOIN agr_delivery_order_snapshots s2 ON s2.dito_order_id = o2.id
         WHERE o2.organization_id = o.organization_id
           AND o2.holder_document_number = o.holder_document_number
           AND o2.id <> o.id
           AND o2.registered_at > o.registered_at
           AND (o2.delivered_at IS NOT NULL OR s2.estado_pedido IN ('ENTREGADO', 'CERRADO'))
       )) / count(*), 1) AS porcentaje_recuperado
FROM agr_delivery_order_snapshots s
JOIN dito_orders o ON o.id = s.dito_order_id
WHERE s.estado_pedido IN ('RECHAZADO', 'CANCELADO', 'NO ENTREGADO')
GROUP BY 1, 2, 3
ORDER BY ventas_caidas DESC;

-- 3. Reagendamiento: de las ventas que pasaron por NO ENTREGADO con cada
--    motivo, cómo terminaron (entregada, rechazada, cancelada o siguen ahí).
--    Solo cubre ventas cuyo cambio de estado alcanzó a verse en una consulta
--    y solo desde que el sistema guarda el historial de Máximo.
SELECT coalesce(h.motivo_rechazo, '(sin motivo)') AS motivo_del_no_entregado,
       coalesce(h.submotivo_rechazo, '(sin submotivo)') AS submotivo,
       count(DISTINCT s.id) AS ventas,
       count(DISTINCT s.id) FILTER (WHERE s.estado_pedido IN ('ENTREGADO', 'CERRADO')) AS terminaron_entregadas,
       count(DISTINCT s.id) FILTER (WHERE s.estado_pedido = 'RECHAZADO') AS terminaron_rechazadas,
       count(DISTINCT s.id) FILTER (WHERE s.estado_pedido = 'CANCELADO') AS terminaron_canceladas,
       count(DISTINCT s.id) FILTER (WHERE s.estado_pedido = 'NO ENTREGADO') AS siguen_no_entregadas
FROM agr_delivery_order_history h
JOIN agr_delivery_order_snapshots s ON s.id = h.agr_delivery_order_snapshot_id
WHERE h.estado_pedido = 'NO ENTREGADO'
GROUP BY 1, 2
ORDER BY ventas DESC;
