# SPEC-030 — Verificación

**Estado:** `DRAFT`
**Fecha de análisis:** 2026-08-26

> **Alcance de esta evidencia.** Esta spec todavía no tiene código. Lo
> registrado abajo es el **análisis de la fuente real** que sustenta las reglas,
> no evidencia de implementación. La sección 4 queda abierta hasta que exista el
> primer incremento desplegable.

## 1. Fuente analizada

`C:\Users\NeuroHack\Desktop\Base\Base Diaria\Base_Consolidada_2026-08-26.xlsx`

| Propiedad      | Valor                                                        |
| -------------- | ------------------------------------------------------------ |
| Hoja           | `Base Consolidada`                                           |
| Columnas       | 42 (`A`–`AP`), encabezado en la fila 1                       |
| Filas de datos | 7 407                                                        |
| Origen         | ~68 archivos por punto de venta, consolidados por `merge.py` |

### Ventana de tres días confirmada

`Fecha de Registro de Pedido` cubre exactamente tres días:

| Fecha      | Filas |
| ---------- | ----- |
| 2026-08-23 | 664   |
| 2026-08-24 | 3 440 |
| 2026-08-25 | 3 303 |

Esta base de tres días es la **carga inicial**. En operación, la base diaria
trae solo los pedidos del día anterior (BR-009); el volumen recurrente esperado
es de ~3 000 a 3 500 filas por día, no 7 400.

## 2. Embudo de elegibilidad

Aplicando la configuración inicial de BR-011:

| Paso                                      | Filas     |
| ----------------------------------------- | --------- |
| Base consolidada                          | 7 407     |
| `Modalidad Origen` = `POST`               | 6 047     |
| + plan Máximo S/39.9 · 49.9 · 59.9 · 79.9 | 4 789     |
| + `Equipo Móvil` = `Simcard`              | 4 786     |
| + con `Nro Servicio Móvil` presente       | **4 786** |

Este es el volumen diario que hoy se trabaja en Excel y que sustenta las
decisiones de rendimiento del plan.

## 3. Distribuciones que fundamentan las reglas

### `Estado Pedido WC` — sustenta BR-027

| Valor     | Filas |
| --------- | ----- |
| APROBADO  | 6 604 |
| PENDIENTE | 441   |
| RECHAZADO | 316   |
| CAIDA     | 46    |

Ninguno de estos valores indica si el pedido está enviado o cancelado. Confirma
que el triage depende de una consulta externa manual, no de la base.

### `Plan Móvil` — sustenta BR-011

18 valores distintos. Los cuatro elegibles concentran 5 720 filas; el resto son
planes `Control` (1 487), `Movistar Total` y un `Máximo S/114.9` fuera de rango.

### `Modalidad Origen` frente a tipo de plan — sustenta BR-012

| Combinación    | Filas   |
| -------------- | ------- |
| POST · Abierto | 4 796   |
| POST · Control | 1 088   |
| PREP · Abierto | **934** |
| PREP · Control | 399     |

Las 934 filas `PREP` con plan `Abierto` demuestran que los dos criterios son
independientes y que filtrar por uno no implica el otro.

### `Equipo Móvil` — sustenta el carácter administrable de BR-010

| Valor                | Filas |
| -------------------- | ----- |
| Simcard              | 7 404 |
| XIAOMI REDMI NOTE 15 | 1     |
| IPHONE AIR           | 1     |
| IPHONE 17 PRO MAX    | 1     |

La presencia de equipos reales confirma que el filtro cambiará cuando el canal
habilite la venta de equipos, prevista para septiembre de 2026.

### Catálogo de cedentes y columnas sin valor — sustentan BR-015 y BR-016

- `Operador Cedente Móvil`: CLARO 3 161, ENTEL 2 256, BITEL 1 988 y 2 filas
  con `27`, que es **Guinea Mobile S.A.C.** — cedente válido del catálogo, no
  un dato degradado.
- `Estado Linea`: vacía en las 7 407 filas.
- `Operación Comercial Móvil`: `PORTABILIDAD` en el 100%.
- `Tipo Documento Cliente`: `DNI` en el 100%.
- `Validacion`: `True` en el 100%.

### Agrupación por cliente — sustenta BR-006 y BR-007

Las 4 786 filas elegibles corresponden a **4 492 clientes distintos** por DNI
normalizado:

| Servicios por cliente | Clientes |
| --------------------- | -------- |
| 1                     | 4 248    |
| 2                     | 208      |
| 3                     | 30       |
| 4                     | 4        |
| 5                     | 2        |

