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
- **BR-008** (precisado el 01/09/2026): una fila sin DNI o sin número de
  servicio no genera caso y se reporta como inválida con su motivo. Un
  número de servicio válido es una línea móvil peruana: nueve dígitos
  empezando en 9 (tras retirar el prefijo `51` de once dígitos). Un valor
  como `519201255` es basura de exportación, se reporta
  `INVALID_SERVICE_NUMBER` y no genera caso — dos de esos contaminaron la
  exportación de números del 27/08 y la herramienta de consulta los rechazó.
- **BR-009** (revisado el 30/08/2026): la carga es **episódica**: la base se
  sube cuando la operación decide trabajarla, no todos los días. No existe una
  "base inicial de tres días": cada carga es simplemente la base diaria
  disponible al momento de activar. Los solapamientos entre cargas no duplican
  nada — la identidad por cliente y los avistamientos (BR-006, BR-009b) los
  absorben. La base sigue siendo un flujo de entrada de pedidos, no un
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
- **BR-018** (corregido el 01/09/2026): existen dos tipos de reporte y la
  importación distingue cuál se está subiendo. El **reporte completo** es el
  CSV de la consulta a `consulta.portabilidad.pe`; sus columnas distintivas
  y obligatorias son `numero`, `receptor`, `cedente`, `fecha_de_la_ventana`
  y `estado`; `asignatario_original` y `numero_consultado` son opcionales —
  la exportación real del 27/08 trae seis columnas, sin
  `numero_consultado`. `estado` toma tres valores: `Número portado`,
  `Número no portado` y `Número programado para portación`. El sistema
  valida el encabezado al subir y conserva cada fila cruda como evidencia.
- **BR-018c** (incidente del 01/09/2026): un archivo que trae columnas de
  resultado (`estado`, `fecha_de_la_ventana`, `receptor`, `cedente`) es un
  reporte de resultados y **jamás se procesa como cruce rápido**: si no
  califica como reporte completo, la importación se rechaza explicando qué
  columna falta. El fallback silencioso descartó como `YA_ACTIVO` los 100
  números de la primera consulta del día 27 — incluidos 13 no portados y
  ~11 portados a otros operadores — cerrando 91 casos en lugar de 76.
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
- **BR-020** (precisado el 01/09/2026): el cruce se ejecuta sobre todos los
  casos abiertos en cada importación de reporte, no solo sobre los del lote
  del día. Un cliente que porta el jueves deja de llamarse el jueves.
  **Reimportar un reporte ya conocido no se rechaza**: se conserva un solo
  lote por archivo como evidencia —la huella sigue siendo única— y el cruce
  vuelve a ejecutarse sobre los casos abiertos de hoy, porque esa población
  cambia: una base cargada después trae casos que ese mismo reporte todavía
  resuelve, y la revalidación de BR-019e necesita reaplicarlo aunque vuelva
  idéntico. Reaplicar es inocuo porque cada decisión es función del estado
  que informa el reporte, no del historial del caso. Los contadores del lote
  describen la última aplicación; el rastro acumulativo vive en los eventos
  de cada caso.
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
- **BR-024b** (02/09/2026): **una espera no dura para siempre**. BR-024 ya
  prometía que el caso «reaparece en la revisión del día siguiente» y el
  triage se lo dice al supervisor cada vez, pero nada lo cumplía: solo el
  cruce sacaba de `WAITING`, y solo las esperas que él mismo había puesto y
  podía desmentir. El resto quedaba inmóvil —tampoco vence por BR-084,
  porque sus líneas sí están consultadas— y con él la oportunidad. Dos
  poblaciones vuelven a `TRIAGE`, cada una con su reloj:
  - la **espera puesta a mano**, al día siguiente. No hay fecha de nada: el
    supervisor vio un pedido que el reporte no ve, y esa observación caduca.
    Un pedido que tarde en concretarse se volverá a marcar cada día; se
    acepta esa repetición antes que perder al cliente, y en la práctica el
    cruce diario responde antes;
  - la **portación programada**, al día siguiente de su fecha de ventana.
    Antes de esa fecha no podía cambiar nada; desde ella, o portó —y el cruce
    la descarta— o se cayó y vuelve a ser oportunidad.

  Queda fuera la espera de BR-085: el caso conserva a su asesor mientras se
  verifica, y liberarla convertiría su palabra en un descarte. Se reconoce
  por la marca de revalidación de sus líneas. El caso liberado **conserva su
  equipo**: vuelve a la bandeja de su supervisor, no al reparto general.

  Esto corrige BR-082b, que dejaba fuera del barrido a toda línea programada
  con fecha: pasada la ventana vuelve a entrar, porque dar por hecho que
  portó era una suposición, y era la que perdía las oportunidades.
