# SPEC-030 — Recuperación sobre base nacional

**Estado:** `DRAFT`
**Versión:** 1.0
**Fecha:** 2026-08-26
**Responsable de producto:** José Castilla

## 1. Problema

Cada día se descarga la base de ventas gestionadas a nivel nacional con ventana
móvil de tres días. Esa base contiene clientes que iniciaron una portabilidad a
Movistar con cualquier agencia del canal y cuya venta todavía no se concretó:
son oportunidad comercial recuperable.

Hoy el proceso completo vive fuera del sistema, en Excel:

- un script local consolida los archivos por punto de venta;
- el supervisor filtra a mano modalidad, plan y equipo;
- exporta los números a otro sistema, descarga el reporte de quién ya es
  Movistar y lo cruza con `BUSCARV`;
- busca el DNI uno por uno en otro sistema para saber si el cliente ya tiene un
  pedido enviado;
- reparte la base a los asesores de MAGISTERIAL 02;
- el asesor registra sus llamadas en columnas del mismo archivo.

La base del 26/08/2026 trae **7 407 filas**, de las cuales **4 786 pasan los
filtros vigentes**. A ese volumen el proceso se rompe en tres puntos concretos:

- el cliente que ya portó sigue ocupando una fila marcada como activo, y a
  cuatro mil filas eso es ruido que cuesta esfuerzo comercial;
- el estado de contacto vive en celdas sin historial, así que no hay forma de
  saber si un cliente recibió los tres intentos exigidos;
- el supervisor no puede medir con rapidez el avance ni la efectividad de su
  equipo, porque el archivo no distingue trabajo hecho de trabajo pendiente.

## 2. Objetivo

Reemplazar el Excel por un flujo dentro del Sistema Comercial que ingiera la
base diaria, descarte automáticamente lo que ya no es oportunidad, entregue al
asesor solo trabajo real y permita al supervisor medir avance y efectividad sin
construir un reporte a mano.

## 3. Alcance

- Importación de la base consolidada del día, con previsualización,
  clasificación por fila y confirmación idempotente.
- Filtros de elegibilidad administrables desde la interfaz.
- Importación del reporte de portabilidad y cruce automático recurrente.
- Triage con marcado en lote de los casos que esperan resolución de un pedido
  ya enviado.
- Cola de trabajo por equipo con toma atómica y registro de intentos.
- Agenda de reingreso por antigüedad de portabilidad.
- Cierre del caso con venta vinculada o pérdida con motivo estructurado.
- Tablero de avance y efectividad para supervisión.

### Fuera de alcance

- Consolidar los archivos por punto de venta. El sistema recibe la base ya
  consolidada; absorber `merge.py` queda registrado como trabajo futuro.
- Consultar automáticamente si un cliente tiene un pedido enviado. Ese chequeo
  sigue siendo manual y el sistema solo registra su resultado.
- Consultar automáticamente la portabilidad. El reporte se sigue generando
  fuera y se importa.
- Escribir hacia DITO, hacia la plataforma del canal o hacia cualquier fuente
  externa.
- Modificar órdenes DITO existentes a partir de lo que informe la base nacional.

## 4. Reglas de negocio

### Ingesta

- **BR-001:** la base se importa como archivo `.xlsx` con la estructura de
  `Base Consolidada`: 42 columnas, encabezado en la primera fila. El archivo se
  identifica por `sha256`; reimportar el mismo archivo no duplica registros.
- **BR-002:** de las columnas `A`–`M` el sistema lee únicamente `I`
  (`Fecha de Registro de Pedido`) y `J` (`Hora de Registro de Pedido`). Las
  columnas `A`–`H`, que identifican a la agencia vendedora, y `K`–`M`
  (`Score`, `Estado`, `Estado Linea`) se descartan en el parseo y no se
  almacenan.
- **BR-003:** las columnas `N`–`AP` son los datos del cliente y de la operación,
  y constituyen el material de trabajo comercial.
- **BR-004:** `Fecha de Registro de Pedido` es la fecha comercial del caso y
  gobierna la antigüedad. Ninguna otra fecha la reemplaza.
- **BR-005:** el contenido original de las columnas que el sistema lee (`I`,
  `J` y `N`–`AP`) se conserva íntegro como evidencia inmutable, incluso cuando
  la fila resulta excluida por filtros.

