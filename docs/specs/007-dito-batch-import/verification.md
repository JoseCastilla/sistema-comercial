# SPEC-007 — Verificación

**Estado:** `ADMIN_PREVIEW_UI_IN_PROGRESS`
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

## Incremento 2 — Persistencia y clasificación de vista previa

- Modelos separados para lote, filas e identidades externas DITO.
- Hash SHA-256 único por organización para reutilizar el mismo lote sin duplicarlo.
- Identidad `Usuario DITO` única por organización y resolución exclusiva a un
  usuario `AGENT` activo.
- Comparación por código de orden y control adicional por código de venta.
- Clasificaciones: nueva, enriquecimiento, sin cambios, excluida, inválida,
  identidad bloqueada y conflicto.
- Los enriquecimientos solo proponen valores ausentes o placeholders; una
  diferencia entre dos valores válidos se conserva como conflicto.
- La vista previa persiste lote y filas en una transacción, pero no ejecuta
  `create` ni `update` sobre pedidos.
- Migración `20260806180000_add_dito_batch_import_preview` aplicada y verificada
  únicamente en PostgreSQL local.
- 11 pruebas enfocadas aprobadas para clasificación, conflictos, identidad,
  persistencia segura e idempotencia por archivo.

## Pendiente

- Resolver las cinco identidades DITO antes de habilitar confirmación.
- Implementar interfaz ADMIN y pruebas de autorización/idempotencia.

## Incremento 3 — Acceso administrativo y primera interfaz

- Endpoint interno de vista previa protegido con firma HMAC ligada al hash del
  archivo y una vigencia máxima de cinco minutos.
- La API vuelve a comprobar que el actor sea un `ADMIN` activo de la misma
  organización; la autorización de la Web no se considera suficiente por sí sola.
- Nueva ruta local `/admin/dito-imports`, disponible solamente para ADMIN desde
  la navegación de Ventas.
- Formulario XLSX con límite de 10 MB y mensaje explícito de que el análisis no
  modifica pedidos.
- Paneles para cargas recientes, métricas del lote, identidades pendientes,
  detalle por fila y confirmación intencionalmente deshabilitada.
- 18 pruebas enfocadas aprobadas en el módulo de importación, incluidas firma,
  expiración, rol administrativo, idempotencia y ausencia de mutación de pedidos.
- Interfaz revisada visualmente en local en vista móvil.
- Pendiente ejecutar la carga real desde la interfaz cuando la API local pueda
  reiniciarse con esta versión; no se publicó ningún cambio.