- **BR-009c** (02/09/2026): el punto de BR-009b sobre lotes superpuestos
  —«un mismo pedido importado dos veces no duplica avistamientos»— solo se
  cumplía **dentro de un caso**, que es donde la clave única puede actuar. Con
  el caso cerrado el flujo crea uno nuevo, el identificador cambia y la guarda
  nunca dispara: volver a subir la base de ayer resucitaba en triage a cada
  cliente ya descartado por ser Movistar, desde un pedido que ya se resolvió.
  La pregunta se hace ahora **antes de crear nada y sobre todos los casos del
  cliente**: si cada uno de sus pedidos ya estaba registrado, no es un
  reingreso y no se crea caso. Por el mismo motivo, el evento de avistamiento
  se escribe solo cuando el avistamiento fue nuevo: anunciar un pedido nuevo
  por cada fila repetida llenaría de hechos falsos un rastro que existe para
  ser evidencia.
- **BR-088** (02/09/2026): la bandeja de campaña del asesor **se busca con
  un solo campo**. Quien tiene al cliente al teléfono tiene un dato suelto
  —un nombre a medias, el número desde el que llama, un DNI dictado— y
  obligarle a elegir columna le añade una decisión que no le corresponde. El
  término se prueba contra nombre, DNI, teléfono de contacto y número de
  línea a la vez. Las palabras del nombre se exigen todas pero en cualquier
  orden, porque nadie dicta los cuatro apellidos seguidos. Menos de cuatro
  dígitos no se busca: encontraría media base. La búsqueda alcanza **solo
  los casos del propio asesor**: poder pescar en el pool por DNI convertiría
  el reparto equitativo de BR-028 en una elección.
- **BR-089** (05/09/2026): la bandeja del asesor **filtra en vivo y conserva
  el sitio**. Con el cliente al teléfono, pulsar «Filtrar» es un paso de
  más; y salir a la ficha para volver a una bandeja recién barajada le hace
  perder el hilo de a quién venía llamando.
  - La lista se recarga cambiando la URL, no pidiendo datos aparte. De ahí
    salen gratis el enlace compartible, el botón Atrás y la imposibilidad de
    que una respuesta vieja pise a una nueva: el enrutador descarta la
    navegación que quedó atrás, sin mecanismo que mantener.
  - Un término que la consulta descartaría —menos de cuatro dígitos, una
    inicial— **no se consulta**: devolvería la bandeja entera y la haría
    parpadear entre dígito y dígito.
  - Cambiar cualquier filtro vuelve a la primera página: la página tres del
    filtro anterior no significa nada en el nuevo.
  - La página pedida se acota a las que existen. Un caso resuelto mientras
    el asesor estaba en la ficha puede vaciar la última página, y volver a
    ella mostraría «nada coincide»: parecería que perdió su cartera.
  - El contexto viaja en el enlace de la ficha y vuelve con «Volver a mi
    cola», igual que con el botón Atrás. Se ancla **al caso**, no a una
    altura de desplazamiento: entre la visita y la vuelta la lista cambia, y
    un número de píxeles apuntaría a otra fila. El caso vuelve señalado.
  - Llegar a una ficha por un enlace suelto no trae contexto, y entonces
    «Volver a mi cola» abre la bandeja normal.
- **BR-090** (05/09/2026): **tipificar desde la bandeja**, con la forma de
  trabajo del Excel: tipificación y observación a la izquierda, se anota y se
  sigue con el siguiente. Cada guardado es un evento nuevo e inmutable con
  autor y hora del servidor; nada se edita ni se borra desde la bandeja.
  - **Las mismas reglas que la ficha**, porque es la misma función de
    servidor: acceso por organización, rol y asignación; estados abiertos;
    cadencia, pausas, agenda y verificación por resultado. Tipificar y
    resolver siguen siendo acciones distintas.
  - **Idempotencia por clave del cliente.** Bloquear el botón no basta: un
    reintento tras un corte, con el primero ya guardado, crea una segunda
    gestión. La clave nace con el borrador, viaja en cada envío y el servidor
    devuelve lo ya guardado si la reconoce. Columna `client_request_id`,
    única por caso; nula en los intentos históricos y en los de la ficha.
  - **La fila no se mueve al guardar.** La acción en fila **no revalida
    ninguna ruta**: en Next, una revalidación dentro de una acción devuelve
    también el árbol fresco de la página actual y la lista se reordena bajo
    las manos del asesor —pasó con la primera versión—. La fila se actualiza
    con lo que el servidor confirmó y avisa que cambiará de posición al
    actualizar la cola.
  - **Un solo borrador abierto.** Cambiar de cliente con cambios sin guardar
    ofrece tres salidas dentro de la fila —guardar, descartar, seguir—; los
    filtros y la paginación preguntan antes de llevárselo; cerrar la pestaña
    también.
  - **La observación anterior nunca se copia** al campo nuevo: sería
    registrar información vieja como si fuera del contacto de hoy. Se
    muestra como referencia, diferenciada.
  - **Un fallo inesperado del servidor vuelve como error en la fila**, con
    el borrador intacto, no como pantalla caída.
  - Las etiquetas del Excel que no existen —«Apagado», «Tiene deuda»— no
    se incorporan sin definir significado, campos y efecto en la cadencia.