### Identidad y deduplicación

- **BR-006:** la identidad estable de un caso es el **cliente**:
  `Nro Documento Cliente` normalizado a ocho dígitos con relleno de ceros. Un
  cliente tiene como máximo un caso abierto, aunque traiga dos o tres pedidos.
  En la base del 26/08, las 4 786 filas elegibles corresponden a 4 492
  clientes; 244 traen más de un servicio.
- **BR-007:** cada `Nro Servicio Móvil` del cliente es un **servicio del
  caso**: una línea que quiere cambiar. Cada `Telf. Contacto` distinto de un
  servicio es un **teléfono de contacto** del caso. La base consolidada trae
  estas combinaciones como filas separadas; el sistema las une bajo un solo
  caso donde se entiende qué servicios quiere portar el cliente y por qué
  números contactarlo. Los teléfonos se normalizan a nueve dígitos retirando
  el prefijo `51`.
- **BR-008:** una fila sin DNI o sin número de servicio no genera caso y se
  reporta como inválida con su motivo.
- **BR-009:** la cadencia de carga es: **una única base inicial** con los tres
  días de antigüedad, y a partir de entonces **una base diaria solo con los
  pedidos del día anterior**. La base es un flujo de entrada de pedidos, no un
  refresco del estado de los casos: que un cliente no vuelva a aparecer es lo
  normal y no cierra ni degrada ningún caso.
- **BR-009b:** un cliente puede registrar más de un pedido de portabilidad en
  días distintos y con agencias distintas — hoy uno que se cancela, mañana
  otro que no recibe por ausencia. Cada aparición del cliente en un lote se
  registra como un **avistamiento** con su fecha de registro:
  - si el cliente tiene un caso abierto, el avistamiento se anota en el caso
    sin cambiar su estado; la ficha lo muestra como señal de que otra agencia
    volvió a gestionar al cliente, y el cruce de portabilidad decide el resto;
  - si su caso está resuelto (`RECOVERED`, `LOST` o `DISCARDED`), se crea un
    caso nuevo enlazado al anterior, que entra al triage con el historial del
    previo accesible;
  - un mismo pedido importado dos veces por lotes superpuestos no duplica
    avistamientos: la identidad del avistamiento es cliente, servicio y fecha
    de registro.

### Elegibilidad

- **BR-010:** los filtros de elegibilidad son configuración editable por `ADMIN`
  desde la interfaz, nunca constantes en código. La configuración vigente al
  momento de confirmar un lote queda registrada con él.
- **BR-011:** la configuración inicial es: `Modalidad Origen` = `POST`;
  `Plan Móvil` dentro del conjunto `Abierto Movistar Libre Plan Movistar Maximo
  S/39.9`, `S/49.9`, `S/59.9`, `S/79.9`; `Equipo Móvil` = `Simcard`.
- **BR-012:** `Modalidad Origen` y tipo de plan son criterios independientes.
  En la base del 26/08 hay 934 filas `PREP` con plan `Abierto`, de modo que
  filtrar por uno no implica el otro.
- **BR-013:** la inclusión manual de prepago es una excepción explícita del
  supervisor sobre casos concretos, con actor y motivo registrados. No se
  resuelve cambiando el filtro global.
- **BR-014:** una fila excluida por filtros se conserva en el lote con su motivo
  de exclusión y puede incorporarse después si la configuración cambia, sin
  reimportar el archivo.
- **BR-015:** el sistema valida `Operador Cedente Móvil` contra un catálogo
  administrable que contiene los valores **tal como los emite la base**. El
  catálogo inicial es `CLARO`, `ENTEL`, `BITEL` y `27` — este último es Guinea
  Mobile S.A.C., que la fuente identifica por código y no por nombre. Un valor
  fuera del catálogo marca la fila como inválida. Si una base futura escribe
  el nombre en lugar del código, se agrega esa forma al catálogo; un operador
  nunca se lista dos veces.
- **BR-016:** `Estado Linea` llega vacía en el 100% de las filas y no participa
  de ninguna regla.

### Portabilidad

- **BR-017:** el sistema exporta la lista de números de los casos abiertos para
  alimentar la consulta externa de portabilidad, e **importa el reporte de
  resultado**. Los casos `WAITING` cuentan como abiertos y siguen incluidos en
  la exportación hasta ser descartados. El cruce reemplaza al `BUSCARV` manual.