Un cliente puede traer dos o tres pedidos — hasta cinco servicios en esta base
— y además teléfonos de contacto alternos que `merge.py` conserva como filas
separadas. El sistema los une en un caso por cliente, con sus servicios y sus
teléfonos.

## 3b. Reporte de portabilidad analizado

`resultado_portabilidad - ejemplo.csv` — 1 392 números, CSV UTF-8 con BOM,
siete columnas: `numero`, `receptor`, `cedente`, `asignatario_original`,
`fecha_de_la_ventana`, `estado`, `numero_consultado`. Lo produce el script
local `consulta_multiple.py` a partir de `numeros.txt`.

| Clasificación                             | Números | Acción del sistema                               |
| ----------------------------------------- | ------- | ------------------------------------------------ |
| Portado, receptor Movistar                | 81      | Descarte `YA_ACTIVO`                             |
| Portado, receptor otro operador           | 521     | Oportunidad; habilitación = ventana + 30 días    |
| Programado → Movistar, con fecha          | 280     | `WAITING`: chip entregado, portará sin problemas |
| Programado → Movistar, sin fecha          | 13      | `WAITING` con revalidación al día siguiente      |
| Programado → otro operador                | 2       | Señal de competencia; agenda a ventana + 30      |
| No portado, línea de planta (sin ventana) | 254     | Antigüedad indeterminable; cadencia normal       |
| No portado, con historial de ventana      | 241     | Oportunidad con antigüedad conocida              |

El hallazgo central: los 293 números programados hacia Movistar responden solos
la pregunta del triage manual — ese cliente ya tiene un pedido avanzando y no
debe llamarse. La fecha visible separa la portación segura (280, chip
entregado) de la que puede fallar durante el día (13, se revalida mañana como
posible oportunidad). En esta muestra, el reporte automatiza cerca del 21% del
chequeo por DNI.

Existe además un **cruce rápido**: un filtro más veloz que solo responde si un
número está o no está en Movistar, sin fecha de portación. El sistema lo acepta
como segundo tipo de importación (BR-018b), útil para limpiar en volumen; el
reporte completo sigue siendo el único que decide esperas y habilitaciones.

## 4. Evidencia automatizada

**Fase 1 ejecutada en local el 26/08/2026**, con la base real del día cargada
de extremo a extremo por los servicios definitivos (API interna firmada con
HMAC, no por scripts ad hoc).

| Comprobación                                                 | Resultado                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Migración `20260826204540_add_national_base_recovery_phase1` | Aplicada; 29 migraciones al día                                                                                                 |
| `@repo/validation test`                                      | 145 pruebas, 16 nuevas del dominio de recupero                                                                                  |
| `tsc --noEmit` api y web                                     | Sin errores                                                                                                                     |
| `eslint --max-warnings 0` validation, api y web              | Sin errores                                                                                                                     |
| Previsualización de `Base_Consolidada_2026-08-26.xlsx`       | 7 407 leídas · 4 786 elegibles · 2 621 excluidas · 0 inválidas, en ~7 s — cumple AC-003                                         |
| Confirmación del lote                                        | **4 492 casos nuevos**, 4 786 filas aplicadas, ~104 s — cumple AC-004                                                           |
| Integridad                                                   | 4 780 servicios · 5 208 teléfonos · 4 786 avistamientos · 4 492 eventos · 244 casos multi-servicio (hasta 5 líneas por cliente) |
| Reimportación del mismo archivo                              | `reused: true`, sin duplicados — cumple AC-002                                                                                  |
| Guinea Mobile (`27`)                                         | Aceptado como cedente válido; 0 filas inválidas — cumple AC-006                                                                 |

Defectos encontrados y corregidos durante el uso real:

1. **Unicidad de teléfonos por caso.** Un teléfono de contacto igual al número
   de **otro** servicio del mismo cliente violaba la restricción. Se corrigió
   en el agrupador de dominio y con deduplicación al crear el caso; la
   confirmación interrumpida se reanudó desde los registros pendientes,
   validando el diseño de reanudación por bloques.
2. **Límite de acciones de servidor.** Subir el archivo desde la interfaz
   fallaba con `Body exceeded 1 MB limit`: Next.js limita el cuerpo de una
   acción de servidor a 1 MB y la base pesa 2,2 MB. Se configuró
   `serverActions.bodySizeLimit` en `next.config.js`. Era un defecto latente
   que también habría afectado a las importaciones DITO grandes, cuyo tope
   declarado es de 10 MB.

## 4b. Fase 2 — cruce de portabilidad (local, 26/08/2026)

