# SPEC-041 — Pedidos y Recupero de ventas: encontrar, acotar y abrir

Estado: en construcción (05/09/2026). Fases 2 y 3 del plan «Mejoras de
Pedidos y Recupero de ventas», revisado y corregido el 05/09/2026. La fase 1
del mismo plan quedó registrada como SPEC-030 BR-095.

## 1. Origen

Con las Campañas ya en producción, las dos bandejas que la operación usa
todo el día quedaron por detrás en usabilidad:

- **Recupero de ventas** (`/recovery/sales`) no tenía buscador ni filtros.
  Con más de sesenta casos abiertos, encontrar al cliente que está al
  teléfono era recorrer la tabla; distinguir «lo de mi equipo» de «lo de
  todos» era imposible; los casos resueltos no se podían ver desde ninguna
  parte.
- **Pedidos** (`/orders`) buscaba con un botón y un envío de formulario
  completo, tenía filtro por equipo pero no por asesor, y mostraba en cada
  fila la acción que Máximo exige y el estado del plazo de entrega sin
  ofrecer forma de aislarlos: «todo lo que hay que reagendar» o «todo lo que
  ya venció» se leía fila por fila.

Las colas de Campañas ya resolvieron el mismo problema en la fase 2 de su
plan (SPEC-030 BR-092): barra de filtros en vivo con el estado en la URL,
selectores que aplican al cambiar, texto con pausa de 300 ms, filtros
activos visibles y quitables uno a uno. Esta spec lleva esa misma mecánica a
las dos bandejas, sin inventar una segunda.

## 2. Alcance

- **REC-03** — Filtros operativos en Recupero de ventas.
- **PED-01** — Búsqueda en vivo y selector de asesor en Pedidos.
- **PED-02** — Filtros por acción derivada y por plazo en Pedidos, con
  indicadores que abren la lista que explican.
- **NAV-02** — El pedido enseña su caso de recupero, abierto o resuelto, y
  lo abre.
- **REC-04** — Gestión desde la fila de Recupero: teléfono copiable, última
  gestión, registro con el editor de Campañas; reasignar bajo demanda.
- **REC-05** — Etapa de la cadencia visible en la fila y en la ficha.

Fuera de alcance: acciones nuevas sobre los casos o los pedidos; cambios en
las reglas de negocio que deciden la acción derivada (SPEC-029 BR-019) o el
plazo; métricas nuevas.

## 3. Reglas

### Recupero de ventas (REC-03)

- **BR-001 · Búsqueda unificada.** Un solo término se prueba contra el
  nombre del titular, el DNI, el teléfono de entrega, el número de línea y
  el código de la venta. Las palabras se exigen todas, en cualquier orden;
  los dígitos valen para cualquier campo numérico. Rige la misma lectura del
  término que en Campañas (BR-088): menos de cuatro dígitos o palabras de
  una letra no buscan nada.
- **BR-002 · Dos vistas excluyentes.** «Abiertos» (sin responsable,
  asignado, en gestión, agendado, esperando confirmación) es la cola de
  trabajo y la vista por defecto; «Resueltos» (recuperada, perdida) es el
  historial, lo más reciente primero. Un valor desconocido cae en abiertos.
- **BR-003 · Equipo a cargo.** El filtro de equipo acota por el equipo del
  responsable actual o, mientras no hay responsable, por el equipo de la
  venta. Solo se ofrece a quien ve toda la organización (`ADMIN`,
  `BACKOFFICE`); el supervisor ya viene acotado a sus equipos y el asesor a
  sus casos.
- **BR-004 · Responsable actual, no vendedor original.** El selector de
  asesor filtra por quien tiene el recupero hoy (`assignedUserId`) y ofrece
  a los mismos asesores que se pueden asignar. El vendedor original sigue
  visible en la fila como contexto, nunca como filtro.
- **BR-005 · Filtros propios.** Prioridad, motivo de entrada, estado y
  vencimiento (BR-095) se declaran como selectores adicionales de la misma
  barra. Vencimiento y los estados abiertos solo existen en la vista
  «Abiertos»; en «Resueltos», estado ofrece recuperada o perdida.