- **BR-018:** existen dos tipos de reporte y la importación distingue cuál se
  está subiendo. El **reporte completo** es el CSV de la consulta a
  `consulta.portabilidad.pe`, con siete columnas conocidas: `numero`,
  `receptor`, `cedente`, `asignatario_original`, `fecha_de_la_ventana`,
  `estado` y `numero_consultado`; `estado` toma tres valores: `Número
  portado`, `Número no portado` y `Número programado para portación`. El
  sistema valida el encabezado al subir y conserva cada fila cruda como
  evidencia.
- **BR-018b:** el **cruce rápido** es un filtro más veloz que solo indica si un
  número está o no está en Movistar, sin fecha de portación. Se importa
  mapeando la columna del número al subir y produce únicamente descartes
  `YA_ACTIVO`: nunca genera esperas, habilitaciones ni fechas. Los dos tipos
  de reporte conviven; el rápido limpia, el completo decide.
- **BR-019:** un servicio `Número portado` cuyo receptor es Movistar
  (Telefónica del Perú, código `22`) queda descartado con motivo `YA_ACTIVO`.
  Cuando todos sus servicios quedan descartados, el caso se cierra —
  `DISCARDED` si no tuvo gestión, o `LOST` según BR-059 si ya la tuvo — y
  **sale de la bandeja**: no se muestra marcado ni se vuelve a consultar.
- **BR-019b:** un servicio `Número programado para portación` hacia Movistar
  **con fecha de ventana visible** indica que el chip ya se entregó y la
  portación debería completarse sin problemas. El caso pasa a `WAITING`
  automáticamente, sin intervención del supervisor: es el mismo criterio del
  chequeo manual de pedido enviado, resuelto por el reporte. En la muestra
  analizada, 280 de 1 392 números están en esta condición.
- **BR-019e:** un servicio `Número programado para portación` hacia Movistar
  **sin fecha visible** puede sufrir un error de portación durante el día. El
  caso queda `WAITING` solo por ese día, con el servicio marcado para
  revalidación: se incluye en la siguiente exportación de números y, si el
  siguiente reporte lo devuelve como no portado, el caso vuelve al triage como
  oportunidad de venta. Si aparece con fecha o portado, sigue su curso normal.
  En la muestra, 13 números están en esta condición.
- **BR-019c:** un servicio `Número programado para portación` hacia otro
  operador indica que el cliente se está yendo con la competencia. El servicio
  queda señalado y su habilitación se agenda para `fecha_de_la_ventana` más
  treinta días, cuando la línea vuelve a ser portable.
- **BR-019d:** un servicio `Número portado` hacia otro operador hace menos de
  treinta días fija automáticamente su habilitación en `fecha_de_la_ventana`
  más treinta días. Ninguna señal de un operador distinto de Movistar cierra
  un caso como perdido; la única pérdida automática del sistema es la de
  BR-059, respaldada por evidencia del reporte.
- **BR-020:** el cruce se ejecuta sobre todos los casos abiertos en cada
  importación de reporte, no solo sobre los del lote del día. Un cliente que
  porta el jueves deja de llamarse el jueves.
- **BR-021:** el descarte por portabilidad es reversible solo por `ADMIN`, con
  motivo registrado, para corregir un reporte equivocado.

### Triage

- **BR-022:** un caso recién creado entra en `TRIAGE`, sin responsable y sin ser
  visible para los asesores.
- **BR-022b:** el triage puede repartirse: `ADMIN` y `BACKOFFICE` asignan
  bloques de casos en `TRIAGE`, `WAITING` u `OPEN` a un equipo, y el
  supervisor de ese equipo ve **solo su base** en el triage — la filtra y
  luego la reparte entre sus asesores. Un supervisor no puede mover casos
  entre equipos ni ver el triage de equipos ajenos. La entrega del bloque
  queda registrada con actor, equipo y equipo previo.
- **BR-023:** el chequeo de si el cliente ya tiene un pedido enviado es manual.
  La bandeja de triage permite marcar en lote, sobre los casos seleccionados,
  el resultado `EN_ESPERA` o `LIBERADO`, registrando actor y fecha.
- **BR-024:** un caso `EN_ESPERA` conserva su estado `WAITING`, no se asigna y
  reaparece en la revisión del día siguiente.