- **BR-091** (05/09/2026, fase 1 del plan de usabilidad de Campañas):
  **los filtros de las pantallas administrativas se componen con AND y solo
  estrechan el alcance.** Cuatro correcciones de control:
  - **COR-01.** Los fragmentos de una consulta se unen con `AND`, nunca por
    spread. Por spread, dos fragmentos sobre la misma clave se pisaban en
    silencio: elegir un plan en el triage borraba la condición de
    verificación de la vista y traía casos sin consultar bajo el botón
    «Listos». El compositor `allOf` vive en `@repo/validation` con prueba.
  - **COR-02.** Cada contador abre exactamente el conjunto que nombra. El
    triage pasa a tres vistas —Listos (`TRIAGE` verificados), Falta consultar
    (con alguna línea sin consultar), Con pedido en curso (`WAITING`
    verificados)— y las tarjetas enlazan a su vista. Verificación y estado
    son dimensiones distintas; ningún contador suma categorías solapadas.
  - **COR-04.** Un `?team=` en la URL nunca amplía el alcance de un
    supervisor: en triage, distribución y tablero el filtro solo puede
    estrechar sus equipos; un equipo ajeno se ignora. Cuando exista filtro
    por asesor, misma regla.
  - **COR-05.** La selección por lote no sobrevive a un cambio de lista. El
    estado del componente persiste entre filtros y los IDs marcados seguían
    viajando ocultos en el formulario: «aplicar» actuaba sobre clientes que
    nadie veía. Se limpia y se avisa, porque una selección que desaparece
    sin explicación parece un fallo.
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
- **BR-036** (ampliado el 01/09/2026): el resultado tipificado pertenece al
  conjunto `SIN_RESPUESTA`, `INTERESADO`, `INTERESADO_CON_PEDIDO`,
  `RECHAZA`, `AGENDA`, `NUMERO_ERRADO`, `NO_CUMPLE_30D`, `YA_ACTIVO`,
  `DATOS_INVALIDOS`, `VENDIDO`.

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

- **BR-045 (revisada):** `Papa`, `Mama` y `Nacimiento` son datos de validación
  de identidad del titular y se muestran al asesor que gestiona el caso, tanto
  en la cola como en la ficha. La columna `Validacion` sigue indicando si la
  identidad ya fue validada.
- **BR-046 (retirada):** la revelación por pasos —solo tras registrar un
  intento `INTERESADO`, solo para el asesor asignado y con auditoría por
  evento— se eliminó por decisión de producto: el asesor necesita estos datos
  **durante** la llamada para confirmar con quién habla, no después de
  clasificarla. Las revelaciones ya auditadas se conservan en la base y se
  siguen mostrando en la ficha de los casos donde ocurrieron.

  El control que se pierde es la trazabilidad de quién vio qué y cuándo: a
  partir de ahora cualquier asesor con el caso en su cola ve los tres campos
  sin dejar registro.
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

### Puerta interna (Fase 5) — unificación con SPEC-026

Definida el 30/08/2026 sobre el motor ya construido. Las reglas de dominio
provienen de SPEC-026; aquí se resuelve su encaje con `recovery_cases`.

- **BR-061:** la puerta interna tiene dos entradas. La **automática**
  (`INTERNAL_ORDER_STATE`) crea un caso cuando una orden DITO queda
  `CANCELLED` o `SENT + NOT_DELIVERED`. Los puntos de enganche son las dos
  transacciones que hoy mutan el estado de una orden — la actualización de
  estado desde la bandeja y la aprobación de una solicitud de cancelación —,
  no el webhook ni el importador DITO: ambos solo dan de alta órdenes `OPEN`
  y el importador mantiene el estado fuera de su lista blanca de campos
  actualizables. La creación es idempotente: una orden origen tiene a lo sumo
  un caso abierto. La **manual** (`MANUAL`) es la acción "Enviar a recupero"
  sobre la tarjeta del pedido, disponible para `ADMIN`, `BACKOFFICE` y
  `SUPERVISOR` dentro de su alcance, nunca para `AGENT`.
