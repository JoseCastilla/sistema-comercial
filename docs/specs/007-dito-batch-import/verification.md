# SPEC-007 — Verificación

**Estado:** `LOCAL_CONFIRMATION_VALIDATED`
**Fecha:** 2026-08-08

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

## Incremento 4 — Resolución y confirmación transaccional

- La pantalla ADMIN permite vincular una identidad DITO pendiente únicamente
  con un asesor activo que tenga un solo equipo principal activo.
- La vinculación usa control de versión y no permite remapear silenciosamente
  una identidad ya resuelta.
- La confirmación está protegida por la misma firma interna y vuelve a validar
  actor, organización y versión del lote.
- Todas las filas se reclasifican contra el estado actual de PostgreSQL dentro
  de una transacción; cualquier identidad pendiente o conflicto cancela todo el
  lote.
- Las ventas nuevas reciben asesor, equipo y el mismo cálculo inicial de SLA
  utilizado por las capturas de DITO. SPEC-015 separó posteriormente esta
  asignación del vínculo comercial.
- Los pedidos existentes solo reciben campos permitidos que sigan ausentes. El
  cambio genera `DitoOrderCorrection` y, cuando completa responsable/equipo,
  también `DitoOrderAssignmentHistory`.
- Una segunda confirmación de un lote confirmado devuelve su resumen y no crea
  ni actualiza pedidos otra vez.
- La interfaz muestra un único llamado a confirmar, explica por qué está
  bloqueado y, al finalizar, presenta creadas, completadas y sin cambios junto
  al administrador y la fecha.

## Evidencia automatizada del incremento 4

- 15 pruebas enfocadas de preview, clasificación y confirmación: aprobadas.
- 3 pruebas del contrato de resolución/confirmación: aprobadas.
- TypeScript en API y Web: sin errores.
- ESLint enfocado en API, Web y validación compartida: sin errores.
- Revisión visual local de `/admin/dito-imports`: carga inicial correcta y sin
  errores de consola.

## Pendiente de salida

- Ejecutar la carga real del archivo del 01/08 en local para revisar las cinco
  vinculaciones y el resumen final.
- Completar builds de contenedores antes de marcar T-041.
- No desplegar ni confirmar datos en producción hasta la aprobación explícita
  del resumen local.

## Incremento 5 — Cuenta DITO compartida

- `jcastilla` se registró localmente como cuenta de reserva permanente y no fue
  asociado globalmente con José Castilla.
- La vista previa detectó seis filas importables de esa cuenta y mantiene la
  confirmación bloqueada hasta identificar sus responsables.
- Las órdenes que ya tengan asesor y equipo confiables conservan esa asociación;
  la cuenta compartida no puede provocar una reasignación silenciosa.
- Las ventas restantes se muestran en un solo formulario por código de orden y
  permiten guardado parcial, utilizando únicamente asesores activos con un solo
  equipo principal activo.
- Cada resolución conserva asesor, equipo, administrador, fecha y motivo
  `SHARED_DITO_ACCOUNT` en la fila de importación.
- La confirmación vuelve a validar la membresía y el equipo dentro de la misma
  transacción antes de crear o enriquecer pedidos.
- Si el asesor cambia de equipo después de la resolución manual, la confirmación
  utiliza su único equipo principal activo vigente y sincroniza la fila pendiente;
  no conserva el equipo anterior ni obliga a repetir la asignación.
- Migración `20260809010000_add_shared_dito_import_assignment` aplicada y
  verificada únicamente en PostgreSQL local.
- 16 pruebas enfocadas de preview/clasificación/confirmación y 5 pruebas de
  contratos administrativos aprobadas.

## Incremento 6 — Origen explícito de portabilidad

- Los archivos de muestra completo y reducido no incluyen todavía la columna
  `Origen Portabilidad`; por ello no son una fuente segura para diferenciar
  prepago de postpago.
- El parser 1.1 acepta `PREPAGO`, `POSTPAGO` y sus variantes separadas por
  espacio, sin relacionarlas con el monto del plan.
- El cargo fijo continúa extrayéndose de `Plan Móvil`, por lo que S/29.90 y
  S/49.90 se reconocen sin alterar la clasificación comercial.
- Una portabilidad sin origen queda inválida; una alta nueva del mismo archivo
  no se bloquea por esa ausencia.
- Las vistas previas 1.0 que aún no fueron confirmadas deben regenerarse. Los
  lotes ya confirmados conservan su auditoría histórica.
- La tabla administrativa muestra la operación, el origen declarado y los
  motivos de cada fila inválida sin añadir acciones nuevas.
- 20 pruebas enfocadas del parser, clasificación y confirmación aprobadas.
- Tipos y lint de API/Web aprobados; la vista ADMIN local mostró el aviso de
  conciliación y “Portabilidad por revisar” para el lote histórico 1.0.