- **BR-025:** un caso `WAITING` cuyos servicios aparecen luego portados a
  Movistar se cierra como `DISCARDED` y no vuelve a revisarse.
- **BR-026:** un caso `LIBERADO` pasa a `OPEN` y queda disponible para asignar.
- **BR-027:** `Estado Pedido WC` no indica si el pedido está enviado o
  cancelado. Sus valores son `APROBADO`, `PENDIENTE`, `RECHAZADO` y `CAIDA`, y
  se conservan como contexto sin decidir el triage por sí solos.

### Asignación

- **BR-028:** la asignación opera **en lote** sobre una selección de casos
  `OPEN`, en cuatro modos:

  | Modo | Qué hace |
  |---|---|
  | **Directa** | La selección (p. ej. 50 casos) se asigna a un asesor específico, de cualquier equipo dentro del alcance del actor |
  | **Equitativa en un equipo** | La selección se reparte pareja entre los asesores elegibles del equipo |
  | **Manual entre equipos** | La selección se divide en sub-lotes con cantidad por equipo; cada sub-lote se asigna dentro de su equipo por cualquiera de los otros modos |
  | **Cola del equipo** | La selección pasa al pool del equipo sin nominar asesor; la toma es atómica: cuando un asesor acepta un caso, deja de estar disponible para los demás |

- **BR-028b:** al distribuir equitativamente, la interfaz muestra los asesores
  **activos con venta habilitada** del equipo, todos preseleccionados. El
  supervisor deselecciona a quienes no trabajan ese día — ausencia, descanso,
  tardanza — y la distribución alcanza solo a los seleccionados. El registro
  del lote guarda quiénes participaron y quiénes fueron excluidos.
- **BR-028c:** el reparto equitativo garantiza una diferencia máxima de **un
  caso** entre asesores. La selección se reparte en ronda respetando el orden
  de prioridad de la cola, de modo que cada asesor reciba una mezcla
  equivalente de casos urgentes y normales — no un bloque de buenos para uno y
  el remanente para otro. El residuo se entrega a los asesores con menos casos
  abiertos.
- **BR-029:** el alcance del actor delimita el destino: `ADMIN` y `BACKOFFICE`
  asignan hacia cualquier equipo y asesor de la organización; `SUPERVISOR`
  solo dentro de sus equipos autorizados. Asignar un caso a un asesor lo
  coloca en el equipo de ese asesor para efectos de visibilidad.
- **BR-029b:** un asesor ve sus casos asignados y la cola de su propio equipo.
  No puede tomar casos de otro equipo ni reasignarse casos ajenos.
- **BR-030:** la reasignación de un caso ya asignado corresponde a
  `SUPERVISOR` dentro de sus equipos y a `ADMIN` en toda la organización, y
  conserva historial con actor y motivo.
- **BR-030b:** los casos asignados **sin gestión** de un asesor pueden
  redistribuirse en lote — el escenario típico: el asesor no vino y sus leads
  del día quedarían muertos. El supervisor selecciona los no trabajados de ese
  asesor y los reasigna por cualquiera de los modos; cada caso conserva el
  historial de su asignación previa. Un caso con gestión iniciada se reasigna
  individualmente por BR-030, no en lote.

### Cadencia y contacto

- **BR-031:** la cadencia es configuración por fuente de entrada, no una regla
  única del sistema. La fuente `NATIONAL_BASE` usa la cadencia de esta spec; la
  fuente `INTERNAL_ORDER_STATE` usará la cadencia de SPEC-026.
- **BR-032:** un caso sin respuesta exige un **mínimo de tres intentos en el
  mismo día**. El sistema cuenta los intentos del día y señala los casos que no
  alcanzan el mínimo.
- **BR-033:** un cliente que manifiesta no querer el servicio se pausa entre uno
  y dos días, según lo que elija el asesor, y reaparece automáticamente al
  vencer la pausa.
- **BR-034:** un cliente que agenda fija una fecha y hora de próxima llamada. El
  caso queda `SCHEDULED`, suspende la cadencia y reaparece exactamente en la
  fecha acordada.
- **BR-035:** cada intento registra canal, resultado tipificado, teléfono
  utilizado, observación, actor y momento. Un intento registrado es inmutable.