Migración `20260827044435_add_recovery_portability_cross` aplicada. El reporte
real `resultado_portabilidad - ejemplo.csv` (1 392 filas, 1 255 números únicos)
se cruzó contra los 4 492 casos cargados.

| Comprobación               | Resultado                                                                |
| -------------------------- | ------------------------------------------------------------------------ |
| `@repo/validation test`    | 160 pruebas; 15 nuevas del dominio de portabilidad                       |
| Cobertura del cruce        | 997 de 1 255 números coincidieron con líneas de casos abiertos           |
| Duración                   | ~7 s                                                                     |
| Descartes `YA_ACTIVO`      | 68 líneas → **61 casos cerrados** (7 clientes conservan otra línea viva) |
| Esperas automáticas        | **290 casos** a `WAITING` sin intervención del supervisor                |
| Revalidación sin fecha     | 12 líneas marcadas para el reporte siguiente (BR-019e)                   |
| Habilitaciones agendadas   | 45 líneas con `ventana + 30 días`                                        |
| Líneas de planta           | 150 marcadas, antigüedad indeterminable (BR-040)                         |
| Reaplicar el mismo reporte | `reused: true`, sin volver a cruzar                                      |

Estado de la bandeja tras el cruce: 4 152 `TRIAGE`, 279 `WAITING`, 61
`DISCARDED`. Los eventos registrados son coherentes: 4 492 `CASE_CREATED`,
290 `PORTABILITY_WAITING` y 61 `CASE_DISCARDED`. Ningún caso quedó `LOST`, como
exige BR-019d: el sistema nunca declara una pérdida por sí solo en esta fase.

El dato operativo relevante: **351 casos salieron del trabajo manual** — 61
descartados y 290 en espera — sobre los 997 efectivamente consultados, es decir
un 35 % de la muestra cruzada. Con la base completa consultada, el efecto
esperado es proporcionalmente mayor.

## 4c. Revisión de lógica (27/08/2026)

Auditoría del módulo tras el primer uso operativo. Cuatro defectos encontrados
y corregidos:

1. **Enter en «Seleccionar los primeros» enviaba el formulario** con el primer
   botón — «Marcar en espera» — pudiendo marcar la selección entera por
   accidente. Ahora Enter ejecuta la selección y nunca envía.
2. **Selección fantasma tras aplicar una acción:** los casos que salían de la
   tabla seguían seleccionados y el siguiente clic actuaba sobre ellos. La
   selección se limpia con cada acción exitosa.
3. **El cruce pisaba la espera manual del supervisor:** un caso `WAITING`
   marcado a mano volvía a `TRIAGE` si el reporte devolvía «no portado». El
   rebote ahora ocurre solo cuando la espera la puso el propio cruce — el
   servicio venía `PROGRAMADO` — y una espera humana se respeta: el supervisor
   vio un pedido que el reporte no puede ver.
4. **La selección por rango con Shift no tenía pruebas.** Se extrajo a
   `computeRangeSelection` en `@repo/validation` con 6 pruebas: rango hacia
   adelante y atrás, deselección por rango, Shift sin ancla y clic fuera de la
   lista. Total del paquete: 166 pruebas en verde.

Pendiente de ejercitar con datos: reaparición sobre caso abierto y caso
sucesor (requieren la base de mañana), interfaz de triage y de cruce con
recorrido visual por rol — bloqueado en esta sesión porque la extensión de
navegador no estaba conectada y la creación de una sesión de prueba fue
descartada deliberadamente —, inclusión manual de excluidos y reversión de
descarte por `ADMIN` (no construidas).

## 5. Criterios del incremento

- La base del día se importa una sola vez y reimportarla no duplica casos.
- El cliente que ya portó desaparece de la bandeja en lugar de mostrarse
  marcado.
- Un cliente con teléfono alterno se trabaja como un caso, no como dos.
- El asesor nunca ve la agencia vendedora ni los datos de validación de
  identidad antes de registrar interés.
- Dos asesores no pueden trabajar el mismo caso.
- Un caso en espera reaparece al día siguiente salvo que ya haya portado.
- Un cliente que reaparece con un pedido nuevo no duplica su caso abierto; si
  su caso estaba resuelto, genera uno nuevo enlazado al anterior.
- Un caso agendado reaparece exactamente en la fecha acordada.
- Una línea sin los treinta días reaparece al inicio de la cola al habilitarse.
- Recuperar exige vincular una orden DITO confirmada por un humano.
- Perder exige un motivo estructurado.
- El supervisor conoce avance, cobertura y efectividad del día sin construir un
  reporte.

## 6. Riesgos

