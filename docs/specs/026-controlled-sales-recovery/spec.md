# SPEC-026 — Recuperación comercial controlada

## Problema

La bandeja de recuperos se construye hoy a partir de pedidos `CANCELLED` o
`SENT + NOT_DELIVERED`. Esto permite encontrar fallos logísticos, pero no
distingue por qué se perdió la entrega ni permite enviar explícitamente un caso
comercial como una promesa de beneficios incorrecta.

## Decisión

La recuperación no será una cola global de apropiación libre. La orden conserva
su asesor y equipo originales. Administración, backoffice o supervisión pueden
enviarla a recupero y decidir si continúa con el propietario o se reasigna de
forma auditada.

La orden cancelada permanece cerrada e inmutable. El sistema crea un caso de
recuperación relacionado. Si la recuperación genera una venta, se enlaza la
nueva orden DITO sin reemplazar ni borrar el intento original.

## Entrada automática

Se crea un caso de recupero cuando una orden queda:

- `CANCELLED`; o
- `SENT + NOT_DELIVERED`.

Administración, backoffice y supervisión también pueden crear el caso
manualmente cuando reciben una observación comercial antes de que DITO refleje
el estado final.

No entran automáticamente pedidos cerrados, entregados, duplicados o clientes
que ya constan como Movistar.

## Priorización operativa

1. **Crítica:** cliente rechazó por promesa incorrecta, información distinta al
   contrato o mala explicación. Reasignación inmediata fuera del vendedor que
   originó la incidencia.
2. **Alta:** cliente no recibió por falta de tiempo, ausencia o cambio de fecha.
3. **Media:** incidencia logística solucionable.
4. **Condicionada:** deuda o antigüedad; se agenda para la fecha en que pueda
   volver a evaluarse.

Dentro de cada nivel se atiende primero el caso más antiguo sin contacto.

## Propiedad y escalamiento

- En ausencias, falta de tiempo o reprogramaciones, el asesor original conserva
  la primera oportunidad de recuperación durante el Día 0.
- Si no registra una acción dentro del SLA, el caso escala al supervisor y puede
  pasar al equipo de recuperación autorizado.
- En promesa incorrecta o mala venta, el caso no vuelve al asesor que originó la
  incidencia; supervisión lo reasigna inmediatamente.
- La cola compartida solo existe dentro del equipo autorizado. La toma del caso
  es atómica: cuando un asesor lo acepta deja de estar disponible para otros.

## Cadencia inicial

- **Día 0:** primer contacto dentro de las dos horas siguientes al rechazo o a
  la recepción de la novedad del OL.
- **Día 1:** segundo contacto y corrección de oferta o fecha de entrega.
- **Día 3:** tercer contacto.
- **Día 7:** último intento y resolución obligatoria.

Una promesa de contacto suspende esta cadencia y reaparece exactamente en la
fecha acordada. Cada intento registra canal, resultado, actor y próxima acción.

## Estados del caso

- `OPEN`: pendiente de primera acción.
- `ASSIGNED`: responsable definido.
- `IN_PROGRESS`: ya existe gestión.
- `SCHEDULED`: próxima acción futura acordada.
- `RECOVERED`: generó una nueva orden vinculada.
- `LOST`: oportunidad terminada con motivo obligatorio.

Motivos de pérdida: cliente ya migró con otra agencia, rechazo definitivo,
inubicable después de la cadencia, deuda sin solución, datos inválidos u otro.

## Requisitos

- Acción explícita “Enviar a recupero” disponible para roles independientes del
  propietario de la venta.
- Motivo estructurado obligatorio: no entregado, logística, deuda, antigüedad,
  promesa comercial incorrecta u otro.
- Observación obligatoria que preserve el mensaje del OL.
- Conservar asesor y equipo originales al crear el caso.
- Permitir reasignación solo a administración o al supervisor dentro de sus
  equipos autorizados.
- Registrar creador, fecha, motivo, asignaciones y resolución.
- Mostrar tiempo en recupero sin reemplazar el SLA original de entrega.
- Resolver como recuperada, perdida o retirada, sin alterar retroactivamente la
  atribución de la venta original.
- Vincular la nueva orden DITO cuando el resultado sea `RECOVERED`.
- Medir tiempo hasta primer contacto, tasa recuperada y pérdidas frente a otra
  agencia por asesor, equipo y motivo.

## Regla antifraude

- Un asesor no puede enviar directamente su propia venta a una cola compartida
  ni autoasignarse casos ajenos.
- Un supervisor vendedor no puede tomar su propia venta mediante el flujo de
  recupero.
- Toda reasignación conserva historial y actor.

## Caso de referencia

Orden `1942469714A`: motivo “Promesa comercial incorrecta”; observación del OL
indica que el cliente rechazó la recepción porque los beneficios ofrecidos no
coincidían con el contrato.

Orden `1942303517A`: cancelada por no recibir el chip y falta de tiempo. El
cliente aceptó una semana después con otra agencia; el caso se resuelve `LOST`
con motivo “Ya migró con otra agencia”.
