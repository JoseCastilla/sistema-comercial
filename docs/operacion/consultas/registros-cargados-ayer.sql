-- Registros de la base cargada ayer, sin los que ya son Movistar
--
-- Un lote de base nacional deja sus filas en `recovery_base_records`. Cada
-- fila apunta al caso que la explica, sea uno nuevo o uno que ya existía
-- (avistamiento). «Ya es Movistar» significa que la línea quedó descartada
-- por el filtro rápido, con motivo YA_ACTIVO.
--
-- La ventana es «ayer» en hora de Lima. Para otro día, cambiar las dos
-- fechas de la consulta 0 y usar ese lote.

-- ---------------------------------------------------------------------------
-- 0. Qué lotes se cargaron ayer. Anota el id si quieres acotar a uno solo.
-- ---------------------------------------------------------------------------
select b.id                                        as batch_id,
       b.uploaded_at at time zone 'America/Lima'    as subido_el,
       b.file_name                                  as archivo,
       b.status,
       b.source_rows                                as filas,
       b.eligible_rows                              as elegibles,
       b.excluded_rows                              as excluidas,
       b.new_cases                                  as casos_nuevos,
       b.sighting_cases                             as avistamientos,
       u.name                                       as subido_por
from recovery_base_batches b
join users u on u.id = b.uploaded_by_user_id
where (b.uploaded_at at time zone 'America/Lima')::date = current_date - 1
order by b.uploaded_at;

-- ---------------------------------------------------------------------------
-- 1. Resumen de lo cargado ayer: cuánto sigue vivo y cuánto ya es Movistar
-- ---------------------------------------------------------------------------
select case
         when s.id is null                then 'sin línea en el caso'
         when s.discarded_at is not null
          and s.discard_reason = 'YA_ACTIVO'
                                          then 'ya es Movistar'
         when s.discarded_at is not null   then 'descartada por otro motivo'
         else 'sigue viva'
       end                              as situacion,
       count(distinct r.service_number) as lineas
from recovery_base_records r
join recovery_base_batches b on b.id = r.batch_id
left join recovery_case_services s
       on s.case_id = r.case_id
      and s.service_number = r.service_number
where (b.uploaded_at at time zone 'America/Lima')::date = current_date - 1
group by 1
order by lineas desc;

-- ---------------------------------------------------------------------------
-- 2. La lista: números de ayer que no son Movistar. Uno por fila.
-- ---------------------------------------------------------------------------
select distinct r.service_number
from recovery_base_records r
join recovery_base_batches b on b.id = r.batch_id
join recovery_case_services s
  on s.case_id = r.case_id
 and s.service_number = r.service_number
where (b.uploaded_at at time zone 'America/Lima')::date = current_date - 1
  and s.discarded_at is null
order by 1;

-- ---------------------------------------------------------------------------
-- 3. Con contexto, para revisar antes de mandar a filtrar
-- ---------------------------------------------------------------------------
select distinct on (r.service_number)
       r.service_number   as linea,
       c.holder_name      as cliente,
       c.document_number  as dni,
       c.status           as estado_del_caso,
       u.name             as asesor,
       r.classification   as clasificacion_en_la_carga,
       r.application_status as se_aplico,
       r.registered_at at time zone 'America/Lima' as fecha_del_pedido,
       s.portability_state as ultimo_estado_osiptel,
       s.portability_checked_at at time zone 'America/Lima' as consultada_el,
       b.file_name        as archivo
from recovery_base_records r
join recovery_base_batches b on b.id = r.batch_id
join recovery_case_services s
  on s.case_id = r.case_id
 and s.service_number = r.service_number
join recovery_cases c on c.id = r.case_id
left join users u on u.id = c.assigned_user_id
where (b.uploaded_at at time zone 'America/Lima')::date = current_date - 1
  and s.discarded_at is null
order by r.service_number, r.registered_at desc;

-- ---------------------------------------------------------------------------
-- 4. Las que sí quedaron como Movistar, por si quieres contrastarlas
-- ---------------------------------------------------------------------------
select distinct r.service_number as linea,
       c.holder_name             as cliente,
       s.discard_reason          as motivo,
       s.discarded_at at time zone 'America/Lima' as descartada_el
from recovery_base_records r
join recovery_base_batches b on b.id = r.batch_id
join recovery_case_services s
  on s.case_id = r.case_id
 and s.service_number = r.service_number
join recovery_cases c on c.id = r.case_id
where (b.uploaded_at at time zone 'America/Lima')::date = current_date - 1
  and s.discarded_at is not null
order by 1;