- **Volumen diario alto.** 4 786 casos por día se acumulan si la cadencia no se
  cumple. El tablero de cobertura es el control que lo hace visible; sin él, el
  sistema reproduce el problema del Excel con otra interfaz.
- **Triage manual.** El chequeo por DNI sigue siendo manual para los casos que
  el reporte de portabilidad no resuelve. La fase 1 lo acelera con marcado en
  lote y la fase 2 lo reduce con la espera automática de portaciones
  programadas, pero no lo elimina.
- **Datos personales de terceros.** La base contiene clientes de agencias
  ajenas. Las reglas BR-045 a BR-048 son obligatorias, no opcionales.
- **Dependencia de scripts locales.** La consolidación (`merge.py`) y la
  consulta de portabilidad (`consulta_multiple.py`) siguen fuera del sistema y
  sin trazabilidad. Ambas están registradas como trabajo futuro en el plan.

## 7. Fase 5 — Puerta interna, evidencia del 30/08/2026

### Automatizada

- [x] `pnpm run test` en `packages/validation`: **195 pruebas en verde**, con
      8 nuevas sobre `recovery-internal-gate` que cubren elegibilidad, los
      motivos reales del operador (promesa incorrecta, cliente ausente, deuda
      exigible, tiempo mínimo de porta, teléfono no en servicio, fuera de
      cobertura), la prioridad de cada uno, la fusión por prioridad máxima y
      el vencimiento de dos horas.
- [x] `prisma validate` y las dos migraciones aplicadas en local sin errores.
- [x] `pnpm run check-types` y `pnpm run lint` en `apps/web` sin errores.

### Garantías de base de datos

Ejercicio sobre la base local, dentro de una transacción revertida al final
(la base quedó intacta: 0 casos internos persistidos):

1. Un caso interno se crea con `source = INTERNAL_ORDER_STATE`,
   `status = ASSIGNED`, `priority = ALTA` y `entryReason = NO_ENTREGADO`,
   conservando orden origen, asesor y equipo originales.
2. Su evento `CASE_CREATED` queda escrito en la misma transacción.
3. **La idempotencia la garantiza la base, no solo el código:** el segundo
   caso abierto para la misma orden fue rechazado con
   `Unique constraint failed on the fields: (source_dito_order_id)`.

### Recorrido end to end — sesión ADMIN local, 30/08/2026 (tarde)

Se reprodujo el **caso de referencia `1942469714A`** (AC-052) desde la
interfaz real:

