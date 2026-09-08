-- ¿Estas ventas vienen de la base de Campañas?
--
-- Se pega la lista de números abajo, una fila por número. Las consultas
-- dicen cuáles existen como línea de un caso de campaña, en qué estado está
-- ese caso, y si el sistema ya lo dio por recuperado con un pedido concreto.
--
-- Un número puede aparecer en campañas y no ser mérito de la campaña: lo que
-- lo convierte en recupero es que su caso esté RECOVERED y apunte al pedido.
-- Por eso el veredicto separa «está en la base» de «la campaña lo reclama».

create temporary table buscados (numero varchar(15) primary key);

insert into buscados (numero) values
  ('993624238'),
  ('920595576'),
  ('951811109'),
  ('929257800'),
  ('946548083'),
  ('974532417'),
  ('936039279'),
  ('937339195'),
  ('949533547'),
  ('941549483'),
  ('963322238'),
  ('937423333'),
  ('992469209'),
  ('958107796'),
  ('933038906'),
  ('917878117'),
  ('946255982'),
  ('914213682'),
  ('912068229'),
  ('922034449');

-- ---------------------------------------------------------------------------
-- 1. Una fila por número, con el veredicto
-- ---------------------------------------------------------------------------
select distinct on (b.numero)
       b.numero,
       case
         when c.id is null                    then 'no está en campañas'
         when c.status = 'RECOVERED'
          and c.recovered_dito_order_id is not null
                                              then 'recuperado por campañas'
         when c.status = 'RECOVERED'          then 'recuperado, sin pedido enlazado'
         when c.status in ('LOST','DISCARDED') then 'está en campañas, caso cerrado'
         else 'está en campañas, caso abierto'
       end                    as veredicto,
       c.status               as estado_del_caso,
       c.holder_name          as cliente,
       c.document_number      as dni,
       u.name                 as asesor_del_caso,
       t.name                 as equipo,
       c.resolved_at at time zone 'America/Lima' as resuelto_el,
       c.loss_reason          as motivo_de_perdida,
       c.discard_reason       as motivo_de_descarte,
       c.id                   as case_id
from buscados b
left join recovery_case_services s on s.service_number = b.numero
left join recovery_cases c
       on c.id = s.case_id and c.source = 'NATIONAL_BASE'
left join users u on u.id = c.assigned_user_id
left join commercial_teams t on t.id = c.assigned_team_id
order by b.numero,
         -- Si el número toca varios casos, manda el más resuelto y reciente.
         (c.status = 'RECOVERED') desc nulls last,
         c.updated_at desc nulls last;

-- ---------------------------------------------------------------------------
-- 2. El resumen. Cuántas de tus ventas vienen de la base.
-- ---------------------------------------------------------------------------
select veredicto, count(*) as numeros
from (
  select distinct on (b.numero)
         b.numero,
         case
           when c.id is null                     then 'no está en campañas'
           when c.status = 'RECOVERED'
            and c.recovered_dito_order_id is not null
                                                 then 'recuperado por campañas'
           when c.status = 'RECOVERED'           then 'recuperado, sin pedido enlazado'
           when c.status in ('LOST','DISCARDED') then 'está en campañas, caso cerrado'
           else 'está en campañas, caso abierto'
         end as veredicto
  from buscados b
  left join recovery_case_services s on s.service_number = b.numero
  left join recovery_cases c
         on c.id = s.case_id and c.source = 'NATIONAL_BASE'
  order by b.numero,
           (c.status = 'RECOVERED') desc nulls last,
           c.updated_at desc nulls last
) t
group by 1
order by numeros desc;

-- ---------------------------------------------------------------------------
-- 3. La venta que corresponde a cada número, en Pedidos
--    Sirve para contrastar quién la registró contra quién trabajó el caso.
-- ---------------------------------------------------------------------------
select b.numero,
       o.order_code_raw as pedido,
       o.status,
       o.delivery_status,
       o.registered_at at time zone 'America/Lima' as ingresada_el,
       o.holder_full_name_raw as cliente_del_pedido,
       ua.name as asesor_del_pedido,
       t.name  as equipo_del_pedido
from buscados b
join dito_orders o
  on o.service_number = b.numero
  or o.delivery_contact_phone = b.numero
left join users ua on ua.id = o.agent_user_id
left join commercial_teams t on t.id = o.assigned_team_id
order by b.numero, o.registered_at desc;

-- ---------------------------------------------------------------------------
-- 4. Los casos que el sistema ya enlazó a un pedido concreto
--    Este es el recupero que la campaña puede reclamar con evidencia.
-- ---------------------------------------------------------------------------
select b.numero,
       c.holder_name as cliente,
       ur.name       as resuelto_por,
       c.resolved_at at time zone 'America/Lima' as resuelto_el,
       o.order_code_raw as pedido_enlazado,
       o.registered_at at time zone 'America/Lima' as pedido_ingresado_el,
       uo.name       as asesor_del_pedido
from buscados b
join recovery_case_services s on s.service_number = b.numero
join recovery_cases c on c.id = s.case_id and c.source = 'NATIONAL_BASE'
join dito_orders o on o.id = c.recovered_dito_order_id
left join users ur on ur.id = c.resolved_by_user_id
left join users uo on uo.id = o.agent_user_id
order by c.resolved_at desc;

-- ---------------------------------------------------------------------------
-- 5. Detalle de la línea, por si un número aparece y no cuadra
-- ---------------------------------------------------------------------------
select b.numero,
       s.discarded_at is not null as linea_descartada,
       s.discard_reason           as motivo,
       s.portability_state        as estado_osiptel,
       s.portability_receiver     as receptor,
       s.portability_window_at  at time zone 'America/Lima' as fecha_de_ventana,
       s.portability_checked_at at time zone 'America/Lima' as consultada_el,
       s.first_registered_at at time zone 'America/Lima' as primer_pedido_en_base,
       s.last_registered_at  at time zone 'America/Lima' as ultimo_pedido_en_base
from buscados b
join recovery_case_services s on s.service_number = b.numero
order by b.numero;

drop table buscados;
