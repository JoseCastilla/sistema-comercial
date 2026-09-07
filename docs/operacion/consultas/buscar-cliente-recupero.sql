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

-- ---------------------------------------------------------------------------
-- ¿Qué archivo cerró esos casos? (BR-018/BR-018c)
--
-- El cruce acepta dos formatos. El **completo** trae numero, receptor,
-- cedente, fecha_de_la_ventana y estado, y decide fila por fila. El
-- **rápido** es una lista de números y se interpreta entera como «estos ya
-- están en Movistar»: cada fila entra como PORTADO hacia Movistar y cierra
-- su caso. Si `kind` dice QUICK, el cierre no vino del reporte de
-- portabilidad sino de una lista de números.
-- ---------------------------------------------------------------------------

-- 8. Los cruces aplicados ese día, con su formato y lo que cerraron
select b.uploaded_at at time zone 'America/Lima' as subido_el,
       b.kind          as formato,
       b.file_name     as archivo,
       b.total_rows    as filas,
       b.matched_services  as lineas_encontradas,
       b.discarded_services as lineas_descartadas,
       b.discarded_cases    as casos_cerrados,
       u.name          as subido_por,
       b.id            as batch_id
from recovery_portability_batches b
join users u on u.id = b.uploaded_by_user_id
where b.uploaded_at at time zone 'America/Lima' >= timestamp '2026-09-06 00:00'
order by b.uploaded_at desc;

-- 9. Qué dijo el cruce exactamente sobre una línea concreta. En un reporte
--    completo, receptor y cedente vienen del archivo; en uno rápido el
--    sistema los inventa (receptor = MOVISTAR) porque el formato lo asume.
select r.service_number   as linea,
       b.kind             as formato,
       b.file_name        as archivo,
       r.state            as estado_leido,
       r.receiver_raw     as receptor,
       r.cedent_raw       as cedente,
       r.window_date      as ventana,
       r.is_movistar_receiver as tomado_como_movistar,
       r.matched_case     as cruzo_con_un_caso,
       r.raw_data         as fila_original
from recovery_portability_results r
join recovery_portability_batches b on b.id = r.batch_id
where r.service_number in ('937182102', '912068229')
order by r.created_at desc;

-- 10. De lo que cerró un cruce rápido, ¿qué dice el reporte completo?
--     El cruce solo toca casos abiertos, así que un reporte real subido
--     después ya no corrige lo que el rápido cerró. Esta consulta separa los
--     cierres correctos de los equivocados y los que hay que reconsultar.
with cierre as (
  select c.id, s.service_number
  from recovery_cases c
  join recovery_case_services s on s.case_id = c.id
  where c.resolved_at at time zone 'America/Lima'
        between timestamp '2026-09-06 08:40' and timestamp '2026-09-06 09:40'
),
verdad as (
  select distinct on (r.service_number)
         r.service_number, r.is_movistar_receiver, r.receiver_raw
  from recovery_portability_results r
  join recovery_portability_batches b on b.id = r.batch_id
  where b.kind = 'FULL'
  order by r.service_number, r.created_at desc
)
select case
         when v.service_number is null then 'sin reporte real: hay que reconsultar'
         when v.is_movistar_receiver  then 'sí es Movistar: el cierre fue correcto'
         else 'sigue en otro operador: cerrado por error'
       end                       as veredicto,
       count(distinct cierre.id) as casos
from cierre
left join verdad v on v.service_number = cierre.service_number
group by 1
order by casos desc;
