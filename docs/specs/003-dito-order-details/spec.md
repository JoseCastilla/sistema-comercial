# SPEC-003 — Detalles comerciales y logísticos de órdenes DITO

**Estado:** `APPROVED`  
**Versión:** 1.0  
**Fecha:** 2026-08-05  
**Responsable de producto:** José Castilla

## Objetivo

Capturar desde la vista de éxito de DITO información necesaria para seguimiento
operativo que no forma parte del resumen enviado a Google Sheets.

## Campos

- ciclo de facturación y último día de pago;
- teléfono de contacto para entrega, separado del número de la operación;
- dirección y referencia de entrega;
- latitud y longitud;
- código de venta.

## Reglas

- **BR-001:** estos campos se envían al Sistema Comercial, no se agregan a las columnas de Excel.
- **BR-002:** número de operación y teléfono de contacto permanecen separados.
- **BR-003:** ciclo y pago se normalizan como días de mes entre 1 y 31.
- **BR-004:** latitud pertenece a `[-90, 90]` y longitud a `[-180, 180]`.
- **BR-005:** los valores originales de ciclo y pago permanecen en `additional_details`.
- **BR-006:** campos ausentes no impiden recibir una orden compatible.
- **BR-007:** cambios en estos detalles forman parte del fingerprint del envelope.
- **BR-008:** una alta nueva no tiene operador cedente; su ausencia se representa como `UNKNOWN`, nunca como el texto `N/A` dentro de la operación.
- **BR-009:** cuando DITO omite el tipo de línea en un alta nueva móvil, la presentación operativa usa `POST` según la regla vigente del canal.
- **BR-010:** el horario regular se conserva como rango original cuando DITO no entrega una fecha; no se fabrican timestamps.

## Criterios de aceptación

- **AC-001:** el escenario Claro postpago Express produce `PORT_POSTPAID`.
- **AC-002:** `941586779` se conserva como servicio y `941586778` como contacto.
- **AC-003:** se persisten ciclo 9 y pago 22.
- **AC-004:** se persisten dirección, referencia y ambas coordenadas.
- **AC-005:** se persiste `FE-1128647263` como código de venta.
- **AC-006:** la salida usada por Sheets conserva sus columnas actuales.
- **AC-007:** `ALTA` sin cedente genera `ALTA NUEVA POST 39.9`, `NEW_LINE` y carrier `UNKNOWN`.
- **AC-008:** una entrega Regular 24 horas conserva el rango `3pm-7pm`.
