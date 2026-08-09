# SPEC-007 — Importación controlada de pedidos DITO

**Estado:** `APPROVED`
**Versión:** 1.2
**Fecha:** 2026-08-06
**Fecha de aprobación:** 2026-08-06

## Problema

La bandeja de pedidos de DITO permite descargar un archivo XLSX con información
útil para recuperar ventas que no llegaron por la extensión. El archivo también
incluye columnas ajenas a la operación comercial, valores internos como `82`,
textos defectuosos como `Deliveryundefined`, códigos geográficos y códigos
numéricos de operador. Importarlo directamente podría crear pedidos inválidos,
duplicar ventas o asociarlas al asesor equivocado.

## Alcance inicial confirmado

- Archivo DITO con 33 registros del 01/08/2026.
- 30 pedidos `APROBADO` importables.
- 2 pedidos `CAIDA` y 1 `RECHAZADO` excluidos.
- 30 códigos de venta y 30 códigos de orden únicos dentro del subconjunto
  aprobado.
- La base local actual no contiene coincidencias por código de venta ni código
  de orden; producción se volverá a comprobar durante la vista previa.
- La plantilla reducida confirmada contiene 35 columnas útiles y se reconoce por
  encabezados. El archivo de muestra del 31/07/2026 solo define la plantilla y no
  forma parte de la carga solicitada del mes vigente.
- Catálogo de operador confirmado: `21 = CLARO`, `20 = ENTEL` y `24 = BITEL`.

## Reglas

- **BR-001:** solo un usuario `ADMIN` puede cargar y confirmar archivos.
- **BR-002:** la carga siempre genera una vista previa; analizar el archivo no
  modifica pedidos.
- **BR-003:** únicamente se importan filas con estado DITO `APROBADO`.
- **BR-004:** por defecto solo se aceptan pedidos del mes en curso según
  `America/Lima`; las filas fuera del período se excluyen y se informan.
- **BR-005:** la organización y el código de orden normalizado forman la regla
  principal de idempotencia; el código de venta actúa como control adicional.
- **BR-006:** si el código de orden no existe, la fila aprobada puede crear un
  pedido nuevo. Si ya existe, la fila se clasifica como candidata a
  enriquecimiento, no como pedido nuevo.
- **BR-007:** la plantilla se reconoce por nombres de encabezado, no por posición
  fija de columna.
- **BR-008:** `45`, `82`, `Deliveryundefined`, celdas vacías y textos equivalentes se
  tratan como ausentes únicamente en los campos donde DITO los utiliza como
  marcador.
- **BR-009:** la importación corrige caracteres mojibake conocidos antes de
  validar nombres y ubicaciones, conservando el valor fuente en la auditoría.
- **BR-010:** los códigos de provincia se convierten a nombres mediante un
  catálogo UBIGEO versionado; un código no resuelto bloquea la fila.
- **BR-011:** los códigos numéricos de operador usan el catálogo explícito
  `21 = CLARO`, `20 = ENTEL`, `24 = BITEL`; un código distinto queda en revisión.
- **BR-012:** `Usuario DITO` es la identidad externa estable del asesor. Un ADMIN
  lo vincula una vez con un usuario del Sistema Comercial y las cargas futuras
  reutilizan esa asociación.
- **BR-013:** una identidad DITO no puede apuntar a dos usuarios activos dentro de
  la misma organización.
- **BR-014:** si falta la vinculación del asesor, la fila queda bloqueada en la
  vista previa y no se degrada a una asociación ambigua por nombre.
- **BR-015:** se conserva auditoría del archivo, hash, actor, fecha, fila fuente,
  resultado y motivos de exclusión, sin almacenar las 88 columnas innecesarias.
- **BR-016:** los pedidos importados usan el mismo cálculo de SLA y las mismas
  reglas de calidad que las capturas de la extensión.
- **BR-017:** el enriquecimiento solo completa campos ausentes, placeholders o
  valores `UNKNOWN`; nunca reemplaza silenciosamente un dato válido existente.
- **BR-018:** si Excel y la orden existente contienen valores válidos diferentes,
  la vista previa muestra el conflicto y exige decisión administrativa. El
  sistema no escoge automáticamente una fuente.
- **BR-019:** el código de venta se usa para verificar el match. Si coincide el
  código de orden pero contradice un código de venta existente, la fila queda
  bloqueada para revisión.
- **BR-020:** `rawSummary` y los detalles originales de la extensión permanecen
  inmutables. Los campos completados se registran en una corrección con fuente
  `DITO_BATCH_IMPORT`, actor, lote y valores anterior/nuevo.
- **BR-021:** el estado operativo informado por Integratel no se modifica con el
  estado de la bandeja DITO. `APROBADO` autoriza la fila para importar, pero no
  cambia `OPEN`, `SENT`, `CLOSED` ni sus subestados.