1. En `/orders?status=RECOVERY`, la orden muestra la observación del OL
   ("VALENTINA - MALA VENTA… no incluyen los beneficios que le ofrecieron en
   su contrato") y el panel "Enviar a recupero" (AC-047).
2. Se envió con motivo "Promesa comercial incorrecta" preservando el mensaje
   del OL en la observación.
3. El caso nació **Crítica · Sin responsable** — nunca asignado a Steven
   Lizarraga, el asesor originador (AC-048) — y la tarjeta del pedido pasó a
   mostrar el badge "En recuperación" en lugar del formulario (idempotencia
   visible).
4. `/recovery/sales` lo presenta con sus cuatro indicadores (1 abierto, 1
   crítica sin responsable), la atribución "Venta de Steven Lizarraga ·
   Huancayo" y **próxima acción a las 2 horas exactas** de la novedad
   (18:57 → 20:57, BR-066).

### Reasignación desde la bandeja — sesión ADMIN local, 30/08/2026 (noche)

Sobre el caso Crítico `1942469714A` creado en el recorrido anterior:

1. El selector "Asignar a…" lista los 13 vendedores activos — **Steven
   Lizarraga, el originador, no aparece** (BR-065 aplicado en la interfaz; el
   servidor lo rechaza además sin excepción de rol).
2. Asignado a Christian Ruiz (Huancayo): estado pasó a **Asignado**, el
   indicador "Críticas sin responsable" bajó de 1 a 0, el control cambió a
   "Reasignar a…" y la próxima acción se reinició a **2 horas exactas** del
   momento de asignación (19:06 → 21:06).
3. Auditoría en base de datos: `CASE_CREATED (MANUAL · CRITICA)` seguido de
   `ASSIGNED_TO_USER (OPEN → ASSIGNED)` con actor, destino, equipo y
   responsable previo.
4. Incidente de entorno documentado: el primer intento falló con
   `PrismaClientValidationError` porque el dev server conservaba en memoria el
   cliente anterior a la migración del enum; la transacción se revirtió
   completa (sin estado parcial) y tras reiniciar el server el flujo se
   completó. En producción no aplica: el deploy corre `migrate deploy` antes
   de arrancar el proceso nuevo.

### Intentos y resolución — 30/08/2026 (noche)

- [x] 197 pruebas de `validation` en verde, con la cadencia D1/D3/D7 y la
      pausa de 1–2 días cubiertas por casos nuevos.
- [x] Migraciones `add_recovery_case_attempts` y
      `add_recovery_case_resolved_event` aplicadas; tipos y lint limpios.
- [x] Mecánica verificada sobre la base local en transacción revertida
      (0 residuos): intento fija `firstContactAt` y pasa el caso a
      `IN_PROGRESS`; la resolución `LOST` escribe `CASE_RESOLVED`; y tras
      resolver, el índice parcial admite un caso sucesor para la misma orden.
- [x] Ficha `/recovery/sales/[caseId]` validada con el caso Crítico real:
      cabecera con prioridad, responsable, venta origen, teléfono de contacto
      y reloj; motivo con la observación del OL íntegra; formulario de
      intentos con los nueve resultados de BR-036; y el cierre `RECOVERED`
      correctamente **bloqueado** porque el cliente aún no tiene una orden
      nueva posterior al caso (BR-042 en acción).

### Compuertas de pérdida y SLA — 30/08/2026 (cierre del día)

- [x] 201 pruebas de `validation` en verde; las compuertas cubren el conteo
      de días en calendario de Lima (un intento a las 23:00 y otro a las
      04:00 UTC del día siguiente cuentan como un solo día de gestión).
- [x] **AC-034 (adaptado al carril interno) verificado en vivo:** con cero
      intentos, la ficha muestra los seis motivos con evidencia pendiente
      marcados ⏳ y la explicación de qué falta; al intentar cerrar
      `INUBICABLE` el servidor respondió "Exige 3 días distintos con 3 o más
      intentos sin respuesta cada uno; llevas 0" y el caso permaneció
      Asignado.
- [x] El sondeo `/api/order-escalations/notifications` devuelve
      `recoveryOverdue` con el alcance del rol; el aviso flotante aparece
      cuando existe al menos un caso interno con la próxima acción vencida.
      Comprobación natural pendiente: el caso real vence a las 21:06 del
      30/08 — si nadie lo gestiona, el aviso debe aparecer solo.

### Alcance por rol — verificación de datos, 30/08/2026

Simulación de las mismas cláusulas de alcance que aplica el código, sobre los
usuarios reales de la organización:

| Usuario            | Rol                            | Casos visibles      | Puede asignar | Ve "Enviar a recupero" |
| ------------------ | ------------------------------ | ------------------- | ------------- | ---------------------- |
| Alexandra Huaranca | AGENT (Ayacucho - Magisterial) | 0                   | No            | No                     |
| Erika Lavado       | SUPERVISOR (Huancayo)          | 1 (el caso Crítico) | Sí            | Sí                     |

- **BR-049 / AC-023 confirmado:** la asesora no ve la acción de envío a
  recupero, no puede asignar, y **abrir la ficha del caso por URL directa le
  devuelve 404** porque no es su responsable.
- La supervisora ve el caso porque tanto el equipo original como el asignado
  son Huancayo; su selector de destino se limita a los **4 vendedores de
  Huancayo** frente a los 14 que ve un ADMIN, y para este caso Crítico son
  **3**, porque Steven Lizarraga queda excluido por ser el originador
  (BR-065).
- Nota: Erika es supervisora **no vendedora** (`salesEnabled = false`), así
  que la regla del supervisor vendedor (BR-050b, auto-asignación) no puede
  ejercitarse con su cuenta; requiere un supervisor con venta habilitada.

### Recorrido con sesión AGENT real — 30/08/2026

Sesión de Alexandra Huaranca (AGENT, Ayacucho - Magisterial):

1. `/recovery/sales` muestra el alcance **"Mis casos"**, cero casos y el
   estado vacío: _"No hay ventas en recuperación. Las nuevas caídas
   aparecerán aquí solas."_
2. La navegación le ofrece **"Recupero de ventas"** y **no** "Base nacional"
   (BR-049), sin ítems administrativos.
3. Cero controles de asignación en la página (`canAssign = false`).
4. **Acceso directo a la ficha del caso ajeno devuelve 404**, no una página
   vacía ni un error de permisos: el dato no existe para ella.
5. En la bandeja ve sus 7 pedidos del mes; al expandir una tarjeta aparecen
   "Actualizar seguimiento" y "Datos de la venta", pero **ningún panel
   "Enviar a recupero"** (AC-023, BR-049 confirmados en pantalla).

### Recorrido con sesión SUPERVISOR real — 30/08/2026

Sesión de Erika Lavado (SUPERVISOR de Huancayo, no vendedora):

1. `/recovery/sales` muestra el alcance **"Mis equipos"** y **solo** el caso
   Crítico de Huancayo; no ve casos de otros equipos.
2. Navegación con **ambos carriles** ("Recupero de ventas" y "Base
   nacional") y sin ítems administrativos (Ventas, Logística, Personas,
   Equipos).
3. **AC-048 confirmado en pantalla:** el selector de destino ofrece
   exactamente **3 asesores de Huancayo** — Christian, Francesco y Sarai —.
   Steven Lizarraga, originador de la venta, **no figura**, y tampoco ningún
   asesor de otros equipos (un ADMIN ve 14).
4. Reasignación ejercida desde su sesión: el caso pasó a Francesco con el
   mensaje _"Su primer contacto vence en 2 horas"_ y el reloj reiniciado; se
   devolvió luego a Christian para conservar el escenario de prueba.
5. **Auditoría íntegra**: los cuatro eventos del caso conservan actor y
   transición — `CASE_CREATED` y la primera asignación por José, las dos
   reasignaciones por Erika —, y el intento registrado sobrevivió a ambas
   reasignaciones (BR-051, BR-044).

### Recorte del barrido diario — BR-082b, 02/09/2026

Origen: la operación reportó que "Revisión completa: últimos 3 días"
descargaba la base entera —2 179 líneas contra un cupo de 2 000 diarios en
el filtro rápido— cuando lo que necesita re-consultar es solo lo que
todavía puede cambiar.

1. **Regla pura probada**: 5 casos nuevos sobre `needsPortabilityRecross`
   —fecha pasada, fecha futura, portada a Movistar, programada sin fecha,
   los cuatro estados hacia otro operador, y la línea sin consultar—.
   244 pruebas en verde en `@repo/validation`.
2. **Tipos y lint** en verde en `apps/web`.
3. **Ruta ejercida en local (02/09/2026)** contra el servidor de
   desarrollo, con sesión ADMIN:
   - `?days=3&scope=recross` → 200, 2 050 números,
     `numeros_recupero_2026-09-02_barrido_3d_sin_movistar.txt`.
   - `?days=3` → 200, 2 050 números, nombre sin sufijo.
   - `?days=3&scope=recross&take=200` → 200, exactamente 200 números: el
     recorte no deja tandas cortas.
4. **Pantalla verificada sobre el DOM**: el botón anuncia
   "Revisión diaria: 2 050 número(s)" apuntando a `scope=recross`, y con
   cero excluidas ni el segundo botón ni la frase sobrante aparecen.

**Limitación declarada**: la base de desarrollo no tiene líneas en espera
(0 casos `WAITING`), así que el recorte no se ejerció contra datos que lo
activen — la exclusión está cubierta por la regla pura, no por el recorrido.
Al desplegar, el número que anuncia el botón es la comprobación: sobre la
base real de 2 179 líneas debe caer a ~1 280; si sigue en 2 179 significa
que las esperas no tienen fecha de ventana guardada y hay que revisar por
qué.

**Cabo suelto para el tercer criterio**: una línea programada hacia
Movistar con fecha **ya vencida** queda fuera de la descarga, pero su caso
sigue contando como `WAITING` en la bandeja. Se la trata como Movistar para
no consultarla y no se la cierra: si la portación se cayó el día de la
ventana, ese caso se queda sin que nadie lo mire. Cerrarlo es una decisión
de negocio pendiente, no un descuido de esta tarea.

### Triage operable sin ratón — 02/09/2026

Origen: un supervisor no podía tomar el número del cliente para consultarlo
en OSIPTEL, y la selección de filas era exclusivamente de ratón.

1. **Línea copiable**: verificado en el servidor de desarrollo con sesión
   ADMIN sobre 250 filas reales — cada fila expone su botón "Copiar Línea"
   junto al de "Copiar DNI", y al pulsarlo la fila **no** queda marcada (el
   control detiene la propagación del clic que selecciona al cliente).
2. **Teclado**: 17 pruebas de componente en `triaje-teclado.test.tsx` —
   el cursor y su recorrido, Espacio copiando el dato bajo el cursor,
   Shift + Espacio marcando al cliente, y el ratón conservando su
   semántica. 43 pruebas en verde en `apps/web`; lint y tipos limpios.
3. **Cursor visible** (02/09/2026, sobre el servidor de desarrollo): con
   `data-focused="true"` las celdas pintan `rgb(122, 162, 255)` en sombras
   internas —el token `--ui-accent` del tema oscuro— y sin el atributo el
   `box-shadow` calculado es `none`. La regla vive en `.ui-table`, no en la
   pantalla, porque es anatomía de tabla.

**Corregido el 02/09/2026 con el supervisor delante**: la primera versión
usaba Espacio para marcar y Shift + Espacio para extender el rango, y no
dibujaba cursor. Ninguna de las dos cosas servía: sin marca visible las
flechas navegaban a ciegas, y quien trabaja el triage necesita Espacio para
llevarse el dato a la consulta externa, no para marcar. Es la asimetría de
la hoja de cálculo: la tecla sola actúa sobre el dato, con Shift sobre la
fila entera.

**Limitación declarada**: el atajo no se ejerció con teclado real en la
aplicación —el panel de navegador disponible estaba oculto y no recibe
eventos de entrada—, sino sobre los mismos manejadores mediante pruebas de
componente. El copiado sí se ejerció con un clic real; el permiso de
portapapeles estaba denegado en ese panel, así que la confirmación visual
"✓ copiado" no se pudo observar ni en el DNI ya existente ni en la línea
nueva.

### Por qué el supervisor no podía enviar a espera — 02/09/2026

Reporte: «el supervisor vendedor no puede enviar datos a Espera; recibe
"Ninguno de los casos seleccionados podía cambiar a ese estado en tus
equipos"».

**El alcance no era el problema.** `SELLING_SUPERVISOR` guarda
`memberRole: SUPERVISOR` en `commercial_team_members`, así que
`resolveSupervisedTeamIds` lo encuentra igual que a un supervisor que no
vende, y la acción usa exactamente la misma consulta que la pantalla. Si ve
el caso, lo alcanza.

**El problema era el mensaje.** Una sola frase tapaba tres causas y
señalaba la equivocada. Con 1 048 casos en espera contra 627 por revisar en
producción, la bandeja de un equipo está dominada por casos que el cruce ya
puso en espera por BR-019b; marcarlos «en espera» no cambia nada y devolvía
un texto sobre permisos. Y la columna de estado, que lo habría revelado, se
escondía precisamente porque todas las filas coincidían.

1. **Pruebas**: 3 casos nuevos sobre la columna de estado —oculta con todo
   por revisar, visible con todo en espera, visible mezclado—. 46 en verde
   en `apps/web`; lint y tipos limpios.
2. **Pendiente de confirmar en producción**: el recuento nuevo dirá cuál de
   las tres causas es. Si responde «ya estaban en espera», era esto; si
   responde «no pertenecen a tus equipos», el caso está fuera de su bloque y
   hay que mirar la distribución, no los permisos.

**Limitación declarada**: la hipótesis no se pudo reproducir contra datos
—la base de desarrollo no tiene casos en espera— y el arreglo se apoya en
la lectura del código y en las cifras de producción. El mensaje diferenciado
es correcto en los tres casos, así que sirve tanto de arreglo como de
diagnóstico.

### Esperas que no volvían y lotes superpuestos — 02/09/2026

Dos hallazgos de la operación, analizados antes de tocar código.

**Las esperas eran perpetuas.** No eran tres días: era nunca. Rastreados
todos los caminos de salida de `WAITING`, solo el cruce devolvía casos, y
solo los que él mismo había puesto en espera y el reporte desmentía. Una
espera manual no cumplía ninguna de las dos condiciones, y tampoco vencía por
BR-084 porque sus líneas sí estaban consultadas. BR-082b, del día anterior,
lo empeoró para la portación programada con fecha: quedó sin re-consultar,
sin liberar y sin vencer.

**Los lotes superpuestos resucitaban lo descartado.** Con 1 354 casos
cerrados por ser Movistar, volver a subir la base completa —que repite las
filas del día anterior— habría creado un caso nuevo por cada uno, desde
pedidos ya resueltos, gastando además el cupo diario de la herramienta
externa. La clave única de avistamientos no podía impedirlo: actúa por caso,
y el caso nuevo tiene otro identificador.

1. **Pruebas**: 10 casos nuevos —7 sobre `shouldReleaseWaitingBaseCase` y 3
   sobre la ventana en `needsPortabilityRecross`, incluido el borde del
   mismo día—. 254 en verde en `@repo/validation`; monorepo completo en
   verde (pruebas, lint y tipos en los nueve paquetes).
2. **Decisiones del negocio, tomadas el 02/09/2026**: se acepta que un
   pedido lento se vuelva a marcar cada día antes que perder al cliente, y
   el caso liberado conserva su equipo.

**Confirmado en producción el 02/09/2026**, tras desplegar: los casos con
pedido en curso pasaron de 1 048 a 211, y el barrido diario anuncia 870
números dejando fuera solo 4 con fecha de portación por delante. La espera
dejó de ser perpetua.

**Descarga de los pedidos en curso** (`?scope=waiting`): ejercida en local
con sesión ADMIN — 200, `numeros_recupero_2026-09-02_pedidos_en_curso.txt`.
La base de desarrollo no tiene casos en espera, así que el archivo sale
vacío y el botón se oculta, que es el comportamiento previsto; el contenido
se verá en producción, donde debe traer las líneas de esos 211 casos.

**Limitación declarada**: ni la liberación ni la importación superpuesta se
ejercieron contra datos —la base de desarrollo no tiene casos en espera ni
lotes que se solapen—. Las reglas están cubiertas por pruebas puras; el
comportamiento sobre datos se verá al subir la base completa. Señal a mirar:
«clientes que ya estaban» debe absorber las filas repetidas y «casos nuevos»
contar solo lo que no se había subido.

### Ficha del cliente en la cola y resultado Cancelado — 03/09/2026

Origen: un asesor pidió ver los datos del lead sin salir de la cola, ver
padre/madre/nacimiento, sumar los resultados «cancelado», «no contesta» y «no
interesado», y volver a la bandeja al registrar.

1. **Despliegue en la cola**: verificado en el servidor de desarrollo con la
   sesión de un asesor sobre el caso real _CELIA ACEVEDO CHAMORRO_. "Ver
   datos" abre en la misma fila cuatro bloques —identidad (LORENZO /
   ADELAIDA / COLCABAMBA), teléfonos, dónde entregar (AV HUANCAVELICA 1380 ·
   UR CERCADO, referencia, indicaciones, enlace al mapa) y líneas a portar—
   con `location.pathname` sin cambiar. El botón alterna a "Ocultar datos" y
   lleva `aria-expanded` y `aria-controls`.