- **BR-062:** el caso interno nace `OPEN`, no `TRIAGE`: el cliente ya es
  conocido y la elegibilidad ya ocurrió al vender. Nace vinculado a su orden
  origen (`sourceDitoOrderId`) y con el asesor y equipo originales copiados
  (`originalAgentUserId`, `originalTeamId`); la orden cancelada permanece
  cerrada e inmutable y una recuperación se materializa **enlazando una orden
  DITO nueva**, nunca reabriendo la original.
- **BR-063:** todo caso interno lleva **motivo estructurado de entrada**:
  `NO_ENTREGADO`, `INCIDENCIA_LOGISTICA`, `PROMESA_COMERCIAL_INCORRECTA`,
  `DEUDA`, `ANTIGUEDAD_PORTA`, `OTRO`. En la entrada automática el sistema lo
  propone desde estado × motivo × submotivo del OL (regla de acción de
  SPEC-029) y la observación conserva íntegro el mensaje del OL; en la manual
  el actor lo elige y la observación es obligatoria.
- **BR-064:** la prioridad deriva del motivo, según SPEC-026: **Crítica** =
  promesa comercial incorrecta (reasignación inmediata fuera del vendedor
  originador); **Alta** = no recibió por falta de tiempo, ausencia o cambio de
  fecha; **Media** = incidencia logística solucionable; **Condicionada** =
  deuda o antigüedad, que se agenda. Dentro de cada nivel, primero el más
  antiguo sin contacto.
- **BR-065:** propiedad y escalamiento: en motivos Alta y Media el asesor
  original tiene la primera oportunidad durante el **Día 0**; sin acción
  dentro del SLA el caso escala al supervisor, que puede reasignarlo o
  enviarlo a la cola del equipo autorizado usando los modos de BR-028. Un caso
  **Crítico nunca vuelve al asesor originador**, ni por asignación directa ni
  por cola.
- **BR-066:** la cadencia interna (habilitada por BR-031) es: primer contacto
  a más tardar **2 horas** después del rechazo o de la novedad del OL; toques
  en Día 0, Día 1 (corrección de oferta o fecha), Día 3 y Día 7 con
  **resolución obligatoria**, reutilizando el mecanismo de BR-058 con
  parámetros por fuente. Una promesa de contacto agenda el caso (BR-034) y
  suspende la cadencia hasta la fecha acordada.
- **BR-067:** antifraude del originador, adicional a BR-049/BR-050/BR-050b: un
  asesor no puede enviar su propia venta a la cola compartida ni autoasignarse
  casos ajenos; un supervisor vendedor no puede tomar su propia venta caída a
  través del recupero. Toda reasignación conserva historial y actor.
- **BR-068:** encaje de esquema, sin migración destructiva: `recovery_cases`
  agrega `sourceDitoOrderId`, `originalAgentUserId`, `originalTeamId`,
  `entryReason`, `entryObservation` y `priority` (nulos para la base
  nacional); para un caso interno, `firstRegisteredAt` toma el `registeredAt`
  de la orden origen y `lastSightingAt` el momento de la novedad que creó el
  caso, conservando los `NOT NULL` existentes. Los intentos reutilizan la
  tabla de gestiones de la Fase 3.
- **BR-069:** los casos internos abiertos participan del cruce de portabilidad
  como cualquier caso (BR-017 a BR-021): si el cliente porta con otra agencia,
  aplica BR-059 y alimenta la métrica de pérdidas frente a otras agencias.
- **BR-070:** medición interna, sobre el tablero de BR-052: tasa de recupero
  por cohorte de creación (recuperadas / casos, con descartes fuera del
  denominador), tiempo a primer contacto y pérdidas por motivo, por asesor y
  equipo. El KPI "Por recuperar" del dashboard de rendimiento pasa de contador
  de pendientes a par pendientes/recuperadas del período.
- **BR-071:** un rechazo del OL (`RECHAZADO`) cancela la orden automáticamente
  en el dominio de Máximo, así que la puerta automática lo captura al llegar
  `CANCELLED`; el submotivo decide motivo y prioridad del caso. La bandeja de
  incidencias de SPEC-016 (BR-003) no cambia: el caso Crítico por promesa
  incorrecta entra al recupero sin sacar el rechazo de incidencias.