- **BR-022:** la columna `Interior / Nro. Dpto` se ignora cuando repite el
  departamento o contiene un marcador conocido, evitando direcciones corruptas.
- **BR-023:** una identidad DITO solo puede confirmarse cuando el asesor está
  activo y pertenece a un único equipo principal activo. La asignación manual
  completa `agentUserId`, `assignedTeamId` y `matchStatus = LINKED` en conjunto.
- **BR-024:** antes de aplicar un lote, el servidor vuelve a clasificar todas las
  filas dentro de la transacción. Una identidad pendiente, un conflicto nuevo o
  una versión desactualizada cancela el lote completo.
- **BR-025:** una credencial DITO utilizada por varias personas se registra como
  cuenta compartida y nunca se vincula globalmente con un usuario. Una orden ya
  asociada conserva su responsable confiable; las demás se asignan manualmente
  por código de orden, con actor, fecha, equipo y motivo auditables.

## Campos importados

| Destino             | Columna DITO                                | Tratamiento                                   |
| ------------------- | ------------------------------------------- | --------------------------------------------- |
| Código de orden     | `Order ID Móvil`                            | Normalizar dígitos y presentar con sufijo `A` |
| Código de venta     | `Nro Pedido WC`                             | Conservar `FE-...`                            |
| Registro            | Fecha + hora de pedido                      | Interpretar en `America/Lima`                 |
| Asesor              | `Usuario DITO` + `Nombre de Usuario`        | Resolver por identidad externa                |
| Titular             | Nombre, tipo y número de documento          | Normalizar espacios y caracteres              |
| Número de servicio  | `Nro Servicio Móvil`                        | Solo dígitos                                  |
| Operación           | Operación + plan                            | Alta/portabilidad y prepago/postpago          |
| Operador cedente    | Código de operador                          | Catálogo explícito; vacío para alta nueva     |
| Cargo fijo          | `Plan Móvil`                                | Extraer monto cuando exista                   |
| Entrega             | `Método de Entrega`                         | Express o Regular 24 h                        |
| Ubicación           | Departamento, provincia y distrito          | Resolver provincia con UBIGEO                 |
| Dirección           | Componentes de vía y vivienda               | Componer sin marcadores internos              |
| Referencia          | Referencia + instrucciones útiles           | Limpiar y combinar sin duplicar               |
| Coordenadas         | X / Y                                       | X = latitud, Y = longitud                     |
| Correo del cliente  | `Email Cliente`                             | Conservar como detalle adicional normalizado  |
| Instrucciones       | `Instrucciones de Envío`                    | Conservar separadas de la referencia          |
| Evidencia de origen | Estado DITO, equipo, opción y tipo de carga | Conservar en el lote/detalle adicional        |

## Campos deliberadamente no importados

- score y consentimiento;
- IDs internos de +Simple, canal, entidad y punto de venta;
- campos de telefonía fija;
- datos de facturación, pago y financiamiento;
- columnas constantes o marcadores internos de DITO.

El archivo no aporta teléfono de contacto distinto, ciclo de facturación, último
día de pago ni rango horario para Express. En esos casos se usa el número de
servicio como contacto y los demás campos quedan vacíos, sin inventar datos.

## Criterios de aceptación

- **AC-001:** cargar el archivo analizado muestra 30 importables, 3 excluidos y
  cero duplicados internos.
- **AC-002:** ninguna fila se guarda antes de confirmar la vista previa.
- **AC-003:** caídos, rechazados, otros meses, duplicados y filas inválidas se
  muestran por separado con motivo legible.
- **AC-004:** el ADMIN puede resolver las cinco identidades DITO presentes antes
  de confirmar.
- **AC-005:** los pedidos del 01/08 conservan fecha y hora de Lima y aparecen en
  el período mensual vigente.
- **AC-006:** los 29 Express y 1 Regular 24 h calculan el SLA con las reglas
  existentes.
- **AC-007:** reimportar el mismo archivo crea cero pedidos nuevos.
- **AC-008:** un usuario no ADMIN no puede previsualizar ni confirmar cargas.
- **AC-009:** cada pedido creado puede rastrearse hasta lote, archivo y fila.
- **AC-010:** la importación no muestra `45`, `82`, `Deliveryundefined` ni caracteres
  mojibake en la interfaz.
- **AC-011:** una orden existente incompleta se compara por código de orden y la
  vista previa enumera exactamente los campos que pueden completarse.
- **AC-012:** una orden existente completa no cambia; cualquier diferencia válida
  se presenta como conflicto.
- **AC-013:** repetir un enriquecimiento ya aplicado no genera cambios ni una
  segunda corrección.
- **AC-014:** una cuenta compartida no permite confirmar mientras alguna fila
  importable carezca de responsable; guardar asignaciones parciales no altera
  órdenes ni obliga a completar todo en una sola sesión.