- **BR-006 · Los indicadores cuentan sobre el alcance, no sobre la
  página.** Búsqueda, equipo y responsable acotan también las cifras de
  cabecera —son «mi cartera», «los vencidos de mi cartera»—; prioridad,
  motivo, estado y vencimiento solo acotan la lista. Cada indicador de
  vencimiento sigue abriendo exactamente lo que cuenta (SPEC-040 BR-001),
  conservando la búsqueda, el equipo y el responsable vigentes.
- **BR-007 · La URL solo estrecha.** Un equipo o un responsable fuera del
  alcance del rol se ignora; nunca amplía lo que el rol puede ver.

### Pedidos (PED-01)

- **BR-008 · Búsqueda en vivo.** El texto aplica solo tras 300 ms sin
  escribir y con al menos tres caracteres; Enter aplica al instante con
  cualquier largo; vaciar el campo aplica al instante. Sustituye a SPEC-011
  BR-005 («Buscar conserva una acción explícita»): la acción explícita hoy
  es Enter, y el botón desaparece.
- **BR-009 · Selector de asesor dentro del alcance.** Se ofrece a los mismos
  asesores que se pueden asignar (miembros activos con venta habilitada de
  los equipos visibles); un id ajeno cae en «Todos». Con un equipo elegido,
  el selector ofrece solo a los suyos; «Sin asignar» no tiene asesor que
  ofrecer. Al cambiar de equipo, el asesor elegido se conserva solo si
  pertenece al nuevo.
- **BR-010 · Todo conserva todo.** Búsqueda, equipo, asesor, plazo y acción
  viajan juntos con período, rango y vista; cualquier cambio vuelve a la
  primera página. El asesor acota también las cifras de cabecera, como ya
  lo hacía el equipo (SPEC-010 BR-008).
- **BR-011 · La tarjeta de gestión no se desmonta.** El cambio de filtro es
  una navegación de la misma ruta: el estado local de la bandeja sobrevive.
  Si la venta seleccionada deja de pertenecer al filtro, rige el aviso ya
  existente «esta venta salió de la bandeja» (SPEC-029): no se reemplaza por
  otra.

### Pedidos (PED-02)

- **BR-012 · Filtro por acción derivada.** Solo en «Entregas fallidas por
  gestionar». Acepta el grupo de un indicador (visita por coordinar,
  contactar y validar, por volver a ingresar) o una acción exacta de
  SPEC-029 BR-019 (reagendar, otro punto, contactar, verificar, reingresar,
  esperar). «Reagendar» muestra solo pedidos cuya acción derivada es
  reagendar. Al salir de la vista logística, el filtro no viaja.
- **BR-013 · Los indicadores abren la lista que explican.** Cada cifra del
  filtro logístico enlaza a la lista acotada por su grupo, y la lista cuenta
  exactamente lo mismo que la cifra. El indicador «Fuera de plazo» abre los
  activos fuera de plazo.
- **BR-014 · Filtro por plazo.** Cuatro tramos con la misma regla que rotula
  la fila: fuera de plazo (vencimiento antes de ahora), vence en 30 minutos,
  sin horario asignado (entrega regular sin turno) y todavía sin plazo (sin
  fecha, no regular). Lo entregado y lo cancelado no tiene plazo y queda
  fuera de los cuatro. Aplica en cualquier vista.
- **BR-015 · El alcance histórico se conserva.** Las entregas fallidas
  siguen ignorando el período (SPEC-029 BR-025); acción y plazo se suman a
  ese alcance, no lo recortan por fecha.
- **BR-016 · Filtrar no cambia nada.** Ningún filtro escribe en la orden ni
  en la escalación: son lecturas.

### Pedidos ↔ Recupero (NAV-02)

- **BR-017 · El pedido enseña su último caso, abierto o resuelto.** Antes
  solo mostraba el abierto; un pedido cuyo recupero terminó parecía no haber
  pasado por recupero. Ahora dice «En recuperación» con estado, prioridad y
  responsable, o «Recupero cerrado» con el resultado y la fecha, y en ambos
  casos enlaza al caso. Reenviar a recupero sigue posible solo cuando no hay
  caso abierto (índice parcial de un abierto por venta).
- **BR-018 · Pedidos no son casos.** La cola «Por recuperar» de Pedidos son
  pedidos del mes no entregados o cancelados; los casos de recupero viven en
  Recupero de ventas, y la cola lo dice y enlaza. La orden conserva su
  historial y su atribución: el caso vive aparte.

### Gestión desde la fila (REC-04)