- **BR-072** (revisado el 30/08/2026): un cliente tiene un solo caso abierto,
  venga por la puerta que venga (BR-006 vale para todas las fuentes). Si llega
  una novedad de una puerta distinta, no se crea un caso nuevo: se anota como
  evento con su fuente, motivo y observación, y el caso adopta la prioridad
  más alta entre la vigente y la entrante. **El carril interno siempre domina
  la fusión**: cuando la novedad es una venta propia caída, el caso — esté en
  triage, en el pool o asignado como lead frío — salta al modelo de gestión
  interno: queda asignado al asesor original con el reloj de dos horas
  corriendo (BR-065, BR-066), o sin responsable si la prioridad resultante es
  Crítica. Un caso de venta caída jamás puede quedar dormido dentro de un
  lead frío invisible. En el sentido inverso, una aparición en la base sobre
  un caso interno abierto es solo un avistamiento: la gestión interna
  continúa y el cliente nunca se reparte como lead frío. La fusión queda
  auditada con actor, fuente entrante, prioridad y responsable previos.
- **BR-073:** un caso interno por `NO ENTREGADO` nace en el **primer intento
  fallido del courier**, no al agotarse las visitas: el estado es reintentable
  y la ventana comercial útil está entre una visita y la siguiente. Si el
  courier entrega en un intento posterior, el caso se cierra automáticamente
  como `DISCARDED` con motivo de entrega concretada y **no cuenta como
  pérdida** (BR-056), aunque conserva sus intentos como evidencia del esfuerzo.
  Los estados terminales `RECHAZADO` y `CANCELADO` no admiten este matiz:
  crean el caso en el momento en que llegan.

### Carriles de gestión y campañas (30/08/2026)

El recupero de ventas propias y la base nacional comparten motor de datos,
pero son trabajos distintos: el primero es **push** — un evento sobre una
venta tuya, caliente, siempre activo, con dueño natural —; el segundo es
**pull** — un lote frío que la operación decide trabajar cuando la producción
baja, generalmente porque las ventas de publicidad no alcanzan. Mezclar sus
colas, relojes o métricas arruina ambos.

- **BR-074:** los casos de fuente `INTERNAL_ORDER_STATE` y `MANUAL` nunca
  aparecen en el triage de campaña, nunca entran a la distribución en bloques
  ni a la cola compartida; los de `NATIONAL_BASE` nunca aparecen en la bandeja
  de ventas caídas. Son dos superficies con nombre e icono propios:
  **Recupero de ventas** (evolución de la pestaña "Por recuperar", respaldada
  por casos con dueño, prioridad y próxima acción, con el icono de flecha que
  regresa) y **Campañas** (preparación, triage y bloques, con el icono de lote
  de registros). El nombre de la superficie describe el trabajo —activar una
  campaña cuando baja la producción—, no la fuente del dato: una base nacional
  es la fuente de hoy, pero la superficie admite otras sin cambiar de nombre.
- **BR-075:** las métricas se segregan por fuente. El objetivo del 3–6 %
  (BR-056b) mide **solo** cohortes `NATIONAL_BASE`. El carril interno mide
  tasa de salvado (recuperadas / casos), tiempo a primer contacto y pérdidas
  por motivo, asesor y equipo. Ninguna vista suma fuentes en un mismo
  indicador.
- **BR-076:** los relojes de cadencia de base (tres intentos diarios,
  resolución al séptimo día) corren **solo desde la asignación**. Un caso en
  triage o en el pool no tiene SLA: una base deliberadamente no trabajada no
  genera alertas de cobertura.
- **BR-077:** un caso de base **asignado y sin ningún intento durante dos
  días** vuelve solo al pool de su equipo, conservando el historial de la
  asignación. Complementa la redistribución manual de BR-030b: cuando la
  producción se recupera a mitad de campaña, nadie carga inventario muerto.
- **BR-078:** la cola de base ordena por: primero las habilitaciones vencidas
  (BR-039), después **lo más reciente primero** — un lead frío pierde valor
  con cada día, así que el anticuamiento se gestiona al final de forma
  natural. El asesor puede filtrar el pool de su equipo por atributos
  objetivos — departamento, plan, antigüedad — y tomar desde el filtro; la
  toma sigue siendo atómica y los filtros no debilitan BR-050b. La toma es
  **por bloque de hasta 10 casos**: el asesor no vuelve al pool después de
  cada llamada, y el sistema le entrega los 10 más recientes que cumplan su
  filtro en una sola operación atómica.
