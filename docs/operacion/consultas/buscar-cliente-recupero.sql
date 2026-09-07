-- Buscar un cliente de Campañas por un dato suelto (teléfono, línea o DNI)
-- cuando no aparece en ninguna bandeja. Solo lecturas: seguro en producción.
--
-- Uso en DbGate: reemplazar 937182102 por el dato en las cuatro consultas y
-- ejecutarlas en orden. La 1 dice si el sistema conoce el número y en qué
-- tabla; la 2, el estado del caso; la 3, su historial; la 4, sus intentos.

-- 1. ¿Dónde aparece el número? (teléfono de contacto, línea, intento, base
--    cargada tal cual llegó en el archivo)
select 'telefono_del_caso' as origen, p.case_id, p.kind::text as detalle, p.created_at
from recovery_case_phones p
where p.phone_number like '%937182102%'
union all
select 'linea_del_caso', s.case_id,
       coalesce(s.plan_raw, '') || case when s.discarded_at is null then '' else ' · descartada' end,
       s.created_at
from recovery_case_services s
where s.service_number like '%937182102%'
union all
select 'intento_con_ese_numero', a.case_id, a.result::text, a.created_at
from recovery_case_attempts a
where a.phone_used like '%937182102%'
union all
select 'fila_de_base_cargada', r.case_id,
       r.classification::text || ' / ' || r.application_status::text
         || coalesce(' · ' || r.failure_reason, ''),
       r.created_at
from recovery_base_records r
where r.contact_phone like '%937182102%'
   or r.service_number like '%937182102%'
   or r.raw_data::text like '%937182102%'
order by created_at desc;

-- 2. Estado del caso (o casos) que tienen ese número
with casos as (
  select case_id from recovery_case_phones where phone_number like '%937182102%'
  union
  select case_id from recovery_case_services where service_number like '%937182102%'
  union
  select case_id from recovery_case_attempts where phone_used like '%937182102%'
  union
  select case_id from recovery_base_records
   where case_id is not null
     and (contact_phone like '%937182102%' or service_number like '%937182102%')
)
select c.id,
       c.status,
       c.source,
       c.holder_name,
       c.document_number,
       u.name  as asesor,
       t.name  as equipo,
       c.claimed_at    at time zone 'America/Lima' as asignado_el,
       c.next_action_at at time zone 'America/Lima' as proxima_accion,
       c.resolved_at   at time zone 'America/Lima' as resuelto_el,
       c.loss_reason,
       c.discard_reason,
       c.updated_at    at time zone 'America/Lima' as ultimo_cambio
from recovery_cases c
left join users u on u.id = c.assigned_user_id
left join commercial_teams t on t.id = c.assigned_team_id
where c.id in (select case_id from casos)
order by c.updated_at desc;

-- 3. Historial del caso: quién lo movió, cuándo y por qué
with casos as (
  select case_id from recovery_case_phones where phone_number like '%937182102%'
  union
  select case_id from recovery_case_services where service_number like '%937182102%'
)
select e.created_at at time zone 'America/Lima' as fecha,
       e.case_id,
       e.type,
       e.previous_status,
       e.new_status,
       coalesce(ua.name, 'sistema') as actor,
       e.observation,
       e.metadata
from recovery_case_events e
left join users ua on ua.id = e.actor_user_id
where e.case_id in (select case_id from casos)
order by e.created_at;

-- 4. Intentos registrados sobre el caso (agenda, rechazo, sin respuesta…)
with casos as (
  select case_id from recovery_case_phones where phone_number like '%937182102%'
  union
  select case_id from recovery_case_services where service_number like '%937182102%'
)
select a.created_at at time zone 'America/Lima' as fecha,
       a.case_id,
       u.name as asesor,
       a.channel,
       a.result,
       a.phone_used,
       a.next_action_at at time zone 'America/Lima' as agendado_para,
       a.observation
from recovery_case_attempts a
join users u on u.id = a.actor_user_id
where a.case_id in (select case_id from casos)
order by a.created_at;

-- 5. Por si el número es de una venta (Pedidos) y no de Campañas
select o.order_code_raw, o.status, o.delivery_status,
       o.registered_at at time zone 'America/Lima' as ingresada,
       o.holder_full_name_raw, o.service_number, o.delivery_contact_phone,
       u.name as asesor
from dito_orders o
left join users u on u.id = o.agent_user_id
where o.delivery_contact_phone like '%937182102%'
   or o.service_number like '%937182102%'
order by o.registered_at desc;

-- ---------------------------------------------------------------------------
-- Alcance de un cierre automático (BR-059)
--
-- Cuando el cruce del reporte de portabilidad encuentra líneas ya portadas a
-- Movistar, cierra los casos en la misma pasada: todos comparten el instante
-- de `resolved_at`. Estas dos consultas dicen a cuántos alcanzó y cuáles
-- tenían agenda, que es lo que el equipo nota como «desapareció el cliente».
-- Ajustar la ventana de 5 minutos al momento del cierre que se investiga.
-- ---------------------------------------------------------------------------

-- 6. Cuántos casos cerró esa pasada, por asesor y por el estado que tenían
select e.previous_status as estado_antes,
       c.status         as quedo_como,
       t.name           as equipo,
       u.name           as asesor,
       count(*)         as casos
from recovery_cases c
join recovery_case_events e
  on e.case_id = c.id
 and e.type in ('CASE_RESOLVED', 'CASE_DISCARDED')
left join users u on u.id = c.assigned_user_id
left join commercial_teams t on t.id = c.assigned_team_id
where c.resolved_at at time zone 'America/Lima'
      between timestamp '2026-09-06 09:30' and timestamp '2026-09-06 09:35'
group by 1, 2, 3, 4
order by casos desc;

-- 7. Las agendas que se perdieron con ese cierre. El caso ya no conserva su
--    próxima acción (la regla la borra), pero el intento sí: es inmutable.
select c.holder_name                             as cliente,
       c.document_number                          as dni,
       u.name                                     as asesor,
       a.created_at    at time zone 'America/Lima' as ultimo_intento,
       a.result                                   as tipificacion,
       a.next_action_at at time zone 'America/Lima' as agenda_que_se_perdio,
       c.id                                       as case_id
from recovery_cases c
join users u on u.id = c.assigned_user_id
join recovery_case_attempts a on a.case_id = c.id
where c.resolved_at at time zone 'America/Lima'
      between timestamp '2026-09-06 09:30' and timestamp '2026-09-06 09:35'
  and a.next_action_at is not null
order by agenda_que_se_perdio;
