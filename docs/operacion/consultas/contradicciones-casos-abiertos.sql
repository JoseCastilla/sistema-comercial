-- Las contradicciones que de verdad importan: solo casos abiertos
--
-- En una base de recupero, la mayoría de las líneas ya migró a Movistar y
-- sus casos se cerraron hace tiempo. Que un filtro traiga el 68% de la
-- cartera es lo normal. Lo que hay que mirar antes de aplicarlo es lo que
-- todavía está vivo: si el filtro dice «ya es Movistar» sobre un caso que un
-- asesor está trabajando, o el filtro se equivoca, o el reporte está viejo.
--
-- Reemplazar la lista de números por la del filtro que se vaya a aplicar.

create temporary table filtro_rapido (numero varchar(15) primary key);
-- insert into filtro_rapido (numero) values ('...'), ('...');

with verdad as (
  select distinct on (r.service_number)
         r.service_number,
         r.state,
         r.receiver_raw,
         nullif(trim(r.raw_data->>'asignatario_original'), '') as asignatario,
         r.window_date,
         r.created_at,
         b.uploaded_at,
         b.file_name
  from recovery_portability_results r
  join recovery_portability_batches b on b.id = r.batch_id
  where b.kind = 'FULL'
  order by r.service_number, r.created_at desc
),
operador as (
  select v.*,
         case when v.state = 'PORTADO' then v.receiver_raw
              else coalesce(v.asignatario, v.receiver_raw) end as operador_actual
  from verdad v
)
select c.holder_name     as cliente,
       c.document_number as dni,
       u.name            as asesor,
       c.status          as estado_del_caso,
       s.service_number  as linea,
       o.state           as dice_el_reporte,
       o.operador_actual as operador_segun_reporte,
       o.window_date at time zone 'America/Lima' as fecha_de_ventana,
       o.uploaded_at at time zone 'America/Lima' as reporte_subido_el,
       -- Cuántos días tiene el dato: si es viejo, la línea pudo portar después
       (current_date - (o.uploaded_at at time zone 'America/Lima')::date) as antiguedad_dias,
       o.file_name       as archivo_del_reporte,
       a.result          as ultima_tipificacion,
       a.created_at at time zone 'America/Lima' as ultimo_intento,
       a.observation     as ultima_observacion
from filtro_rapido f
join recovery_case_services s
  on s.service_number = f.numero and s.discarded_at is null
join recovery_cases c on c.id = s.case_id
join operador o on o.service_number = s.service_number
left join users u on u.id = c.assigned_user_id
left join lateral (
  select result, created_at, observation
  from recovery_case_attempts
  where case_id = c.id
  order by created_at desc
  limit 1
) a on true
where c.source = 'NATIONAL_BASE'
  and c.status in ('TRIAGE','WAITING','OPEN','ASSIGNED','IN_PROGRESS','SCHEDULED')
  and o.operador_actual is not null
  and o.operador_actual not ilike '%movistar%'
  and o.operador_actual not ilike '%telef%nica%'
  and o.operador_actual not like '%(22)%'
order by c.status, antiguedad_dias desc, cliente;

-- ¿Es cuestión de antigüedad? Si las contradicciones vienen de reportes
-- viejos, la línea pudo portar a Movistar después y el filtro fresco tiene
-- razón. Si vienen de un reporte reciente, el filtro es el que se equivoca.
with verdad as (
  select distinct on (r.service_number) r.service_number, b.uploaded_at
  from recovery_portability_results r
  join recovery_portability_batches b on b.id = r.batch_id
  where b.kind = 'FULL'
  order by r.service_number, r.created_at desc
)
select (current_date - (v.uploaded_at at time zone 'America/Lima')::date) as antiguedad_dias,
       count(*) as lineas
from filtro_rapido f
join verdad v on v.service_number = f.numero
group by 1
order by 1;

drop table filtro_rapido;