- **BR-036:** el resultado tipificado pertenece al conjunto `SIN_RESPUESTA`,
  `INTERESADO`, `RECHAZA`, `AGENDA`, `NUMERO_ERRADO`, `NO_CUMPLE_30D`,
  `YA_ACTIVO`, `DATOS_INVALIDOS`, `VENDIDO`.

### Antigüedad de portabilidad

- **BR-037:** una línea necesita treinta días desde su última portación para
  volver a portar. Para una línea que ya portó, la fecha sale de
  `fecha_de_la_ventana` del reporte de portabilidad y la habilitación se
  calcula sola. Para una línea de **planta** — que nació en su operador y no
  tiene fecha de portación inicial, reconocible en el reporte por carecer de
  fecha de ventana — la antigüedad no es determinable desde ninguna fuente.
- **BR-038:** el asesor también puede registrar la fecha manualmente cuando la
  obtiene del cliente. En ambos casos el sistema calcula la fecha de
  habilitación y coloca el caso en `SCHEDULED` hasta entonces.
- **BR-039:** al llegar la fecha de habilitación el caso reaparece **al inicio
  de la cola**, por encima de los casos nuevos, porque su ventana de
  oportunidad es más corta.
- **BR-040:** una línea de planta, o un caso sin fecha de antigüedad conocida,
  se trabaja con la cadencia normal. La ausencia del dato nunca detiene la
  gestión.

### Cierre

- **BR-041:** un caso se resuelve como `RECOVERED`, `LOST` o `DISCARDED`.
  Ningún caso se cierra automáticamente por inactividad.
- **BR-042:** resolver como `RECOVERED` exige vincular la nueva orden DITO. El
  sistema sugiere la orden por documento y número de servicio, y la asociación
  **requiere confirmación humana**, conforme al límite vigente de la plataforma.
- **BR-043:** resolver como `LOST` exige un motivo estructurado del conjunto
  `YA_MIGRO_OTRA_AGENCIA`, `RECHAZO_DEFINITIVO`, `INUBICABLE`, `DEUDA`,
  `DATOS_INVALIDOS`, `NO_PORTABLE`, `OTRO`.
- **BR-044:** la venta recuperada se atribuye al asesor que la cerró. El caso
  conserva el historial completo de quién lo trabajó antes.

### Salida a perdido

- **BR-057:** declarar `LOST` es siempre una decisión del asesor asignado o de
  su supervisor, nunca del sistema — con una sola excepción respaldada por
  evidencia (BR-059). Cada motivo se habilita únicamente cuando su criterio se
  cumple; mientras no se cumpla, el motivo aparece deshabilitado con la
  explicación de qué falta:

  | Motivo | Criterio que lo habilita |
  |---|---|
  | `INUBICABLE` | Al menos **tres días distintos de gestión** con **tres o más intentos cada uno**, todos `SIN_RESPUESTA`, cubriendo **todos los teléfonos** del caso |
  | `RECHAZO_DEFINITIVO` | **Dos rechazos en días distintos** con la pausa de BR-033 cumplida entre ambos; o solicitud expresa del cliente de no ser contactado, que lo habilita de inmediato con observación obligatoria |
  | `DEUDA` | Al menos un contacto efectivo y deuda confirmada **sin fecha de solución**; si el cliente da una fecha, corresponde agenda, no pérdida |
  | `DATOS_INVALIDOS` | **Todos** los teléfonos del caso marcados `NUMERO_ERRADO` |
  | `NO_PORTABLE` | Rechazo de portabilidad confirmado sin fecha de habilitación determinable |
  | `YA_MIGRO_OTRA_AGENCIA` | Evidencia del reporte (BR-059) o confirmación del cliente registrada en un intento |
  | `OTRO` | Observación obligatoria **y aprobación del supervisor** |

- **BR-058:** al **séptimo día de gestión** desde la asignación, un caso sin
  venta ni agenda vigente entra en **resolución obligatoria**: se señala en la
  bandeja del asesor y del supervisor, y exige resolver o agendar con fecha
  concreta. Si el asesor no actúa ese día, el caso escala al supervisor, quien
  resuelve o reasigna. El caso nunca se cierra solo: BR-041 se mantiene.
