-- ¿Qué líneas de campaña son realmente Movistar, según el reporte completo?
--
-- El reporte de portabilidad nombra a Movistar como «Telefónica del Perú
-- S.A.A. (22)». Esta consulta usa el mismo criterio que la plataforma y
-- deduce el operador actual como corresponde: si la línea portó, es el
-- receptor; si no portó, es su asignatario original.

with verdad as (
  select distinct on (r.service_number)
         r.service_number,
         r.state,
         r.receiver_raw,
         nullif(trim(r.raw_data->>'asignatario_original'), '') as asignatario,
         r.window_date
  from recovery_portability_results r
  join recovery_portability_batches b on b.id = r.batch_id
  where b.kind = 'FULL'
  order by r.service_number, r.created_at desc
),
operador as (
  select v.*,
         case when v.state = 'PORTADO'
              then v.receiver_raw
              else coalesce(v.asignatario, v.receiver_raw)
         end as operador_actual
  from verdad v
)
select o.service_number as linea,
       o.state          as estado,
       o.operador_actual,
       o.window_date at time zone 'America/Lima' as fecha_de_ventana,
       c.holder_name    as cliente,
       c.status         as estado_del_caso
from operador o
join recovery_case_services s on s.service_number = o.service_number
join recovery_cases c on c.id = s.case_id and c.source = 'NATIONAL_BASE'
where o.operador_actual ilike '%movistar%'
   or o.operador_actual ilike '%telef%nica%'
   or o.operador_actual like '%(22)%'
order by o.service_number;

-- Y el resumen del universo: cuántas líneas de campaña hay en cada situación
-- según el reporte completo, sin mezclar con ningún filtro rápido.
with verdad as (
  select distinct on (r.service_number)
         r.service_number, r.state, r.receiver_raw,
         nullif(trim(r.raw_data->>'asignatario_original'), '') as asignatario
  from recovery_portability_results r
  join recovery_portability_batches b on b.id = r.batch_id
  where b.kind = 'FULL'
  order by r.service_number, r.created_at desc
),
operador as (
  select v.service_number,
         case when v.state = 'PORTADO' then v.receiver_raw
              else coalesce(v.asignatario, v.receiver_raw) end as operador_actual
  from verdad v
)
select coalesce(o.operador_actual, 'sin dato en el reporte') as operador,
       count(distinct s.service_number)                       as lineas
from recovery_case_services s
join recovery_cases c on c.id = s.case_id
left join operador o on o.service_number = s.service_number
where c.source = 'NATIONAL_BASE'
group by 1
order by lineas desc;
