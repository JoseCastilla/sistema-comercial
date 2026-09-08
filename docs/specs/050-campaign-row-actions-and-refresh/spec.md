# SPEC-050 — Campañas: acciones por fila y actualización tras guardar

**Estado:** `BORRADOR` — propuesta de José revisada contra el código el 08/09/2026; cinco decisiones abiertas con recomendación, pendientes de su confirmación

> Propuesta «campanas_asesor» (08/09/2026), continuación de SPEC-049 sobre
> las vistas de trabajo y la gestión en fila. Conserva SPEC-048 (agenda) y
> SPEC-049 (consecuencias, vistas, «Guardar y siguiente», rectificación).

## 1. Origen

Con SPEC-049 la bandeja dice qué toca y se divide en vistas, pero la fila
sigue teniendo un solo botón, «Registrar gestión», aunque lo que toque sea
vincular una orden o cerrar un caso; al guardar, la fila dice «actualiza la
cola para ver qué toca» en vez de aplicar lo que el servidor ya confirmó;
y la devolución de un caso por el cruce de portabilidad no se reconoce como
devolución. La propuesta cierra esas brechas y ordena la pantalla.

## 2. Revisión de la propuesta contra el código (08/09/2026)

### 2.1 Tras guardar, la fila no aplica la consecuencia (CAM-UX-03)

`campaign-queue-row.tsx` muestra, tras guardar, «Actualiza la cola para ver
qué toca», aunque la acción ya devuelve `workView` y la frase de
consecuencia (SPEC-049 fase 1). Los contadores del carril y la cabecera son
de servidor y no cambian hasta la siguiente navegación. SPEC-030 BR-090
decidió a propósito que **la fila no se mueve al guardar**: reordenar bajo
las manos del asesor fue un defecto real de la primera versión.

**Decisión:** la fila aplica la consecuencia confirmada (qué toca y a qué
vista pasa) sin moverse; los contadores del carril se ajustan en el cliente
con lo confirmado; y la lista se refresca sola **cuando no queda ninguna
gestión abierta** (al cerrar el editor o al terminar «Guardar y siguiente»
sin siguiente), nunca mientras se edita (BR-003, BR-004).

### 2.2 El cruce también devuelve, y no se reconoce (CAM-UX-04)

El selector de SPEC-048/049 reconoce la devolución solo por el evento
`CASE_REOPENED` (supervisor que desmiente un «ya es Movistar»). El cruce
(`recovery-portability.service.ts`) escribe `PORTABILITY_CROSSED` con
`previousStatus = WAITING` y `newStatus` `ASSIGNED` («el reporte dice que la
línea sigue portable: vuelve a la cola de su asesor»), `SCHEDULED` (portó a
otro operador hace poco: se agenda a la habilitación) o `TRIAGE` (sin
dueño). No todo cruce es una devolución: los que descartan o confirman
pérdida escriben otros eventos, y el paso a `SCHEDULED` es una habilitación.

**Decisión:** devolución = `CASE_REOPENED`, o `PORTABILITY_CROSSED` que sale
de `WAITING` a `ASSIGNED` con dueño; ambas con origen (supervisor o cruce),
fecha y motivo (la observación del evento) visibles y con el rango de
BR-013 de SPEC-049 (BR-005, BR-006).

### 2.3 Un caso recién asignado dice «Volver a intentar» (CAM-UX-05)

Repartir y tomar bloques fijan la próxima acción en «ahora»
(`distribute-recovery-cases-action.ts`, `take-recovery-pool-block-action.ts`),
así que un caso sin ningún intento entra al selector como reintento de
cadencia. «Volver a intentar» sobre alguien a quien nadie llamó es falso.

**Decisión:** elemento nuevo «Primer contacto» cuando el caso no tiene
intentos (BR-007). El filtro por tarea operativa usa los mismos elementos
(BR-008).

### 2.4 Dos selectores de vistas y una tabla ancha (CAM-UX-06)

La cabecera de la bandeja tiene tres cifras que abren vistas y, debajo, el
carril con las mismas vistas y cantidades: dos selectores para lo mismo. La
tabla lleva diez columnas y el cliente, el teléfono y la acción quedan
lejos en pantallas medianas. «Tomar casos libres» ocupa un panel entero
cada vez.