- **BR-019 · La fila trae lo que hace falta para llamar.** Teléfono de
  entrega y DNI copiables con un clic; la última gestión con su resultado,
  observación y hora, como referencia antes de registrar la siguiente.
- **BR-020 · Registrar sin salir, con las reglas de BR-090.** «Registrar
  gestión» abre en la fila el mismo editor de Campañas: una sola gestión
  abierta a la vez, clave de idempotencia por borrador, la fila se actualiza
  con lo que el servidor confirmó y no se reordena bajo las manos del asesor;
  la paginación pregunta antes de perder un borrador. El servidor aplica la
  cadencia del carril interno (BR-066), no la de Campañas. Solo quien puede
  gestionar el caso (BR-029b: el asesor lo suyo, la supervisión su alcance) ve
  el botón; en resueltos no existe.
- **BR-021 · Reasignar se abre al pedirlo.** El formulario de reasignación
  deja de estar abierto en todas las filas: aparece al pulsar «Reasignar» (o
  «Asignar» si no hay responsable). La lista se compara sin formularios.

### Cadencia visible (REC-05)

- **BR-022 · La etapa se nombra con las reglas que la fijan.** Verificación
  (WAITING), agenda acordada o vencida (SCHEDULED), primer contacto con su
  hora límite (sin `firstContactAt`), pausa por rechazo (último resultado
  RECHAZA o CANCELADO), toque D1/D3/D7 (próxima acción a menos de un minuto
  del día exacto desde la toma), cadencia agotada (siete días cumplidos sin
  próxima acción futura) o seguimiento. La fila muestra la etiqueta y la
  ficha la explica; el vencimiento (BR-095) sigue siendo la misma función.
- **BR-023 · Plazo del recupero, no plazo de entrega.** La ficha explica la
  cadencia del carril interno (dos horas, D1/D3/D7, agenda suspende, rechazo
  pausa, séptimo día resuelve) y declara que es independiente del plazo de
  entrega de la venta y de la regla de tres intentos al día de Campañas.

## 4. Criterios de aceptación

- **AC-001:** en Recupero, «1942469714A», «71-6», «diego león» y el
  teléfono de entrega encuentran el mismo caso; un término de tres dígitos
  no filtra.
- **AC-002:** `?view=resueltos` lista recuperadas y perdidas con su
  resultado y fecha, sin formulario de asignación ni filtro de vencimiento.
- **AC-003:** con `?q=…&advisor=…`, los indicadores de vencimiento enlazan
  a `?q=…&advisor=…&vence=…` y sus cifras coinciden con la lista que abren.
- **AC-004:** en Pedidos, escribir «an» no navega; «ana» navega a los 300
  ms; Enter con «19» navega al instante.
- **AC-005:** el selector de asesor de un supervisor solo ofrece a los
  asesores de sus equipos; un `advisor=` ajeno devuelve la bandeja completa
  del alcance.
- **AC-006:** en la vista logística, «Contactar y validar = N» abre una
  lista de exactamente N pedidos; `?accion=RESCHEDULE` no incluye ningún
  pedido con acción «Otro punto».
- **AC-007:** «Fuera de plazo = N» abre `status=ACTIVE&plazo=vencido` con
  exactamente N pedidos.
- **AC-008:** los filtros activos aparecen como fichas quitables y «Limpiar
  filtros» los retira todos conservando período y vista.
- **AC-009:** tipos, lint y pruebas en verde; reglas puras probadas en
  `@repo/validation`.
- **AC-010:** un pedido con caso abierto muestra «En recuperación» y un
  enlace a `/recovery/sales/<id>`; con caso resuelto muestra «Recupero
  cerrado» con fecha, el mismo enlace y permite enviar otra vez.
- **AC-011:** en Recupero, ninguna fila trae el formulario de reasignación
  abierto; «Reasignar» lo abre solo en esa fila.
- **AC-012:** «Registrar gestión» abre el editor en la fila con los
  teléfonos del caso; tras guardar, la fila muestra el resultado confirmado
  y deja de estar vencida; quien no puede gestionar no ve el botón.
- **AC-013:** una próxima acción a exactamente 3 días de la toma se rotula
  «Toque D3»; un rechazo se rotula pausa y no toque; una agenda futura
  suspende y una pasada vence; siete días cumplidos sin acción futura se
  rotulan «Cadencia agotada».