- **BR-079:** trabajar la base es una **campaña registrada**: la activación
  guarda actor, fecha, equipos participantes y configuración vigente, y exige
  la secuencia carga del día → cruce de portabilidad fresco → distribución.
  La efectividad se mide por campaña, no por calendario. El dashboard de
  rendimiento **sugiere** activar una campaña cuando el ingreso del día cae
  por debajo del promedio del período; la decisión es siempre humana.

### Verificación por tandas y anticuamiento (01/09/2026)

Filtrar 2 000 líneas toma tiempo y la operación no puede esperar al lote
completo: el flujo real es continuo — se consulta una tanda, lo que
sobrevive entra a trabajo, y se sigue consultando mientras el equipo ya
llama. La realidad operativa usa **dos herramientas**: el cruce rápido
recorre las 2 000 líneas diarias y solo dice quién ya está activo en
Movistar (a veces deja líneas sin verificar); el reporte completo es más
lento pero deja la fecha de portación, información clave para el asesor.
El día típico: rápido primero para limpiar, completo después sobre los
sobrevivientes.

- **BR-080:** la **verificación es una propiedad derivada**, no un estado
  almacenado: un caso está **listo** cuando ninguna de sus líneas activas
  está sin consultar (`portabilityCheckedAt`). Un caso con líneas
  parcialmente consultadas **espera** (decidido el 01/09/2026): el asesor
  debe saber exactamente qué puede ofrecer antes de llamar.
