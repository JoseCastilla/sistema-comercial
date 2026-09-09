-- Leads de Campañas asignados por equipo, con su contacto
--
-- Un caso entregado a un equipo puede estar en dos situaciones: repartido a
-- un asesor concreto, o todavía en el pool del equipo esperando que alguien
-- lo tome. Las dos cuentan como carga del equipo, así que se distinguen en
-- vez de mezclarse.
--
-- Los teléfonos salen de la libreta del caso: los de tipo CONTACT son con
-- los que se llama, los de tipo SERVICE son la línea a portar. Se excluyen
-- los marcados como inválidos.
--
-- Para acotar a un equipo, descomentar la línea del filtro en cada consulta.

-- ---------------------------------------------------------------------------
-- 1. Cuántos leads tiene cada equipo y en qué estado están
-- ---------------------------------------------------------------------------
select t.name                                             as equipo,
       count(*)                                           as leads,
       count(*) filter (where c.assigned_user_id is not null) as con_asesor,
       count(*) filter (where c.assigned_user_id is null)     as en_el_pool,
       count(*) filter (where c.status = 'ASSIGNED')       as asignados,
       count(*) filter (where c.status = 'IN_PROGRESS')    as en_gestion,
       count(*) filter (where c.status = 'SCHEDULED')      as agendados,
       count(*) filter (where c.status = 'WAITING')        as en_espera,
       count(*) filter (where c.status = 'OPEN')           as sin_tomar,
       count(*) filter (where c.first_contact_at is null)  as sin_primer_contacto,
       count(*) filter (where c.next_action_at < now())    as vencidos
from recovery_cases c
join commercial_teams t on t.id = c.assigned_team_id
where c.source = 'NATIONAL_BASE'
  and c.status in ('OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED','WAITING')
group by t.name
order by leads desc;

-- 1b. El mismo conteo, abierto por asesor dentro de cada equipo
select t.name                    as equipo,
       coalesce(u.name, 'sin asesor: en el pool') as asesor,
       count(*)                  as leads,
       count(*) filter (where c.first_contact_at is null) as sin_primer_contacto,
       count(*) filter (where c.next_action_at < now())   as vencidos
from recovery_cases c
join commercial_teams t on t.id = c.assigned_team_id
left join users u on u.id = c.assigned_user_id
where c.source = 'NATIONAL_BASE'
  and c.status in ('OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED','WAITING')
group by t.name, u.name
order by equipo, leads desc;

-- ---------------------------------------------------------------------------
-- 2. El detalle: un lead por fila, con sus teléfonos
-- ---------------------------------------------------------------------------
select t.name             as equipo,
       coalesce(u.name, 'en el pool') as asesor,
       c.holder_name      as cliente,
       c.document_number  as dni,
       tel.contactos      as telefonos_de_contacto,
       tel.lineas         as lineas_a_portar,
       c.status           as estado,
       c.department       as departamento,
       c.province         as provincia,
       c.district         as distrito,
       c.claimed_at       at time zone 'America/Lima' as tomado_el,
       c.first_contact_at at time zone 'America/Lima' as primer_contacto,
       c.next_action_at   at time zone 'America/Lima' as proxima_accion,
       intentos.total     as intentos,
       intentos.ultima    as ultima_tipificacion,
       c.id               as case_id
from recovery_cases c
join commercial_teams t on t.id = c.assigned_team_id
left join users u on u.id = c.assigned_user_id
left join lateral (
  select string_agg(distinct p.phone_number, ' / ')
           filter (where p.kind = 'CONTACT') as contactos,
         string_agg(distinct p.phone_number, ' / ')
           filter (where p.kind = 'SERVICE') as lineas
  from recovery_case_phones p
  where p.case_id = c.id
    and p.invalid_marked_at is null
) tel on true
left join lateral (
  select count(*) as total,
         max(a.result::text) filter (
           where a.created_at = (
             select max(x.created_at) from recovery_case_attempts x where x.case_id = c.id
           )
         ) as ultima
  from recovery_case_attempts a
  where a.case_id = c.id
) intentos on true
where c.source = 'NATIONAL_BASE'
  and c.status in ('OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED','WAITING')
  -- and t.name = 'AYACUCHO - MAGISTERIAL 01'   -- <<< filtro por equipo
order by t.name, asesor, c.next_action_at nulls last, c.holder_name;

-- ---------------------------------------------------------------------------
-- 3. Una fila por teléfono, para exportar a un marcador o a una campaña
-- ---------------------------------------------------------------------------
select t.name             as equipo,
       coalesce(u.name, 'en el pool') as asesor,
       c.holder_name      as cliente,
       c.document_number  as dni,
       p.phone_number     as telefono,
       p.kind             as tipo,
       c.status           as estado
from recovery_cases c
join commercial_teams t on t.id = c.assigned_team_id
join recovery_case_phones p
  on p.case_id = c.id and p.invalid_marked_at is null
left join users u on u.id = c.assigned_user_id
where c.source = 'NATIONAL_BASE'
  and c.status in ('OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED','WAITING')
  -- and t.name = 'AYACUCHO - MAGISTERIAL 01'   -- <<< filtro por equipo
  -- and p.kind = 'CONTACT'                     -- <<< solo teléfonos de llamada
order by t.name, asesor, c.holder_name, p.kind;

-- ---------------------------------------------------------------------------
-- 4. Lo que no está en ningún equipo, por si hay que repartirlo
-- ---------------------------------------------------------------------------
select c.status            as estado,
       count(*)            as leads,
       count(*) filter (where c.assigned_user_id is not null) as con_asesor
from recovery_cases c
where c.source = 'NATIONAL_BASE'
  and c.assigned_team_id is null
  and c.status in ('TRIAGE','OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED','WAITING')
group by 1
order by leads desc;