**Decisión:** un solo selector (el carril, con cantidades); cabecera con lo
que no es vista (sin los tres intentos, casos libres); columnas
reordenadas para que cliente, teléfono y acción principal vayan primero y
lo secundario pase a «Ver datos»; «Tomar casos libres» compacto (BR-009 a
BR-011).

### 2.5 Acciones rápidas (CAM-UX-01)

Ya existen N, I, R, A (SPEC-049 fase 1). La propuesta pide «Tiene pedido»
como acceso directo y agrupar el resto sin duplicar el formulario. Hoy
«tiene pedido» son dos resultados distintos (`INTERESADO_CON_PEDIDO`,
`TIENE_PEDIDO`) que difieren solo en si el interés está confirmado.

**Decisión:** cinco accesos directos —No contesta, Interesado, No
interesado, Agendar, Tiene pedido— y el resto en el desplegable; «Tiene
pedido» abre una única pregunta, «¿confirmó que le interesa?», que decide
entre los dos resultados (BR-001, BR-002). Elegir no guarda; se confirma con
Guardar o Guardar y siguiente (ya vigente).

### 2.6 Lo que se acepta tal cual

CAM-UX-02 (acción principal según la tarea), los requisitos de CAM-UX-03
sobre borradores y avance solo tras guardado (ya vigentes en SPEC-049
BR-016), y CAM-UX-07, que es el recorrido funcional que José hace con
cuentas de prueba: esta spec lo lista en `verification.md` junto con lo
pendiente de SPEC-048 y SPEC-049.

## 3. Alcance

La bandeja `/recovery/campaigns` (fila, editor, carril, cabecera, filtros),
el selector de SPEC-048 (`recovery-agenda.ts`) y sus lectores (ficha,
agenda). Población `NATIONAL_BASE` del asesor autenticado. Sin permisos
nuevos; cada acción principal usa la operación que ya existe con sus
validaciones.

## 4. Reglas

### Acciones rápidas (CAM-UX-01)

- **BR-001:** cinco accesos directos con tecla: N No contesta, I
  Interesado, R No interesado, A Agendar, P Tiene pedido. Los demás
  resultados siguen en el desplegable; no hay un segundo formulario.
- **BR-002:** «Tiene pedido» pregunta «¿confirmó que le interesa?»: sí →
  `INTERESADO_CON_PEDIDO` (BR-086, al frente mañana); no → `TIENE_PEDIDO`
  (seguimiento ordinario). Los campos del resultado elegido son los de
  SPEC-049 BR-009; elegir no guarda.

### Acción principal según la tarea (CAM-UX-02)

- **BR-003:** el botón de la fila depende de qué toca: «Registrar gestión»
  para primer contacto, reintento, seguimiento, habilitación y cita
  vencida; «Vincular orden» para completar venta; «Revisar cierre» para
  cerrar como rechazo definitivo; «Resolver datos inválidos» sin teléfonos
  válidos; en espera, «Ver motivo» (despliega por qué y cómo termina) y,
  si es una cita, «Gestionar cita» (panel de la agenda). Cada botón lleva a
  la operación existente con sus validaciones y permisos.

### Actualizar tras guardar (CAM-UX-03)

- **BR-004:** la fila aplica lo confirmado por el servidor: nuevo «Qué
  toca», vista destino («pasa a En espera hasta el jueves»), próxima
  acción e intentos de hoy. No se mueve ni desaparece mientras el asesor
  trabaja (SPEC-030 BR-090); si su vista destino no es la actual, se
  atenúa y lo dice.
- **BR-005:** los contadores del carril se ajustan en el cliente con la
  vista confirmada (−1 en la actual, +1 en la destino). Cuando no queda
  ninguna gestión abierta —el asesor cierra el editor, o «Guardar y
  siguiente» no tiene siguiente— la lista se refresca del servidor y los
  casos que cambiaron de vista salen de ella. Los borradores de otras
  filas no se tocan porque solo hay uno abierto a la vez (BR-090).

### Devoluciones (CAM-UX-04)

- **BR-006:** devolución = evento `CASE_REOPENED` (supervisor) o
  `PORTABILITY_CROSSED` con `previousStatus = WAITING` y `newStatus =
  ASSIGNED` (cruce: sigue portable), posterior al último intento. Un cruce
  que agenda a la habilitación (`SCHEDULED`) es habilitación; uno que
  descarta o cierra no es devolución. La bandeja, la ficha y la agenda
  muestran origen (quién, o «el cruce»), fecha y motivo, y aplican el
  rango 2 de SPEC-049 BR-013.