- **BR-081:** el cruce rápido **nunca verifica**: descarta los activos que
  lista y no dice nada de los demás (no se puede distinguir "revisado y no
  activo" de "no revisado"). Solo el reporte completo marca una línea como
  consultada. Complementa BR-018b: el rápido limpia, el completo decide
  **y verifica**.
- **BR-082:** la exportación de números es **incremental**: emite solo las
  líneas sin consultar o marcadas para revalidación, de casos abiertos no
  vencidos, las más recientes primero, con tandas del tamaño que la
  herramienta soporte. Consultar dos veces lo mismo es tiempo de operación
  perdido.
- **BR-082b** (02/09/2026): el **barrido diario** no reconsulta lo que ya
  tiene respuesta. De la base de trabajo salen tres poblaciones y solo dos
  aportan algo al volver al filtro externo: las líneas **en otro operador**
  (o sin consultar) y las **programadas hacia Movistar sin fecha de
  ventana**, que pueden caerse durante el día y volver a ser oportunidad
  (BR-019e). Queda fuera la **programada hacia Movistar con fecha**: si la
  fecha ya pasó, el chip se entregó y la línea es Movistar; si aún no
  llega, el reporte de hoy no dice nada que no dijera ayer. El cupo del
  filtro rápido —2 000 números diarios— es el recurso escaso, y el barrido
  sin recorte lo gastaba en respuestas conocidas. La pantalla anuncia
  cuántos números salen y cuántos quedan fuera antes de descargar; el
  barrido sin recortar sigue disponible para auditar.

- **BR-083:** el triage muestra por defecto los casos **listos**; los que
  esperan consulta son visibles bajo su propio contador, nunca mezclados.
  Distribuir casos sin verificar **se advierte pero no se bloquea**
  (decidido el 01/09/2026): si la herramienta de consulta falla, la
  operación decide asumir el costo con el sistema diciéndoselo.
- **BR-084:** **anticuamiento de la verificación**: un caso en `TRIAGE` o
  `WAITING` que llega a los **7 días** desde su fecha de registro sin
  verificación completa se descarta solo con motivo `VENCIDO` y sus líneas
  salen de la exportación. No cuenta como pérdida (BR-056): nunca fue
  oportunidad confirmada. La experiencia manda: de la base diaria quedan
  400–500 registros llamables, y al día 30 validar los 15 000 acumulados
  del mes es inviable — el embudo debe drenar solo. Los siete días cubren
  el ciclo completo (ventana móvil de tres días de la base más margen de
  operación); es la única excepción nueva a BR-041 y, como BR-059, está
  respaldada por un hecho verificable: nadie consultó a tiempo.

### El ciclo del lead en manos del asesor (01/09/2026)

Dos hallazgos del asesor deciden el destino de un caso, y ninguno de los
dos se resuelve con su palabra: los resuelve la evidencia.

- **BR-085 — reporte "ya es Movistar", con verificación**: la palabra del
  asesor **nunca descarta un caso** — si lo hiciera, reportar "ya es
  Movistar" sería la puerta para deshacerse de leads difíciles. Al
  registrar `YA_ACTIVO`: el caso pasa a `WAITING` conservando a su asesor,
  sale de su cola activa (visible al fondo, "en verificación") y sus líneas
  entran marcadas a la próxima exportación. La verificación tiene dos vías,
  según el rol: el **supervisor confirma manual** sobre el caso puntual,
  con su usuario registrado; el **administrador verifica en lote** con el
  cruce. Confirmado → aplica BR-059: pérdida `YA_MIGRO_OTRA_AGENCIA` (tuvo
  gestión) y jamás vuelve. No confirmado → regresa a la cola del asesor con
  próxima acción inmediata: el cliente le mintió y sigue portable.
- **BR-086 — interesado con pedido en curso**: el cliente quiere, pero otra
  agencia ya le envió un pedido. Es **el lead más caliente de la base** —
  ya dijo sí a portar y prefiere nuestra oferta; solo estorba un pedido
  ajeno que puede caerse. Al registrar `INTERESADO_CON_PEDIDO`: el caso
  queda `SCHEDULED` para la mañana siguiente **conservando a su asesor**
  (quien encontró el oro se lo queda), y sus líneas entran en revalidación
  diaria. Cada mañana reaparece al frente con su distintivo para que el
  asesor re-contacte y pregunte si el pedido anterior cayó; en paralelo el
  cruce vigila: portado → pérdida por BR-059; programado con fecha → el
  chip ajeno ya llegó, espera; no portado → sigue vivo y el asesor insiste.
  Cuando el pedido ajeno cae y el cliente acepta → `VENDIDO` →
  `RECOVERED` con la orden nueva. Es la asimetría deliberada con el triage:
  antes de asignar, "tiene pedido" es `EN_ESPERA` sin dueño; después de
  asignar, el caso ya tiene dueño y lo conserva.
- **BR-087:** el cruce ejecuta BR-059 al cerrar por portabilidad: un caso
  **con intentos** que porta a Movistar cierra `LOST ·
  YA_MIGRO_OTRA_AGENCIA` (alimenta la métrica de pérdidas frente a otras
  agencias por asesor); **sin intentos**, `DISCARDED · YA_ACTIVO`. Y un
  caso en verificación o revalidación cuyo reporte dice "no portado"
  vuelve a quien lo trabajaba: con asesor asignado, a su cola con próxima
  acción inmediata; sin asesor, al triage.

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
- **AC-046:** una orden que pasa a `CANCELLED` o `SENT + NOT_DELIVERED` crea
  su caso interno una sola vez, con motivo propuesto y observación del OL;
  reprocesar la misma novedad no duplica el caso.
- **AC-047:** "Enviar a recupero" es visible para `ADMIN`, `BACKOFFICE` y
  `SUPERVISOR` dentro de su alcance, no existe para `AGENT`, y exige motivo
  estructurado y observación.
- **AC-048:** un caso `PROMESA_COMERCIAL_INCORRECTA` nace Crítico, sin
  asignarse al originador, y el sistema rechaza cualquier intento de
  asignárselo.
- **AC-049:** un caso `NO_ENTREGADO` nace asignado al asesor original con
  vencimiento de primer contacto a 2 horas; sin gestión dentro del SLA aparece
  escalado en la bandeja del supervisor.
- **AC-050:** resolver `RECOVERED` exige vincular la orden DITO nueva; la
  venta se atribuye a quien cerró y la tasa de recupero de la cohorte se
  actualiza.
- **AC-051:** los casos internos abiertos aparecen en la exportación de
  números y el cruce los cierra si el cliente ya portó.
- **AC-052:** los casos de referencia de SPEC-026 se reproducen: `1942469714A`
  entra manual como Crítica con la observación del OL; `1942303517A` admite
  `LOST · YA_MIGRO_OTRA_AGENCIA`.
- **AC-053:** un cliente con caso abierto de base nacional cuya venta propia
  cae no genera un segundo caso: la novedad aparece como evento en el caso
  existente, la prioridad sube y sigue habiendo un solo responsable.
- **AC-054:** si esa fusión eleva el caso a Crítica y su responsable es el
  asesor originador de la venta, el sistema lo reasigna fuera de él y registra
  el movimiento.
- **AC-055:** el primer `NO ENTREGADO` de una orden crea su caso con
  vencimiento de primer contacto a 2 horas; una segunda novedad de la misma
  orden no crea un caso adicional.
- **AC-056:** si el courier entrega después de haberse creado el caso, este se
  cierra solo como `DISCARDED`, conserva sus intentos y no figura entre las
  pérdidas del asesor.
- **AC-057:** una venta caída de un cliente cuyo caso de base duerme en triage
  deja el caso asignado al asesor original, con reloj de dos horas y evento de
  fusión auditado; si el motivo es Crítico, queda sin responsable.
- **AC-058:** un caso de base asignado sin intentos durante dos días vuelve
  solo al pool de su equipo con su historial.
- **AC-059:** la cola de base presenta primero las habilitaciones vencidas y
  luego los casos más recientes; un caso interno jamás aparece en ella, ni un
  caso de base en la bandeja de ventas caídas.
- **AC-060:** activar una campaña queda registrado con actor, equipos y
  configuración; el dashboard sugiere activarla cuando el ingreso del día está
  bajo el promedio, sin activarla solo.
- **AC-061:** ninguna vista mezcla fuentes: la conversión 3–6 % solo cuenta
  casos de base y la tasa de salvado solo casos internos.
- **AC-062:** exportar una tanda de 200 emite solo líneas sin consultar o en
  revalidación, las más recientes primero; una línea ya consultada no
  vuelve a salir.
- **AC-063:** el triage separa listos de esperando consulta, muestra los
  listos por defecto y sus contadores suman el total.
- **AC-064:** distribuir una selección que incluye casos sin verificar
  informa cuántos van sin verificación, sin bloquear la operación.
- **AC-065:** un caso que cumple 7 días sin verificación completa queda
  `DISCARDED · VENCIDO`, no figura entre las pérdidas y sus líneas
  desaparecen de la exportación.
- **AC-066:** registrar `YA_ACTIVO` deja el caso en verificación al fondo de
  la cola del asesor, sus líneas salen en la próxima exportación y el caso
  no se cierra por la palabra del asesor.
- **AC-067:** el cruce que confirma portado a Movistar cierra `LOST ·
  YA_MIGRO_OTRA_AGENCIA` cuando el caso tiene intentos, y `DISCARDED ·
  YA_ACTIVO` cuando no; el reporte "no portado" devuelve el caso a la cola
  del asesor asignado con próxima acción inmediata.
- **AC-068:** el supervisor puede confirmar o desmentir manualmente un caso
  reportado, con su usuario en el evento; el asesor no encuentra esa
  opción.
- **AC-069:** registrar `INTERESADO_CON_PEDIDO` agenda el caso para la
  mañana siguiente conservando al asesor, lo marca con su distintivo y
  pone sus líneas en revalidación diaria.

## 6. Supuestos abiertos

- **SA-001** (resuelto el 26/08/2026; **revisado el 30/08/2026**): la base no
  es un mecanismo de refresco y dejar de aparecer no cierra ningún caso. La
  revisión: la carga es episódica — se sube cuando se decide trabajar la
  base, sin base inicial de tres días ni obligación de continuidad diaria
  (BR-009). La frescura se protege ordenando la cola por recencia (BR-078) y
  ejecutando el cruce de portabilidad al activar cada campaña (BR-079). Un
  cliente que vuelve a aparecer trae un pedido nuevo y se trata según BR-009b.
- **SA-002** (resuelto el 26/08/2026): el reporte completo es el CSV de siete
  columnas descrito en BR-018, generado por la consulta a
  `consulta.portabilidad.pe` que hoy corre como script local con Playwright.
  Existe además un cruce rápido sin fecha de portación, cubierto por BR-018b
  con mapeo de columna.
- **SA-003** (resuelto el 26/08/2026): la antigüedad sale de
  `fecha_de_la_ventana` para líneas que ya portaron (BR-037); una línea de
  planta no la tiene y se trabaja con cadencia normal (BR-040). La captura
  manual del asesor queda como complemento (BR-038).
- **SA-004** (resuelto el 30/08/2026): convivencia de puertas para el mismo
  cliente. Se mantiene un caso abierto por cliente en todas las fuentes: la
  novedad de la segunda puerta se anota como evento, el caso adopta la
  prioridad más alta y conserva su fuente y su responsable, salvo que la
  prioridad resultante sea Crítica sobre el asesor originador. Formalizado en
  BR-072 y verificado por AC-053 y AC-054.
- **SA-005** (resuelto el 30/08/2026): el caso interno por `NO ENTREGADO` nace
  en el primer intento fallido del courier, para poder intervenir entre una
  visita y la siguiente; si la entrega finalmente ocurre, el caso se cierra
  solo sin contar como pérdida. Formalizado en BR-073 y verificado por AC-055
  y AC-056.

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
