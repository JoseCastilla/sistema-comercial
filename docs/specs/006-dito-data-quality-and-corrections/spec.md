# SPEC-006 — Calidad de captura y corrección de órdenes DITO

**Estado:** `IMPLEMENTED`
**Versión:** 1.0
**Fecha:** 2026-08-06

## Problema

DITO presenta el detalle del pedido colapsado. Si la extensión extrae antes de
desplegar “Ver detalle del pedido”, genera valores `N/A` que hoy atraviesan n8n
y se almacenan como información válida. Una captura posterior completa se trata
como duplicado modificado, pero no enriquece la orden. El administrador tampoco
puede corregir los campos desde la bandeja.

## Casos confirmados

- Orden `1943577383A`, asesora Francis P.: operación y ubicación inválidas.
- Orden `1943619551A`, cliente Ever Demetrio Antón Chinchay: operación y ubicación inválidas.

## Reglas

- **BR-001:** el asesor despliega manualmente “Ver detalle del pedido” antes de extraer; la extensión no opera controles internos de DITO.
- **BR-002:** la extensión nueva no envía la venta si el detalle no aparece o faltan campos esenciales.
- **BR-003:** `N/A`, guiones y secuencias compuestas únicamente por placeholders se consideran ausentes.
- **BR-004:** API detecta campos esenciales incompletos aunque la extensión antigua o n8n no los reporten, conserva la venta y la marca `PARTIAL`/`NEEDS_REVIEW`.
- **BR-005:** una orden parcial no se sobrescribe automáticamente; ADMIN la corrige manualmente usando el código de orden.
- **BR-006:** una orden completa nunca se sobrescribe automáticamente por una captura distinta.
- **BR-007:** `rawSummary` original permanece inmutable como evidencia.
- **BR-008:** ADMIN puede corregir campos operativos con motivo obligatorio.
- **BR-009:** toda corrección conserva actor, fecha, fuente y valores anterior/nuevo.
- **BR-010:** la actualización usa organización, rol y control de concurrencia.

## Campos esenciales

- código de orden;
- operación comercial reconocible;
- nombre y documento del titular;
- número de servicio;
- departamento, provincia y distrito;
- forma de entrega reconocible;
- identidad corporativa de la instalación.

## Criterios de aceptación

- **AC-001:** con detalle colapsado, la extensión bloquea la captura e indica que el asesor debe desplegarlo manualmente.
- **AC-002:** si DITO no completa el detalle, el botón de envío queda bloqueado con campos faltantes legibles.
- **AC-003:** una venta antigua con `N/A N/A N/A N/A N/A` se conserva como `PARTIAL` y `NEEDS_REVIEW`.
- **AC-004:** ADMIN encuentra la orden por su código y corrige manualmente los datos inválidos.
- **AC-005:** recapturar una orden completa diferente solo la marca para revisión.
- **AC-006:** ADMIN corrige las órdenes de Francis y Ever indicando un motivo.
- **AC-007:** la corrección no modifica el resumen original ni la identidad remitente.
- **AC-008:** usuarios sin rol ADMIN no ven ni ejecutan la corrección.
