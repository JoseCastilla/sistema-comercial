-- Buscar un número en la base de Campañas
--
-- Se escribe el número UNA vez, abajo. Después se ejecutan las consultas en
-- orden: dicen si el número existe, de quién es, cómo está su caso, qué sabe
-- el sistema de su portabilidad, cuándo apareció en las cargas, qué gestión
-- tuvo y qué le pasó. Todo son lecturas.
--
-- Acepta el número completo o un trozo: busca por coincidencia parcial.

create temporary table buscado (numero text);
insert into buscado (numero) values ('937182102');   -- <<< cambiar aquí

-- Los casos que tocan ese número, por cualquiera de sus datos.
create temporary view casos_del_numero as
select distinct case_id
from (
  select s.case_id
  from recovery_case_services s, buscado b
  where s.service_number like '%' || b.numero || '%'
  union all
  select p.case_id
  from recovery_case_phones p, buscado b
  where p.phone_number like '%' || b.numero || '%'
  union all
  select a.case_id
  from recovery_case_attempts a, buscado b
  where a.phone_used like '%' || b.numero || '%'
  union all
  select r.case_id
  from recovery_base_records r, buscado b
  where r.case_id is not null
    and (r.service_number like '%' || b.numero || '%'
      or r.contact_phone like '%' || b.numero || '%')
) t;

-- ---------------------------------------------------------------------------
-- 1. ¿Dónde aparece? Línea del caso, teléfono de contacto, intento de gestión
--    o fila de una base cargada. Si esto sale vacío, el número no existe.
-- ---------------------------------------------------------------------------
select 'linea del caso' as donde,
       s.case_id,
       s.service_number as valor,
       s.created_at at time zone 'America/Lima' as desde
from recovery_case_services s, buscado b
where s.service_number like '%' || b.numero || '%'
union all
select 'telefono de contacto',
       p.case_id,
       p.phone_number,
       p.created_at at time zone 'America/Lima'
from recovery_case_phones p, buscado b
where p.phone_number like '%' || b.numero || '%'
union all
select 'usado en un intento',
       a.case_id,
       a.phone_used,
       a.created_at at time zone 'America/Lima'
from recovery_case_attempts a, buscado b
where a.phone_used like '%' || b.numero || '%'
union all
select 'fila de base cargada',
       r.case_id,
       coalesce(r.service_number, r.contact_phone),
       r.created_at at time zone 'America/Lima'
from recovery_base_records r, buscado b
where r.service_number like '%' || b.numero || '%'
   or r.contact_phone like '%' || b.numero || '%'
order by desde desc;

-- ---------------------------------------------------------------------------
-- 2. El cliente y su caso
-- ---------------------------------------------------------------------------
select c.id              as case_id,
       c.holder_name     as cliente,
       c.document_number as dni,
       c.status          as estado,
       c.source          as origen,
       t.name            as equipo,
       u.name            as asesor,
       c.department, c.province, c.district,
       c.claimed_at       at time zone 'America/Lima' as asignado_el,
       c.next_action_at   at time zone 'America/Lima' as proxima_accion,
       c.first_contact_at at time zone 'America/Lima' as primer_contacto,
       c.last_sighting_at at time zone 'America/Lima' as visto_por_ultima_vez,
       c.resolved_at      at time zone 'America/Lima' as resuelto_el,
       c.loss_reason      as motivo_de_perdida,
       c.discard_reason   as motivo_de_descarte
from recovery_cases c
left join users u on u.id = c.assigned_user_id
left join commercial_teams t on t.id = c.assigned_team_id
where c.id in (select case_id from casos_del_numero)
order by c.updated_at desc;

-- ---------------------------------------------------------------------------
-- 3. Las líneas del cliente y lo que se sabe de su portabilidad
-- ---------------------------------------------------------------------------
select s.service_number as linea,
       s.plan_raw       as plan,
       s.carrier_raw    as operador_del_archivo,
       s.discarded_at is not null as descartada,
       s.discard_reason as motivo_del_descarte,
       s.portability_state    as estado_osiptel,
       s.portability_receiver as receptor,
       s.portability_window_at  at time zone 'America/Lima' as fecha_de_ventana,
       s.portability_checked_at at time zone 'America/Lima' as consultada_el,
       s.needs_revalidation as hay_que_revalidar,
       s.is_plant_line      as es_linea_de_planta
from recovery_case_services s
where s.case_id in (select case_id from casos_del_numero)
order by s.service_number;

-- ---------------------------------------------------------------------------
-- 4. Cuándo apareció en las cargas y en qué archivo
-- ---------------------------------------------------------------------------
select g.registered_at at time zone 'America/Lima' as fecha_del_pedido,
       g.service_number as linea,
       bb.file_name     as archivo,
       bb.uploaded_at at time zone 'America/Lima' as cargado_el,
       g.created_at   at time zone 'America/Lima' as registrado_el
from recovery_case_sightings g
join recovery_base_batches bb on bb.id = g.batch_id
where g.case_id in (select case_id from casos_del_numero)
order by g.registered_at desc;

-- ---------------------------------------------------------------------------
-- 5. Gestión: los intentos, que son inmutables
-- ---------------------------------------------------------------------------
select a.created_at at time zone 'America/Lima' as fecha,
       u.name       as asesor,
       a.channel    as canal,
       a.result     as tipificacion,
       a.phone_used as numero_usado,
       a.next_action_at at time zone 'America/Lima' as agendado_para,
       a.observation as observacion
from recovery_case_attempts a
join users u on u.id = a.actor_user_id
where a.case_id in (select case_id from casos_del_numero)
order by a.created_at;

-- ---------------------------------------------------------------------------
-- 6. Historial del caso: quién lo movió, cuándo y por qué
-- ---------------------------------------------------------------------------
select e.created_at at time zone 'America/Lima' as fecha,
       e.type            as evento,
       e.previous_status as venia_de,
       e.new_status      as paso_a,
       coalesce(ua.name, 'sistema') as actor,
       e.observation     as observacion,
       e.metadata
from recovery_case_events e
left join users ua on ua.id = e.actor_user_id
where e.case_id in (select case_id from casos_del_numero)
order by e.created_at;

-- ---------------------------------------------------------------------------
-- 7. Por si el número es de una venta y no de una campaña
-- ---------------------------------------------------------------------------
select o.order_code_raw as pedido,
       o.status,
       o.delivery_status,
       o.registered_at at time zone 'America/Lima' as ingresado_el,
       o.holder_full_name_raw   as cliente,
       o.service_number         as linea,
       o.delivery_contact_phone as telefono,
       u.name as asesor
from dito_orders o
left join users u on u.id = o.agent_user_id
cross join buscado b
where o.service_number like '%' || b.numero || '%'
   or o.delivery_contact_phone like '%' || b.numero || '%'
order by o.registered_at desc;

drop view casos_del_numero;
drop table buscado;