- **BR-059:** un servicio portado a Movistar es terminal siempre, pero su
  clasificación depende del esfuerzo comercial invertido: un caso **sin
  intentos registrados** se cierra `DISCARDED` con motivo `YA_ACTIVO` y no
  cuenta como pérdida (BR-056); un caso **con intentos registrados** se cierra
  `LOST` con motivo `YA_MIGRO_OTRA_AGENCIA` automáticamente, con el reporte
  como evidencia, y alimenta la métrica de pérdidas frente a otras agencias
  por asesor. Es la única pérdida que el sistema declara solo, porque el hecho
  ya ocurrió y es verificable.
- **BR-060:** una pausa (BR-033) o una agenda (BR-034) **no** son salidas de la
  bandeja: retiran el caso de la cola del día y lo devuelven en la fecha
  acordada. Las únicas salidas definitivas son `RECOVERED`, `LOST` y
  `DISCARDED`; la reasignación solo cambia al responsable.

### Datos sensibles

- **BR-045:** `Papa`, `Mama` y `Nacimiento` son datos de validación de
  identidad del titular y permanecen **ocultos** en la bandeja y en la ficha
  del caso. La columna `Validacion` indica si la identidad ya fue validada:
  solo un caso con `Validacion = false` requiere validarla con estos campos.
- **BR-046:** se revelan al asesor asignado únicamente cuando el caso requiere
  validación (`Validacion = false`) y después de registrar un intento con
  resultado `INTERESADO`. Cada revelación queda auditada con actor, caso y
  momento. En un caso ya validado, los campos no se muestran nunca.
- **BR-047:** estos campos nunca se incluyen en exportaciones, listados ni
  respuestas que no sean la ficha del caso ya revelado.
- **BR-048:** la base nacional contiene datos personales de clientes que no son
  de la organización. El acceso se limita a los roles con alcance sobre el caso
  y toda consulta aísla primero por organización.

### Antifraude

- **BR-049:** un asesor no puede crear, liberar ni descartar casos. Esas
  acciones corresponden a `SUPERVISOR`, `BACKOFFICE` y `ADMIN`.
- **BR-050:** un supervisor vendedor no puede tomar de la cola compartida un
  caso que él mismo liberó del triage.
- **BR-050b:** un supervisor vendedor no puede **auto-asignarse casos por
  selección directa** — elegir cuáles es exactamente la puerta a quedarse con
  los mejores leads. Sí puede incluirse en la distribución equitativa de su
  equipo, porque ahí el sistema decide qué recibe cada quien; su inclusión
  queda registrada. `ADMIN` sí puede asignarle casos nominalmente.
- **BR-051:** toda transición de estado, asignación y resolución deja registro
  con actor, momento y valores previos.

### Medición

- **BR-052:** el tablero de supervisión responde tres preguntas del día: cuánto
  se avanzó, con qué cobertura y con qué efectividad.
- **BR-053:** avance se mide como casos asignados, trabajados, sin primer
  contacto y con agenda vencida.
- **BR-054:** cobertura se mide como porcentaje de casos con tres o más intentos
  en el día, según BR-032.
- **BR-055:** efectividad se mide por asesor como contactados, recuperados y
  perdidos por motivo.
- **BR-056:** los descartes por portabilidad se reportan como contador del lote
  y nunca como casos perdidos, porque no representan esfuerzo comercial fallido.
- **BR-056b:** el objetivo comercial del módulo es convertir entre el **3 % y
  el 6 %** de los casos elegibles de cada cohorte diaria. El tablero muestra la
  tasa de recuperación de cada cohorte contra ese rango — por debajo del 3 %
  es señal de alerta, dentro del rango es operación sana. La cohorte se mide
  por fecha de creación del caso y los descartes por portabilidad se excluyen
  del denominador (BR-056): la conversión se mide sobre oportunidad real. Para
  la carga inicial del 26/08 (4 492 casos), el rango objetivo es de 135 a 270
  ventas recuperadas.

## 5. Criterios de aceptación

- **AC-001:** subir la base del día genera una previsualización con total de
  filas, elegibles, excluidas por cada filtro e inválidas, sin crear casos.
- **AC-002:** confirmar el lote crea los casos elegibles; reimportar el mismo
  archivo no duplica ninguno.
- **AC-003:** con la base del 26/08/2026 y la configuración inicial, la
  previsualización reporta 7 407 filas leídas y 4 786 elegibles.
