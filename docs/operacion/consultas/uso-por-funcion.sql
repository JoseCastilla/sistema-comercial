-- Uso real por función — auditoría del 13/11/2026
-- (docs/revisiones/2026-11-13-auditoria-recupero-y-seguimiento.md)
--
-- Solo lectura. Cada consulta es autónoma: DbGate separa sentencias, así que
-- se pueden correr una por una. Las horas salen en hora de Lima.
-- Nombres contrastados con packages/database/prisma/schema/*.prisma el 13/11.
--
-- Límite: el sistema no registra aperturas de pantalla ni último ingreso.
-- Estas consultas miden lo que la gente HIZO (gestiones, cambios, cargas),
-- no lo que miró. «Sesiones» es un piso: la fila puede borrarse al salir.

-- 1. Uso por función: últimos 30 días, total histórico y última vez
SELECT funcion, ultimos_30_dias, total, (ultima_vez AT TIME ZONE 'America/Lima') AS ultima_vez_lima FROM (
  SELECT '01 Recupero de ventas: gestiones' AS funcion, count(*) FILTER (WHERE a.created_at >= now() - interval '30 days') AS ultimos_30_dias, count(*) AS total, max(a.created_at) AS ultima_vez
    FROM recovery_case_attempts a JOIN recovery_cases c ON c.id = a.case_id WHERE c.source::text IN ('INTERNAL_ORDER_STATE','MANUAL')
  UNION ALL SELECT '02 Campañas: gestiones', count(*) FILTER (WHERE a.created_at >= now() - interval '30 days'), count(*), max(a.created_at)
    FROM recovery_case_attempts a JOIN recovery_cases c ON c.id = a.case_id WHERE c.source::text = 'NATIONAL_BASE'
  UNION ALL SELECT '03 Agenda: citas creadas', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM recovery_case_commitments
  UNION ALL SELECT '04 Agenda: citas cumplidas', count(*) FILTER (WHERE closed_at >= now() - interval '30 days'), count(*), max(closed_at) FROM recovery_case_commitments WHERE status::text = 'DONE'
  UNION ALL SELECT '05 Rectificaciones de gestión', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM recovery_case_attempt_corrections
  UNION ALL SELECT '06 Campañas: bases confirmadas', count(*) FILTER (WHERE confirmed_at >= now() - interval '30 days'), count(*), max(confirmed_at) FROM recovery_base_batches WHERE status::text = 'CONFIRMED'
  UNION ALL SELECT '07 Campañas: cruces de portabilidad', count(*) FILTER (WHERE uploaded_at >= now() - interval '30 days'), count(*), max(uploaded_at) FROM recovery_portability_batches WHERE status::text = 'APPLIED'
  UNION ALL SELECT '08 Campañas: revisión manual', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM recovery_case_events WHERE actor_user_id IS NOT NULL AND type::text IN ('TRIAGE_RELEASED','TRIAGE_WAITING','CASE_DISCARDED','MANUAL_INCLUSION')
  UNION ALL SELECT '09 Casos asignados a persona (reparto o toma)', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM recovery_case_events WHERE actor_user_id IS NOT NULL AND type::text = 'ASSIGNED_TO_USER'
  UNION ALL SELECT '10 Casos recuperados (ambos carriles)', count(*) FILTER (WHERE resolved_at >= now() - interval '30 days'), count(*), max(resolved_at) FROM recovery_cases WHERE status::text = 'RECOVERED'
  UNION ALL SELECT '11 Importador DITO: cargas confirmadas', count(*) FILTER (WHERE confirmed_at >= now() - interval '30 days'), count(*), max(confirmed_at) FROM dito_import_batches WHERE status::text = 'CONFIRMED'
  UNION ALL SELECT '12 Importador DITO: archivos subidos', count(*) FILTER (WHERE uploaded_at >= now() - interval '30 days'), count(*), max(uploaded_at) FROM dito_import_batches
  UNION ALL SELECT '13 Ventas DITO recibidas', count(*) FILTER (WHERE received_at >= now() - interval '30 days'), count(*), max(received_at) FROM dito_orders
  UNION ALL SELECT '14 Ventas con identidad de extensión', count(*) FILTER (WHERE received_at >= now() - interval '30 days'), count(*), max(received_at) FROM dito_orders WHERE submitter_installation_id IS NOT NULL
  UNION ALL SELECT '15 Pedidos: cambios de estado manuales', count(*) FILTER (WHERE changed_at >= now() - interval '30 days'), count(*), max(changed_at) FROM dito_order_status_history
  UNION ALL SELECT '16 Pedidos: cierres', count(*) FILTER (WHERE closed_at >= now() - interval '30 days'), count(*), max(closed_at) FROM dito_orders WHERE closed_at IS NOT NULL
  UNION ALL SELECT '17 Pedidos: correcciones manuales', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM dito_order_corrections WHERE source::text = 'MANUAL_ADMIN'
  UNION ALL SELECT '18 Pedidos: solicitudes de anulación', count(*) FILTER (WHERE requested_at >= now() - interval '30 days'), count(*), max(requested_at) FROM dito_order_cancellation_requests
  UNION ALL SELECT '19 Pedidos: reasignaciones de asesor', count(*) FILTER (WHERE performed_at >= now() - interval '30 days'), count(*), max(performed_at) FROM dito_order_assignment_history WHERE performed_by_user_id IS NOT NULL
  UNION ALL SELECT '20 Pedidos: solicitudes de asignación', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM dito_order_assignment_requests
  UNION ALL SELECT '21 Pedidos: origen de venta marcado', count(*) FILTER (WHERE sale_origin_set_at >= now() - interval '30 days'), count(*), max(sale_origin_set_at) FROM dito_orders WHERE sale_origin_set_at IS NOT NULL
  UNION ALL SELECT '22 Pedidos: vinculaciones', count(*) FILTER (WHERE performed_at >= now() - interval '30 days'), count(*), max(performed_at) FROM dito_order_link_history
  UNION ALL SELECT '23 Escalaciones creadas', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM delivery_escalations
  UNION ALL SELECT '24 Escalaciones resueltas', count(*) FILTER (WHERE resolved_at >= now() - interval '30 days'), count(*), max(resolved_at) FROM delivery_escalations WHERE resolved_at IS NOT NULL
  UNION ALL SELECT '25 Consulta DNI: consultas', count(*) FILTER (WHERE queried_at >= now() - interval '30 days'), count(*), max(queried_at) FROM dni_lookup_events
  UNION ALL SELECT '26 Consulta DNI: con crédito (API)', count(*) FILTER (WHERE queried_at >= now() - interval '30 days'), count(*), max(queried_at) FROM dni_lookup_events WHERE source::text = 'API'
  UNION ALL SELECT '27 Cuotas asignadas', count(*) FILTER (WHERE assigned_at >= now() - interval '30 days'), count(*), max(assigned_at) FROM performance_quotas
  UNION ALL SELECT '28 Máximo: corridas', count(*) FILTER (WHERE started_at >= now() - interval '30 days'), count(*), max(started_at) FROM agr_delivery_sync_runs
  UNION ALL SELECT '29 Máximo: corridas manuales', count(*) FILTER (WHERE started_at >= now() - interval '30 days'), count(*), max(started_at) FROM agr_delivery_sync_runs WHERE "trigger"::text = 'MANUAL'
  UNION ALL SELECT '30 Máximo: corridas fallidas', count(*) FILTER (WHERE started_at >= now() - interval '30 days'), count(*), max(started_at) FROM agr_delivery_sync_runs WHERE status::text = 'FAILED'
  UNION ALL SELECT '31 Personas: baja/reingreso/promoción', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM person_lifecycle_events
  UNION ALL SELECT '32 Equipos: cambios', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM commercial_team_audit_logs
  UNION ALL SELECT '33 Webhooks GHL recibidos', count(*) FILTER (WHERE received_at >= now() - interval '30 days'), count(*), max(received_at) FROM webhook_events
  UNION ALL SELECT '34 Sesiones iniciadas (piso)', count(*) FILTER (WHERE created_at >= now() - interval '30 days'), count(*), max(created_at) FROM auth_sessions
) t ORDER BY funcion;

-- 2. Gestiones por persona, día y carril (últimos 30 días)
SELECT (a.created_at AT TIME ZONE 'America/Lima')::date AS dia, u.name AS persona, om.role::text AS rol,
       CASE WHEN c.source::text = 'NATIONAL_BASE' THEN 'Campañas' ELSE 'Recupero de ventas' END AS carril,
       count(*) AS gestiones, count(DISTINCT a.case_id) AS casos
FROM recovery_case_attempts a
JOIN recovery_cases c ON c.id = a.case_id
JOIN users u ON u.id = a.actor_user_id
LEFT JOIN organization_members om ON om.user_id = a.actor_user_id AND om.organization_id = a.organization_id
WHERE a.created_at >= now() - interval '30 days'
GROUP BY 1, 2, 3, 4 ORDER BY 1 DESC, 2, 4;

-- 3. Por persona activa: última actividad de sesión y uso por función (30 días)
SELECT u.name AS persona, om.role::text AS rol, u.status::text AS estado,
  (SELECT max(s.updated_at) FROM auth_sessions s WHERE s.user_id = u.id) AT TIME ZONE 'America/Lima' AS ultima_actividad_sesion,
  (SELECT count(*) FROM recovery_case_attempts a JOIN recovery_cases c ON c.id = a.case_id WHERE a.actor_user_id = u.id AND c.source::text <> 'NATIONAL_BASE' AND a.created_at >= now() - interval '30 days') AS gestiones_recupero,
  (SELECT count(*) FROM recovery_case_attempts a JOIN recovery_cases c ON c.id = a.case_id WHERE a.actor_user_id = u.id AND c.source::text = 'NATIONAL_BASE' AND a.created_at >= now() - interval '30 days') AS gestiones_campanas,
  (SELECT count(*) FROM recovery_case_commitments k WHERE k.created_by_user_id = u.id AND k.created_at >= now() - interval '30 days') AS citas_creadas,
  (SELECT count(*) FROM dni_lookup_events d WHERE d.actor_user_id = u.id AND d.queried_at >= now() - interval '30 days') AS consultas_dni,
  (SELECT count(*) FROM delivery_escalations e WHERE e.created_by_user_id = u.id AND e.created_at >= now() - interval '30 days') AS escalaciones,
  (SELECT count(*) FROM dito_order_status_history h WHERE h.changed_by_user_id = u.id AND h.changed_at >= now() - interval '30 days') AS cambios_estado_pedido,
  (SELECT count(*) FROM dito_orders o WHERE o.agent_user_id = u.id AND o.received_at >= now() - interval '30 days') AS ventas_recibidas
FROM users u
JOIN organization_members om ON om.user_id = u.id
WHERE u.status::text <> 'DISABLED'
ORDER BY om.role::text, u.name;

-- 4. Cartera de Campañas asignada y detenida, por asesor
SELECT u.name AS asesor, count(*) AS casos_asignados,
  count(*) FILTER (WHERE la.ultimo IS NULL) AS sin_ningun_intento,
  count(*) FILTER (WHERE la.ultimo < now() - interval '7 days') AS ultimo_intento_hace_mas_de_7_dias,
  max(la.ultimo) AT TIME ZONE 'America/Lima' AS ultimo_intento_lima
FROM recovery_cases c
JOIN users u ON u.id = c.assigned_user_id
LEFT JOIN LATERAL (SELECT max(a.created_at) AS ultimo FROM recovery_case_attempts a WHERE a.case_id = c.id) la ON true
WHERE c.source::text = 'NATIONAL_BASE' AND c.status::text IN ('ASSIGNED','IN_PROGRESS','SCHEDULED')
GROUP BY u.name ORDER BY casos_asignados DESC;

-- 5. Recupero de ventas abierto: cuántos nunca se gestionaron
SELECT c.status::text AS estado, count(*) AS casos,
  count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM recovery_case_attempts a WHERE a.case_id = c.id)) AS sin_gestion,
  min(c.created_at) AT TIME ZONE 'America/Lima' AS mas_antiguo
FROM recovery_cases c
WHERE c.source::text IN ('INTERNAL_ORDER_STATE','MANUAL') AND c.resolved_at IS NULL
GROUP BY 1 ORDER BY 2 DESC;

-- 6. Personas distintas con sesión iniciada por día y rol (piso, 30 días)
SELECT (s.created_at AT TIME ZONE 'America/Lima')::date AS dia, om.role::text AS rol, count(DISTINCT s.user_id) AS personas
FROM auth_sessions s JOIN organization_members om ON om.user_id = s.user_id
WHERE s.created_at >= now() - interval '30 days'
GROUP BY 1, 2 ORDER BY 1 DESC, 2;

-- 7. Cuotas por período y destinatario
SELECT period_key, "window"::text AS ventana,
  count(*) FILTER (WHERE team_id IS NOT NULL) AS de_equipo,
  count(*) FILTER (WHERE user_id IS NOT NULL) AS de_asesor,
  count(*) FILTER (WHERE team_id IS NULL AND user_id IS NULL) AS de_organizacion
FROM performance_quotas GROUP BY 1, 2 ORDER BY 1 DESC;

-- 8. Últimas 20 corridas de Máximo
SELECT started_at AT TIME ZONE 'America/Lima' AS inicio, "trigger"::text AS disparo, status::text AS estado,
  candidate_orders, consulted_orders, found_orders, changed_orders, error_orders, error_message
FROM agr_delivery_sync_runs ORDER BY started_at DESC LIMIT 20;
