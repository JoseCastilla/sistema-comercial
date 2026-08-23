# SPEC-028 — Escalamiento de incidencias al supervisor

**Estado:** `IMPLEMENTED`

## Objetivo

Permitir que un asesor escale una incidencia vinculada a una venta de su equipo, que el supervisor la reciba en Pedidos y responda sin alterar el estado comercial de la orden.

## Criterios de aceptación

- El asesor puede indicar tipo, prioridad, descripción y acción requerida.
- Solo existe una escalación activa por venta.
- El supervisor ve un contador persistente y una cola de escalaciones activas, aun si la venta pertenece a un período anterior.
- El administrador o supervisor recibe una notificación global en el sistema mientras existan tickets pendientes.
- El supervisor puede tomar o resolver la incidencia y responder al asesor.
- El supervisor puede convertirla en un ticket para TDP mediante una plantilla editable y precompletada con los datos de la venta.
- Se incluyen plantillas para logística no gestionada, pedido entregado sin cierre, fecha de portación no verificable y corrección de bolsas.
- El sistema conserva quién escaló el ticket, cuándo lo hizo y el texto exacto utilizado.
- El asesor ve el avance y la respuesta en el detalle de la misma venta.
- Los cambios actualizan la bandeja mediante el canal en tiempo real existente.
- Escalar o resolver una incidencia no cambia el estado de entrega ni el estado comercial del pedido.

## Permisos

- Asesor: crea escalaciones únicamente sobre ventas propias asignadas a un equipo activo.
- Supervisor vendedor: tiene el mismo permiso sobre sus ventas propias.
- Supervisor: atiende escalaciones de los equipos que supervisa.
- Administrador: atiende escalaciones de toda la organización.
- El solicitante no puede revisar su propia escalación.
