-- Números de Campañas que no son Movistar
--
-- Son las líneas que siguen vivas: las que el filtro rápido dio por activas
-- en Movistar quedan descartadas (`discarded_at` con motivo YA_ACTIVO) y
-- salen de esta lista. Es el universo sobre el que toca volver a filtrar.
--
-- La consulta 2 es la lista para la herramienta: un número por fila, sin
-- cabecera y sin duplicados.

-- ---------------------------------------------------------------------------
-- 1. Cuántas son y en qué estado están, para dimensionar la jornada
-- ---------------------------------------------------------------------------
select c.status                          as estado_del_caso,
       count(distinct s.service_number)  as lineas,
       count(distinct s.service_number)
         filter (where s.portability_checked_at is null) as sin_pasar_por_osiptel
from recovery_case_services s
join recovery_cases c on c.id = s.case_id
where c.source = 'NATIONAL_BASE'
  and s.discarded_at is null
group by 1
order by lineas desc;

-- ---------------------------------------------------------------------------
-- 2. La lista. Casos vivos, lo más reciente primero.
-- ---------------------------------------------------------------------------
select numero
from (
  select distinct on (s.service_number)
         s.service_number   as numero,
         c.last_sighting_at as visto_el
  from recovery_case_services s
  join recovery_cases c on c.id = s.case_id
  where c.source = 'NATIONAL_BASE'
    and s.discarded_at is null
    and c.status in ('TRIAGE','WAITING','OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED')
  order by s.service_number, c.last_sighting_at desc
) t
order by visto_el desc;

-- 2b. La misma, cortada al cupo diario de la herramienta.
select numero
from (
  select distinct on (s.service_number)
         s.service_number   as numero,
         c.last_sighting_at as visto_el
  from recovery_case_services s
  join recovery_cases c on c.id = s.case_id
  where c.source = 'NATIONAL_BASE'
    and s.discarded_at is null
    and c.status in ('TRIAGE','WAITING','OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED')
  order by s.service_number, c.last_sighting_at desc
) t
order by visto_el desc
limit 2000;

-- ---------------------------------------------------------------------------
-- 3. Con contexto, por si quieres revisar antes de mandar
-- ---------------------------------------------------------------------------
select distinct on (s.service_number)
       s.service_number   as linea,
       c.holder_name      as cliente,
       c.document_number  as dni,
       c.status           as estado_del_caso,
       u.name             as asesor,
       c.department       as departamento,
       s.plan_raw         as plan,
       s.portability_state as ultimo_estado_osiptel,
       s.portability_checked_at at time zone 'America/Lima' as consultada_el,
       c.last_sighting_at  at time zone 'America/Lima' as vista_el
from recovery_case_services s
join recovery_cases c on c.id = s.case_id
left join users u on u.id = c.assigned_user_id
where c.source = 'NATIONAL_BASE'
  and s.discarded_at is null
  and c.status in ('TRIAGE','WAITING','OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED')
order by s.service_number, c.last_sighting_at desc;

-- ---------------------------------------------------------------------------
-- 4. Variante amplia: todas las líneas vivas, incluidas las de casos ya
--    cerrados. Sirve para un barrido completo, no para el trabajo del día.
-- ---------------------------------------------------------------------------
select distinct s.service_number
from recovery_case_services s
join recovery_cases c on c.id = s.case_id
where c.source = 'NATIONAL_BASE'
  and s.discarded_at is null
order by 1;