### Filtros y etiquetas (CAM-UX-05)

- **BR-007:** «Primer contacto» es un elemento propio: caso sin intentos.
  «Volver a intentar» exige al menos uno.
- **BR-008:** la bandeja filtra por tarea operativa (los elementos del
  selector: primer contacto, reintento, seguimiento, habilitación, cita,
  completar venta, cerrar, resolver datos, verificación) con la cantidad de
  cada una en la vista actual; el resultado dice «N de M en esta vista».
  Las alertas de compromisos (SPEC-048 BR-012) y las cifras de cabecera no
  dependen de los filtros.

### Espacio y controles (CAM-UX-06)

- **BR-009:** un solo selector de vistas: el carril con cantidades. La
  cabecera conserva «Sin los 3 intentos de hoy» y «Casos libres».
- **BR-010:** «Tomar casos libres» se muestra en una línea —cantidad,
  filtro y botón— y se despliega solo si el asesor lo pide.
- **BR-011:** orden de columnas: Cliente (con DNI copiable debajo),
  Teléfono, Qué toca con la acción principal, Último resultado con la
  observación, Intentos hoy. Operador, plan y próxima acción pasan a «Ver
  datos». Sin desplazamiento horizontal a 1280 px de ancho.

## 5. Decisiones abiertas, resueltas con recomendación

| Decisión | Recomendación | Por qué |
|---|---|---|
| Refrescar la lista tras guardar | Solo cuando no queda gestión abierta; mientras tanto la fila aplica lo confirmado y los contadores se ajustan en el cliente | Conserva BR-090 (la fila no se mueve bajo las manos) y cumple «retirar de Trabajar ahora» en cuanto el asesor suelta la lista |
| Qué cruce cuenta como devolución | `WAITING → ASSIGNED` con dueño; `SCHEDULED` es habilitación; descartes no | Es la única transición donde el reporte contradice al asesor y devuelve la oportunidad |
| «Tiene pedido» como acceso directo | Un botón y una pregunta «¿confirmó interés?» que decide entre los dos resultados | Evita dos botones parecidos y no afirma interés sin evidencia (SPEC-049 BR-005) |
| Columnas de la fila | Cliente, Teléfono, Qué toca + acción, Último resultado + observación, Intentos hoy; el resto en «Ver datos» | Lo que se usa durante la llamada a la vista; lo demás a un clic |
| Cifras de cabecera | Quitar las tres de vistas; queda el carril | Un solo selector; las cifras no se duplican |

## 6. Criterios de aceptación

- **AC-001:** pulsar P abre la pregunta de interés; «sí» guarda
  `INTERESADO_CON_PEDIDO`; «no», `TIENE_PEDIDO`; nada se guarda hasta
  confirmar.
- **AC-002:** un caso con «Completar venta» muestra «Vincular orden» y abre
  la sección de resolver; uno con «Cerrar como rechazo definitivo» muestra
  «Revisar cierre»; uno sin teléfonos válidos, «Resolver datos inválidos».
- **AC-003:** al guardar «No interesado» desde Trabajar ahora, la fila dice
  «pasa a En espera hasta el …», no se mueve, el carril resta uno a
  Trabajar ahora y suma uno a En espera; al cerrar el editor, la fila
  desaparece de Trabajar ahora.
- **AC-004:** un caso devuelto por el cruce (WAITING → ASSIGNED) muestra
  «devuelto de verificación · el cruce · fecha» y va en el rango 2 de
  Trabajar ahora; uno agendado por el cruce a la habilitación no aparece
  como devuelto.
- **AC-005:** un caso recién asignado sin intentos muestra «Primer
  contacto», no «Volver a intentar».
- **AC-006:** el filtro por tarea muestra cantidades y «N de M en esta
  vista»; el bloque «Compromisos por atender» sigue visible con cualquier
  filtro.
- **AC-007:** a 1280 px la tabla no desplaza horizontalmente y cliente,
  teléfono y acción principal se ven sin abrir nada.

## 7. Fuera de alcance

- Tipificación masiva, reapertura de casos resueltos, permisos nuevos.
- Cambios en el carril interno de recupero de ventas.
- Refrescar la lista mientras hay una gestión abierta.
