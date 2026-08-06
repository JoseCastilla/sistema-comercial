# SPEC-007 — Verificación

**Estado:** `PARSER_IMPLEMENTED`
**Fecha:** 2026-08-06

## Incremento 1 — Parser y catálogos

- ExcelJS 4.4.0 incorporado únicamente en la API para lectura server-side.
- Cabecera detectada por nombres dentro de las primeras 20 filas; no depende de
  posiciones fijas ni del número total de columnas.
- La selección de ubicación y dirección comienza después de la sección móvil,
  evitando confundir las columnas duplicadas del bloque fijo.
- Catálogo oficial INEI de 196 provincias generado desde el recurso publicado
  el 17/09/2025 y conservado con versión y URL de origen.
- Operadores confirmados: `20 = ENTEL`, `21 = CLARO`, `24 = BITEL`; `45` se
  acepta como ausencia de cedente únicamente para alta nueva.
- Fechas interpretadas en `America/Lima`; mes vigente aplicado antes de marcar
  una fila importable.
- Marcadores `45`, `82`, `Deliveryundefined` y ausencia de instrucciones no se
  trasladan a los campos comerciales.
- Pruebas anónimas cubren plantilla reducida, encabezados duplicados, alta,
  portabilidad, Express, Regular 24 h, exclusión temporal y operador inválido.

## Evidencia con archivos reales

### `sales (21).xlsx` — 01/08/2026

- 88 columnas, cabecera en fila 3 y 33 filas de datos.
- 30 importables, 3 excluidas y 0 inválidas.
- Estados excluidos: 2 `CAIDA` y 1 `RECHAZADO`.
- 29 Express y 1 Regular 24 h dentro del subconjunto importable.
- 5 identidades `Usuario DITO` distintas.
- 30 códigos de orden válidos y únicos dentro del subconjunto aprobado.

### `sales (20).xlsx` — plantilla reducida del 31/07/2026

- 35 columnas y 18 filas de datos.
- 0 importables porque todas pertenecen al mes anterior.
- 18 excluidas y 0 inválidas.

## Pendiente

- Persistir lotes y filas de vista previa sin crear órdenes.
- Comparar cada código de orden y código de venta con la organización activa.
- Resolver las cinco identidades DITO antes de habilitar confirmación.
- Implementar interfaz ADMIN y pruebas de autorización/idempotencia.