- **AC-004:** un cliente con dos pedidos y un teléfono de contacto adicional
  produce **un** caso con dos servicios y sus teléfonos, no varios casos. Con
  la base del 26/08, los casos creados son 4 492, no 4 786.
- **AC-005:** cambiar la configuración de filtros no altera lotes ya
  confirmados, y la configuración usada queda visible en cada lote.
- **AC-006:** una fila con `Operador Cedente Móvil` fuera del catálogo se
  reporta como inválida y no genera caso; el código `27` (Guinea Mobile) es
  válido y no se rechaza.
- **AC-007:** exportar la lista de números de casos abiertos produce un archivo
  apto para la consulta externa de portabilidad.
- **AC-008:** importar el reporte de portabilidad descarta los casos ya activos,
  informa cuántos descartó y esos casos desaparecen de la bandeja del asesor.
- **AC-009:** el cruce alcanza también a casos abiertos de lotes anteriores, no
  solo a los del día.
- **AC-010:** la bandeja de triage permite seleccionar varios casos y marcarlos
  en lote como `EN_ESPERA` o `LIBERADO` en una sola acción.
- **AC-011:** un caso `EN_ESPERA` no es visible para ningún asesor y reaparece
  en la revisión del día siguiente.
- **AC-012:** un caso `EN_ESPERA` que luego aparece como portado se cierra solo
  y deja de reaparecer.
- **AC-013:** dos asesores del mismo equipo no pueden tomar el mismo caso; el
  segundo recibe un mensaje explícito y el caso no cambia de responsable.
- **AC-014:** registrar un intento `SIN_RESPUESTA` mantiene el caso activo y el
  contador del día refleja el intento.
- **AC-015:** un caso con menos de tres intentos en el día aparece señalado en
  la vista de supervisión.
- **AC-016:** registrar `RECHAZA` con pausa de dos días retira el caso de la
  cola y lo devuelve al vencer la pausa.
- **AC-017:** registrar `AGENDA` con fecha futura deja el caso `SCHEDULED` y lo
  devuelve exactamente en esa fecha.
- **AC-018:** registrar la antigüedad de la línea coloca el caso en espera hasta
  su fecha de habilitación, y al llegar aparece al inicio de la cola.
- **AC-019:** resolver como `RECOVERED` sin vincular una orden DITO es
  rechazado; la sugerencia por documento y servicio requiere confirmación.
- **AC-020:** resolver como `LOST` sin motivo estructurado es rechazado.
- **AC-021:** un asesor ve `Papa`, `Mama` y `Nacimiento` solo en un caso con
  `Validacion = false` y tras registrar un intento `INTERESADO`; en un caso ya
  validado nunca se muestran; cada revelación queda auditada.
- **AC-022:** ninguna exportación incluye esos tres campos.
- **AC-023:** un asesor no puede liberar, descartar ni reasignar casos.
- **AC-024:** el tablero muestra avance, cobertura y efectividad del día por
  asesor, y los descartes por portabilidad no figuran como pérdidas.
- **AC-025:** las columnas `A`–`H` y `K`–`M` no se almacenan; ninguna vista ni
  exportación puede contenerlas.
- **AC-026:** importar un reporte completo con servicios programados hacia
  Movistar **con fecha visible** deja esos casos `WAITING` sin intervención
  manual, y el resultado informa cuántos.
- **AC-029:** un servicio programado **sin fecha visible** queda `WAITING` con
  marca de revalidación, aparece en la siguiente exportación y, si el nuevo
  reporte lo devuelve como no portado, el caso vuelve al triage.
- **AC-030:** importar un cruce rápido descarta los números ya activos y no
  modifica esperas, habilitaciones ni fechas de ningún caso.
- **AC-031:** un lote diario que trae a un cliente con caso abierto registra el
  avistamiento sin duplicar el caso, y la ficha muestra la señal con su fecha.
- **AC-032:** un cliente con caso resuelto que reaparece genera un caso nuevo
  enlazado al anterior, con el historial del previo accesible desde la ficha.
- **AC-033:** importar dos lotes con fechas superpuestas no duplica
  avistamientos ni casos.
- **AC-034:** el motivo `INUBICABLE` aparece deshabilitado hasta cumplir tres
  días de gestión con tres o más intentos sin respuesta cada uno; la interfaz
  explica qué falta.
