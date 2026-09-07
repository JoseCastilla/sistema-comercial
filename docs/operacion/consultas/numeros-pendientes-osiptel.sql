-- Números de Campañas pendientes de pasar por OSIPTEL
--
-- Del total de líneas de campaña, restando:
--   · las que ya son Movistar, que el filtro rápido descartó
--     (`discarded_at` con motivo YA_ACTIVO);
--   · las que ya pasaron por OSIPTEL, que tienen fecha de consulta.
--
-- Es la misma definición que usa el botón «Todos los pendientes» de
-- Campañas → Base nacional, que descarga el .txt listo para la herramienta.
-- Esta consulta sirve para verla y acotarla desde DbGate.
--
-- Se incluyen también las marcadas para revalidar: OSIPTEL las dejó sin
-- resolver y hay que volver a preguntar.

-- ---------------------------------------------------------------------------
-- 1. El universo, para dimensionar antes de gastar cupo
-- ---------------------------------------------------------------------------
select case
         when s.discarded_at is not null              then 'ya es Movistar (descartada)'
         when c.status in ('RECOVERED','LOST','DISCARDED')
                                                      then 'caso cerrado'
         when s.needs_revalidation                    then 'hay que revalidar'
         when s.portability_checked_at is null        then 'PENDIENTE de OSIPTEL'
         else 'ya pasó por OSIPTEL'
       end                              as situacion,
       count(distinct s.service_number) as lineas
from recovery_case_services s
join recovery_cases c on c.id = s.case_id
where c.source = 'NATIONAL_BASE'
group by 1
order by lineas desc;

-- ---------------------------------------------------------------------------
-- 2. La lista. Un número por fila, sin cabecera, lo más reciente primero.
-- ---------------------------------------------------------------------------
select distinct on (s.service_number)
       s.service_number
from recovery_case_services s
join recovery_cases c on c.id = s.case_id
where c.source = 'NATIONAL_BASE'
  -- No es Movistar: el filtro rápido no la descartó
  and s.discarded_at is null
  -- El caso sigue vivo: consultar uno cerrado no aporta
  and c.status in ('TRIAGE','WAITING','OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED')
  -- No pasó por OSIPTEL, o pasó y quedó sin resolver
  and (s.portability_checked_at is null or s.needs_revalidation)
order by s.service_number, c.last_sighting_at desc;

-- 2b. La misma lista ordenada por recencia y cortada al cupo diario.
--     Un lead frío pierde valor con cada día que pasa.
select numero
from (
  select distinct on (s.service_number)
         s.service_number       as numero,
         c.last_sighting_at     as visto_el
  from recovery_case_services s
  join recovery_cases c on c.id = s.case_id
  where c.source = 'NATIONAL_BASE'
    and s.discarded_at is null
    and c.status in ('TRIAGE','WAITING','OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED')
    and (s.portability_checked_at is null or s.needs_revalidation)
  order by s.service_number, c.last_sighting_at desc
) t
order by visto_el desc
limit 2000;

-- ---------------------------------------------------------------------------
-- 3. Si además quieres refrescar lo que OSIPTEL contestó hace mucho.
--    El historial envejece: una línea consultada hace semanas pudo portar
--    después. Ajustar los 15 días al criterio que uses.
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
    and (
      s.portability_checked_at is null
      or s.needs_revalidation
      or s.portability_checked_at < now() - interval '15 days'
    )
  order by s.service_number, c.last_sighting_at desc
) t
order by visto_el desc
limit 2000;
