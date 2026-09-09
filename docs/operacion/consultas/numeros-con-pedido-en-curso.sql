-- Números con pedido en curso
--
-- En la plataforma «pedido en curso» es un caso en espera: el cliente tiene
-- algo andando y no se le gestiona hasta saber en qué queda. La espera llega
-- por cuatro caminos distintos y conviene separarlos, porque no todos se
-- resuelven igual:
--
--   · Portabilidad programada hacia Movistar, con fecha de ventana. Se
--     espera a que llegue el día.
--   · Programada hacia Movistar sin fecha. Hay que volver a consultarla.
--   · El asesor reportó que el cliente ya es Movistar y falta que
--     supervisión lo confirme.
--   · Un supervisor la puso en espera a mano en la revisión.
--
-- Esta lista también sale del botón «Pedidos en curso» en Campañas → Base
-- nacional, que descarga el .txt listo para la herramienta.

-- ---------------------------------------------------------------------------
-- 1. Cuántos hay de cada tipo de espera
-- ---------------------------------------------------------------------------
select case
         when s.needs_revalidation                    then 'programada sin fecha: reconsultar'
         when s.portability_state = 'PROGRAMADO'
          and s.portability_window_at is not null
          and s.portability_window_at > now()         then 'portabilidad programada, ventana por delante'
         when s.portability_state = 'PROGRAMADO'
          and s.portability_window_at is not null     then 'ventana ya pasada: hay que revisar'
         when c.assigned_user_id is not null          then 'reportada como ya Movistar, sin confirmar'
         else 'espera puesta a mano en la revisión'
       end                              as tipo_de_espera,
       count(distinct s.service_number) as lineas,
       count(distinct c.id)             as casos
from recovery_cases c
join recovery_case_services s on s.case_id = c.id
where c.source = 'NATIONAL_BASE'
  and c.status = 'WAITING'
  and s.discarded_at is null
group by 1
order by lineas desc;

-- ---------------------------------------------------------------------------
-- 2. La lista. Un número por fila, sin cabecera.
-- ---------------------------------------------------------------------------
select distinct s.service_number
from recovery_cases c
join recovery_case_services s on s.case_id = c.id
where c.source = 'NATIONAL_BASE'
  and c.status = 'WAITING'
  and s.discarded_at is null
order by 1;

-- 2b. Solo las que ya no tienen nada que esperar: sin fecha de ventana, o con
--     la ventana vencida. Son las que conviene volver a consultar hoy.
select distinct s.service_number
from recovery_cases c
join recovery_case_services s on s.case_id = c.id
where c.source = 'NATIONAL_BASE'
  and c.status = 'WAITING'
  and s.discarded_at is null
  and (s.needs_revalidation
       or s.portability_window_at is null
       or s.portability_window_at <= now())
order by 1;

-- ---------------------------------------------------------------------------
-- 3. Detalle, para revisar antes de mover nada
-- ---------------------------------------------------------------------------
select s.service_number   as linea,
       c.holder_name      as cliente,
       c.document_number  as dni,
       t.name             as equipo,
       u.name             as asesor,
       s.portability_state    as estado_osiptel,
       s.portability_receiver as receptor,
       s.portability_window_at at time zone 'America/Lima' as fecha_de_ventana,
       case
         when s.portability_window_at is null      then null
         when s.portability_window_at > now()      then 'por delante'
         else 'vencida'
       end                                        as ventana,
       s.needs_revalidation as hay_que_revalidar,
       s.portability_checked_at at time zone 'America/Lima' as consultada_el,
       e.created_at at time zone 'America/Lima'   as en_espera_desde,
       coalesce(ue.name, 'sistema')               as la_puso_en_espera,
       e.observation                              as motivo
from recovery_cases c
join recovery_case_services s on s.case_id = c.id
left join users u on u.id = c.assigned_user_id
left join commercial_teams t on t.id = c.assigned_team_id
left join lateral (
  select ev.created_at, ev.observation, ev.actor_user_id
  from recovery_case_events ev
  where ev.case_id = c.id
    and ev.new_status = 'WAITING'
  order by ev.created_at desc
  limit 1
) e on true
left join users ue on ue.id = e.actor_user_id
where c.source = 'NATIONAL_BASE'
  and c.status = 'WAITING'
  and s.discarded_at is null
order by s.portability_window_at nulls first, c.holder_name;

-- ---------------------------------------------------------------------------
-- 4. Las que llevan más tiempo esperando, que son las que se olvidan
-- ---------------------------------------------------------------------------
select s.service_number  as linea,
       c.holder_name     as cliente,
       u.name            as asesor,
       e.created_at at time zone 'America/Lima' as en_espera_desde,
       (current_date - (e.created_at at time zone 'America/Lima')::date) as dias_esperando,
       s.portability_window_at at time zone 'America/Lima' as fecha_de_ventana
from recovery_cases c
join recovery_case_services s on s.case_id = c.id
left join users u on u.id = c.assigned_user_id
join lateral (
  select ev.created_at
  from recovery_case_events ev
  where ev.case_id = c.id
    and ev.new_status = 'WAITING'
  order by ev.created_at desc
  limit 1
) e on true
where c.source = 'NATIONAL_BASE'
  and c.status = 'WAITING'
  and s.discarded_at is null
order by dias_esperando desc
limit 100;