- **AC-035:** un caso con intentos cuyo servicio porta a Movistar se cierra
  `LOST · YA_MIGRO_OTRA_AGENCIA` automáticamente y aparece en la métrica de
  pérdidas del asesor; el mismo caso sin intentos se cierra `DISCARDED` y no
  aparece.
- **AC-036:** al séptimo día de gestión sin venta ni agenda vigente, el caso
  entra en resolución obligatoria y, sin acción del asesor ese día, escala al
  supervisor. En ningún escenario se cierra solo.
- **AC-037:** seleccionar 50 casos y asignarlos a un asesor específico de otro
  equipo los deja visibles para ese asesor y su supervisor, con historial de
  quién asignó y cuándo.
- **AC-038:** la distribución equitativa entre N asesores seleccionados produce
  una diferencia máxima de un caso entre ellos y una mezcla de prioridades
  equivalente para cada uno.
- **AC-039:** deseleccionar a un asesor ausente lo excluye del reparto sin
  bloquear la operación, y la exclusión queda registrada en el lote.
- **AC-040:** repartir una selección entre varios equipos crea sub-lotes
  auditados por equipo, y ningún caso queda sin destino.
- **AC-041:** un supervisor vendedor no encuentra la opción de asignarse casos
  por selección directa; si se incluye en una distribución equitativa, el lote
  lo registra.
- **AC-042:** redistribuir los casos sin gestión de un asesor ausente los
  reasigna en lote conservando la asignación previa en el historial; un caso
  con gestión iniciada no entra en la redistribución masiva.
- **AC-043:** la bandeja de triage permite seleccionar un rango con Shift y
  seleccionar los primeros N casos escribiendo la cantidad, sin marcar uno por
  uno.
- **AC-044:** el DNI se copia al portapapeles con un clic, con confirmación
  visual, para pegarlo en el sistema de consulta manual.
- **AC-045:** asignar un bloque a un equipo hace que su supervisor vea
  exactamente esos casos en su triage y ninguno de otro equipo; la entrega
  queda auditada por caso.
- **AC-027:** un servicio portado a otro operador hace menos de treinta días
  queda agendado automáticamente a su fecha de habilitación.
- **AC-028:** una línea de planta queda marcada como tal, sin fecha de
  habilitación, y su caso se trabaja con la cadencia normal.

## 6. Supuestos abiertos

- **SA-001** (resuelto el 26/08/2026): la base no es un mecanismo de refresco.
  Se carga una única base inicial de tres días y luego solo el día anterior
  (BR-009), así que dejar de aparecer es lo esperado y no cierra ningún caso.
  Un caso `WAITING` se revalida por el cruce diario de portabilidad, que
  incluye todos los casos abiertos (BR-017), y por el chequeo manual del
  supervisor. Un cliente que vuelve a aparecer trae un pedido nuevo y se trata
  según BR-009b.
- **SA-002** (resuelto el 26/08/2026): el reporte completo es el CSV de siete
  columnas descrito en BR-018, generado por la consulta a
  `consulta.portabilidad.pe` que hoy corre como script local con Playwright.
  Existe además un cruce rápido sin fecha de portación, cubierto por BR-018b
  con mapeo de columna.
- **SA-003** (resuelto el 26/08/2026): la antigüedad sale de
  `fecha_de_la_ventana` para líneas que ya portaron (BR-037); una línea de
  planta no la tiene y se trabaja con cadencia normal (BR-040). La captura
  manual del asesor queda como complemento (BR-038).

## 7. Relación con otras especificaciones

- **SPEC-026** define el caso de recuperación comercial, su propiedad, la
  reasignación auditada, la regla antifraude y el vínculo con la nueva orden.
  Esta spec **implementa ese motor** y le agrega la puerta de entrada por base
  importada. La puerta automática por estado interno se conecta al mismo motor
  en la fase 5.
- **SPEC-016** mantiene la bandeja de recuperación por estado interno. No se
  modifica en este incremento.
- **SPEC-029** aporta el patrón de fuente externa de solo lectura con
  instantánea e historial, reutilizado aquí para la base nacional.
- La agenda de reingreso por antigüedad de portabilidad, registrada como
  pendiente el 23/08/2026, queda **absorbida** por BR-037 a BR-040.