2. **Resultados**: el desplegable de la ficha ofrece los once valores con los
   nombres nuevos; «Cancelado (pausa 1–2 días)» aparece entre ellos. La
   migración `ALTER TYPE … ADD VALUE 'CANCELADO'` se aplicó en local con
   `prisma migrate deploy`.
3. **Color por resultado**: la fila del caso con último intento
   `SIN_RESPUESTA` lleva `data-result-tone="warning"` y el borde izquierdo en
   `--ui-warning`. El estado muestra «No contesta» debajo de «En gestión».
4. **Vuelta a la bandeja**: la cola renderiza el aviso `role="status"` con el
   texto recibido en `?intento=…` y las filas siguen visibles.

**Limitaciones declaradas**:

- **No se registró un intento real**: habría escrito en la base local, que
  es copia de producción. El envío (`router.push` al éxito) se verificó por
  tipos y lectura; en el navegador se verificó solo el lado receptor, con la
  URL construida a mano.
- **Dos de los tres resultados pedidos ya existían** con otro nombre
  (`SIN_RESPUESTA`, `RECHAZA`). Se renombraron en vez de duplicarlos; solo
  `CANCELADO` es un valor nuevo. Su semántica —pausar sin cerrar— es la
  reversible; si la operación lo quiere terminal, cambia en un solo sitio de
  `register-recovery-attempt-action.ts`.
