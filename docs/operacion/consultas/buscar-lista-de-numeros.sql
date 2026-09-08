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
  ('925592757'),
  ('919029329'),
  ('920046901'),
  ('962646238'),
  ('981592956'),
  ('953300161'),
  ('905822894'),
  ('964066890'),
  ('944378843'),
  ('944207438'),
  ('989870994'),
  ('939533793'),
  ('984969740'),
  ('913847778'),
  ('995867782'),
  ('931491260'),
  ('935116260'),
  ('925076238'),
  ('942118302'),
  ('994794497'),
  ('949348575'),
  ('947720519'),
  ('960205916'),
  ('947769335'),
  ('929139468'),
  ('984122160'),
  ('910071644'),
  ('938261987'),
  ('902335454'),
  ('944771528'),
  ('999022720'),
  ('939620617'),
  ('912083340'),
  ('963936214'),
  ('917848148'),
  ('910101044'),
  ('954619055'),
  ('956698299'),
  ('951311691'),
  ('932247887'),
  ('981852695'),
  ('914267428'),
  ('993624238'),
  ('920595576'),
  ('920810819'),
  ('951811109'),
  ('959017762'),
  ('978181257'),
  ('937564157'),
  ('940697396'),
  ('945827130'),
  ('913290619'),
  ('941422228'),
  ('916841649'),
  ('908714215'),
  ('926145133'),
  ('967133375'),
  ('946156505'),
  ('937548166'),
  ('934784413'),
  ('950818477'),
  ('960064934'),
  ('938128722'),
  ('960060956'),
  ('947459542'),
  ('937667334'),
  ('928838826'),
  ('973160142'),
  ('993043535'),
  ('925667534'),
  ('938729179'),
  ('920877392'),
  ('927970260'),
  ('938308614'),
  ('929257800'),
  ('944826209'),
  ('930114441'),
  ('946548083'),
  ('974532417'),
  ('979919429'),
  ('938711547'),
  ('927596801'),
  ('986828145'),
  ('962379356'),
  ('986808336'),
  ('941993744'),
  ('910598058'),
  ('947266985'),
  ('928443520'),
  ('900321495'),
  ('920716513'),
  ('914563262'),
  ('921994558'),
  ('914950130'),
  ('914921049'),
  ('927254798'),
  ('982728627'),
  ('929963823'),
  ('972714480'),
  ('938347289'),
  ('960762237'),
  ('931808010'),
  ('954935058'),
  ('928473653'),
  ('927531802'),
  ('932744706'),
  ('933562509'),
  ('970654048'),
  ('918016687'),
  ('955350330'),
  ('919690914'),
  ('953514447'),
  ('982942564'),
  ('927763461'),
  ('938361992'),
  ('903253529'),
  ('919006728'),
  ('930386153'),
  ('957673640'),
  ('950860169'),
  ('982423621'),
  ('921497970'),
  ('901664493'),
  ('945018541'),
  ('910092485'),
  ('929736481'),
  ('962148388'),
  ('931843815'),
  ('934758772'),
  ('913493796'),
  ('961003060'),
  ('987316361'),
  ('928053486'),
  ('995899638'),
  ('970889429'),
  ('959517014'),
  ('926454861'),
  ('968471636'),
  ('924986748'),
  ('949509178'),
  ('937636219'),
  ('932884716'),
  ('935808020'),
  ('906752397'),
  ('928951828'),
  ('925048348'),
  ('932896875'),
  ('938413425'),
  ('982793952'),
  ('999901934'),
  ('957703974'),
  ('963321271'),
  ('998015116'),
  ('924325239'),
  ('990525070'),
  ('936039279'),
  ('943100902'),
  ('910510188'),
  ('908714715'),
  ('918665302'),
  ('987006366'),
  ('902084461'),
  ('901974808'),
  ('950190827'),
  ('937339195'),
  ('981585904'),
  ('949533547'),
  ('975547910'),
  ('925735764'),
  ('982621495'),
  ('938447796'),
  ('982791999'),
  ('918804122'),
  ('961517570'),
  ('999217020'),
  ('918099769'),
  ('941549483'),
  ('963322238'),
  ('982291662'),
  ('937423333'),
  ('930160302'),
  ('918520061'),
  ('992469209'),
  ('958107796'),
  ('933038906'),
  ('928427961'),
  ('917878117'),
  ('946255982'),
  ('944183996'),
  ('952706173'),
  ('986172446'),
  ('900600399'),
  ('989846992'),
  ('925448935'),
  ('937413009'),
  ('993158647'),
  ('904241255'),
  ('940491561'),
  ('937319732'),
  ('919148891'),
  ('958157040'),
  ('938514476'),
  ('975955082'),
  ('914643934'),
  ('930553674'),
  ('914213682'),
  ('981290994'),
  ('938520326'),
  ('912068229'),
  ('900246358'),
  ('978530793'),
  ('906055272'),
  ('934748569'),
  ('935449557'),
  ('925502460'),
  ('922034449'),
  ('955775015'),
  ('946125077'),
  ('906499838'),
  ('903188619'),
  ('931802512'),
  ('936093038'),
  ('959712283'),
  ('938555343'),
  ('917513821'),
  ('970293575'),
  ('987964430');

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