- **Control antifraude retirado**: BR-046 se elimina por decisión de
  producto explícita tras exponer el riesgo. Lo que se pierde es la
  trazabilidad de quién vio qué y cuándo.
- **Deriva en la base local**: `prisma migrate dev` detectó tablas huérfanas
  (`mobile_debt_integrations`, `mobile_debt_lookup_events`) que el esquema ya
  no declara. No se tocaron; la migración se escribió a mano y se aplicó con
  `migrate deploy`, que no las afecta. Conviene confirmar si producción las
  tiene antes de cualquier `migrate dev` futuro.

### Pendiente de verificación

- **AC-046 y AC-049** end to end automático: exige provocar un cambio de
  estado real (`CANCELLED` / `NOT_DELIVERED`) sobre una venta local.
- **BR-050b** (supervisor vendedor no se autoasigna): Erika no tiene venta
  habilitada, así que la regla requiere una cuenta de supervisor vendedor.
- **AC-050** end to end exige una venta reingresada real del mismo cliente.
- **AC-051, AC-053 a AC-058** dependen de las fases 3 y 4, del retorno al
  pool y de las campañas.

## 8. Decisión

Pendiente. Los supuestos SA-001 a SA-005 están resueltos y la puerta interna
tiene su núcleo implementado y probado. La spec no avanza a
`READY_FOR_VALIDATION` hasta cerrar la interfaz de la fase 5 y las fases 3
y 4.
