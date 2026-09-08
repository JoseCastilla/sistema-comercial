# SPEC-049 — Gestión ágil y tipificación de campañas

**Estado:** `EN_CURSO` — decisiones de §5 confirmadas por José el 08/09/2026; fases 1 (consecuencias y tipificación), 2 (estado operativo y vistas), 3 (Guardar y siguiente) y 4 (rectificación) entregadas el 08/09/2026, pendientes de recorrido local y lectura de producción; fase 5 (calidad de datos) sin construir

> Propuesta «Gestión ágil y tipificación de campañas» (08/09/2026). Conserva
> la agenda de SPEC-048 y el plan «Filtros y ranking por recencia comercial»
> (CAM-F01 a CAM-F06, que sigue fuera del repositorio: esta spec absorbe lo
> que necesita de él, §2.6). Se apoya en SPEC-030 (BR-032 a BR-040, BR-057,
> BR-085 a BR-090) y en SPEC-048 (selector «un caso, un elemento»).

## 1. Origen

La bandeja del asesor es una sola lista con todo lo que tiene a su cargo:
lo que toca llamar ahora, lo que está pausado hasta pasado mañana, lo que
espera verificación y lo que ya vendió y falta vincular. Ordena por próxima
acción, así que lo exigible queda arriba, pero nada le dice al asesor por
qué un caso está donde está ni qué corresponde hacer con él. Y la
tipificación tiene una pregunta —qué pasó— cuando la operación necesita
tres: qué pasó, por qué, y qué sigue.

## 2. Revisión de la propuesta contra el código (08/09/2026)

La propuesta es coherente con SPEC-030 y con lo construido en SPEC-048.
Hallazgos que cambian el plan, cada uno con su decisión.

### 2.1 Cuatro resultados no tienen consecuencia propia

En `register-recovery-attempt-action.ts` solo `AGENDA`, `RECHAZA`,
`CANCELADO`, `YA_ACTIVO` e `INTERESADO_CON_PEDIDO` tienen efecto propio.
`NUMERO_ERRADO`, `NO_CUMPLE_30D`, `VENDIDO`, `INTERESADO` y
`DATOS_INVALIDOS` caen en la rama genérica: `IN_PROGRESS` y la cadencia
del día (tres intentos, mañana a las 09:00). Consecuencias concretas:

- **`NUMERO_ERRADO` no invalida el teléfono.** La columna
  `recovery_case_phones.invalid_marked_at` existe desde la fase 1 de
  SPEC-030 y **nadie la escribe**: el número errado sigue apareciendo
  primero en la fila y en la ficha. Solo la puerta `DATOS_INVALIDOS` de
  BR-057 lo cuenta, y lo cuenta por intentos, no por teléfono.
- **`NO_CUMPLE_30D` no captura fecha.** SPEC-030 BR-038 (captura manual de
  antigüedad) sigue abierta desde agosto; el caso vuelve a la cadencia como
  si nada, y el asesor lo llama mañana a un cliente que no puede portar
  hasta octubre.
- **`VENDIDO` no abre nada.** SPEC-048 lo deriva como «Completar venta» en
  la agenda, pero la bandeja lo devuelve a la cadencia y el asesor lo ve
  como un caso más por llamar.

**Decisión:** cada resultado define estado, próxima acción y vista destino
(BR-001 a BR-006). Cierra BR-038 de SPEC-030.

### 2.2 El estado operativo no existe; solo el último resultado

La fila muestra la etiqueta del estado del caso («Asignado», «En
gestión», «Agendado») y la última tipificación. Cuando un supervisor
desmiente un «ya es Movistar» (`verify-reported-active-action.ts`,
`DESMENTIR`), el caso vuelve `ASSIGNED` con próxima acción inmediata y
evento `CASE_REOPENED`, pero la fila sigue diciendo «Ya está activo en
Movistar»: el asesor no distingue su reporte de la devolución. Lo mismo
con una pausa vencida frente a una vigente.

**Decisión:** el estado operativo se deriva con el selector de SPEC-048
(«un caso, un elemento»: qué toca, de dónde sale, cuándo) ampliado con la
devolución de verificación, y se muestra separado del último resultado
(BR-007, BR-008).

### 2.3 «No contesta» está preseleccionado y «Cancelado» pausa

`campaign-attempt-editor.tsx` arranca con `SIN_RESPUESTA` elegido: un
clic de más guarda «no contesta» sin que haya pasado. `CANCELADO` pausa
uno o dos días igual que `RECHAZA` (se añadió para corregir errores sin
perder el registro), pero su nombre sugiere cierre. «Apagado» y
«Ocupado» quedaron fuera a propósito en BR-090 hasta definir su efecto.

**Decisión:** sin resultado preseleccionado; motivos de no contacto
(`NO_CONTESTA`, `APAGADO`, `OCUPADO`) como campo del resultado
`SIN_RESPUESTA`, no como resultados nuevos, para que la cadencia y la
puerta `INUBICABLE` sigan contando lo mismo; `CANCELADO` sale de la lista
de opciones nuevas y se conserva en el historial (BR-009 a BR-011).

### 2.4 Rectificar choca con BR-035, y se resuelve como en SPEC-048

Un intento registrado es inmutable (SPEC-030 BR-035). La propuesta pide
corregir errores con trazabilidad sin contar un contacto nuevo. **Decisión:**
la rectificación es un registro propio de solo añadir que apunta al intento
original y declara el resultado efectivo; el original no se toca; la
cadencia, las puertas de pérdida y los contadores leen el **resultado
efectivo** (BR-016 a BR-018). Es la misma técnica que la cita acordada de
SPEC-048 BR-002.

### 2.5 El pedido ajeno con interés desconocido no cabe en BR-086

`INTERESADO_CON_PEDIDO` es «el lead más caliente» (BR-086): ya dijo sí.
Un cliente que solo dice «ya me mandaron un chip» no ha dicho nada de
interés, y tratarlo como caliente infla la prioridad. **Decisión:** resultado
nuevo `TIENE_PEDIDO` con la misma revalidación diaria de líneas y el mismo
responsable, pero como seguimiento ordinario, no al frente (BR-005).

### 2.6 El plan de recencia sigue fuera del repositorio

Como en SPEC-048 §2.4: la bandeja no tiene tramos de recencia ni ranking
por recencia; solo el pool los tiene (BR-078, BR-092). **Decisión:** esta
spec fija el orden de «Trabajar ahora» y reutiliza el filtro `age=` de
BR-092 (BR-013, BR-014). Si el plan CAM-F01 a CAM-F06 llega, comparte
estas piezas.

### 2.7 Lo que se acepta tal cual

Las cinco vistas, los tres campos de la tipificación, los flujos
`SIN_CONTACTO`, `INTERESADO`, `RECHAZO`, `NO_CONTACTAR`, `ACEPTACION`,
`YA_MOVISTAR` e `IMPEDIMENTO`, «Guardar y siguiente», la revisión de
calidad sin cambios automáticos, la lista de validación y los límites
(no cerrar para limpiar, no tipificar en masa, no confundir aceptación con
recuperación ni con entrega, no ampliar permisos del asesor).

## 3. Alcance

- **Superficies:** la bandeja `/recovery/campaigns` (vistas y panel de
  gestión), el registro de intentos (bandeja y ficha), la ficha (estado
  operativo, teléfonos, rectificación) y Seguimiento (revisión de calidad).
- **Población:** casos `NATIONAL_BASE` del asesor autenticado; la
  supervisión conserva sus superficies. Fuentes no se mezclan (BR-075).
- **Permisos:** los de hoy (SPEC-030 §Antifraude, SPEC-048 BR-010). Nada
  nuevo para `AGENT`.

## 4. Reglas

### Consecuencias de cada resultado (CAM-T01)

- **BR-001 — Cada resultado tiene consecuencia declarada.** Estado del
  caso, próxima acción, elemento de agenda (SPEC-048 BR-004) y vista
  destino, en una tabla única en `@repo/validation` que leen la acción de
  registro, la bandeja, la ficha y la agenda. La tabla:

  | Resultado | Campos que pide | Estado · próxima acción | Vista destino |
  |---|---|---|---|
  | `SIN_RESPUESTA` (+ motivo) | motivo: no contesta / apagado / ocupado | `IN_PROGRESS` · cadencia BR-032 | Trabajar ahora cuando toque |
  | `INTERESADO` | qué sigue: llamada acordada (fecha y hora) o seguimiento (fecha) | `SCHEDULED` con cita, o `IN_PROGRESS` con próxima acción | Mi agenda o Trabajar ahora |
  | `RECHAZA` | pausa 1–2 días | `IN_PROGRESS` · fin de la pausa (BR-033) | En espera |
  | `NO_CONTACTAR` | observación obligatoria | `IN_PROGRESS` · ahora, con tarea «cerrar como rechazo definitivo» habilitada (BR-057) | Por completar hasta resolver; Historial después |
  | `VENDIDO` | orden a vincular si ya existe; si no, queda la tarea | `IN_PROGRESS` · ahora | Por completar |
  | `NO_CUMPLE_30D` | línea afectada; fecha de portación informada o «no la sabe» | ver BR-003 | En espera o Trabajar ahora |
  | `INTERESADO_CON_PEDIDO` | — | BR-086 sin cambio | Trabajar ahora (mañana, al frente) |
  | `TIENE_PEDIDO` | — | `SCHEDULED` · mañana 09:00, revalidación diaria | En espera |
  | `NUMERO_ERRADO` | teléfono afectado (el usado) | ver BR-002 | Trabajar ahora o Por completar |
  | `YA_ACTIVO` | — | `WAITING` (BR-085) sin cambio | En espera |
  | `IMPEDIMENTO` | motivo (huella / otro), detalle, qué sigue (fecha) y si pide apoyo del supervisor | `IN_PROGRESS` · la fecha dada | Trabajar ahora cuando toque; aviso al supervisor si pidió apoyo |
  | `AGENDA` | fecha y hora | SPEC-048 BR-003 sin cambio | Mi agenda |
  | `DATOS_INVALIDOS` | — | `IN_PROGRESS` · ahora, puerta `DATOS_INVALIDOS` | Por completar |
  | `CANCELADO` | no se ofrece (BR-011) | histórico | — |

- **BR-002 — Número errado afecta al teléfono, no al caso.** Registrar
  `NUMERO_ERRADO` escribe `invalid_marked_at` en el teléfono usado; la fila
  y la ficha lo muestran tachado y ofrecen el siguiente. Con al menos un
  teléfono válido el caso sigue en cadencia con ese número; sin ninguno,
  pasa a Por completar con la tarea «resolver: sin teléfonos válidos»
  (puerta `DATOS_INVALIDOS`, BR-057). Un solo teléfono errado nunca cierra
  un caso.
- **BR-003 — No cumple antigüedad completa el dato o lo deja pendiente.**
  El asesor identifica la línea; si el cliente dio la fecha de portación,
  se guarda como **informada por el cliente** (distinta de la verificada
  por el reporte), la habilitación se calcula a treinta días (BR-037) y se
  consolida en el caso (SPEC-048 BR-006). Si no la sabe, queda la tarea
  «pedir fecha de portación» en la cadencia. El caso se suspende (En
  espera) **solo si ninguna línea activa es trabajable**; con otra línea
  habilitada sigue en Trabajar ahora con esa línea señalada. Cierra
  SPEC-030 BR-038.
- **BR-004 — Aceptar no es recuperar.** `VENDIDO` deja el caso en Por
  completar con la tarea «vincular la orden»; la recuperación sigue
  exigiendo la orden DITO con confirmación humana (BR-042). Por completar
  cuenta cuántas aceptaciones llevan más de un día sin orden.
- **BR-005 — Pedido ajeno con y sin interés.** `INTERESADO_CON_PEDIDO`
  conserva BR-086 íntegra. `TIENE_PEDIDO` (interés no confirmado) entra en
  la misma revalidación diaria de líneas y conserva responsable, pero es
  seguimiento ordinario: no va al frente y no afirma interés.
- **BR-006 — El impedimento no es rechazo.** `IMPEDIMENTO` exige motivo,
  detalle y qué sigue con fecha; «pide apoyo» lo señala al supervisor en
  Seguimiento y en el aviso flotante. Nunca pausa como `RECHAZA` ni
  habilita `RECHAZO_DEFINITIVO`.

### Estado operativo (CAM-T02)

- **BR-007 — La fila dice qué toca ahora.** Cada fila muestra el elemento
  del selector de SPEC-048 (qué toca, de dónde sale, cuándo) como estado
  operativo, y el último resultado con su fecha como dato aparte. Las
  vistas se calculan con ese selector y las reglas vigentes, nunca solo con
  el último resultado.
- **BR-008 — La devolución de verificación se ve.** Un caso devuelto por
  el supervisor o por el cruce (evento `CASE_REOPENED` posterior al último
  intento `YA_ACTIVO`) muestra «Devuelto de verificación: sigue portable»
  como origen del reintento, con quién lo devolvió y cuándo.

### Tipificación (CAM-T03)

- **BR-009 — Nada preseleccionado.** El formulario abre sin resultado; los
  frecuentes (no contesta, interesado, no interesado, agendar) tienen
  acceso directo con una tecla; los campos adicionales aparecen solo para
  el resultado elegido; la consecuencia operativa se muestra **antes** de
  guardar («queda pausado hasta el jueves», «pasa a verificación»).
- **BR-010 — Tres preguntas, no una observación.** Resultado, motivo o
  impedimento, y siguiente acción son campos; la observación es libre y
  nunca sustituye a los que la consecuencia necesita. Una llamada
  interrumpida es `SIN_RESPUESTA · ocupado`, no rechazo; un problema de
  huella es `IMPEDIMENTO`, no falta de interés.
- **BR-011 — Compatibilidad con lo registrado.** Los valores del enum se
  conservan; los motivos viven en una columna nueva y nula en los
  históricos; `CANCELADO` deja de ofrecerse y se muestra como «Cancelado
  (registro anterior)».

### Vistas de trabajo y espera (CAM-T04)

- **BR-012 — Cinco vistas, una población.** `vista=ahora|completar|espera
  |historial` (más Mi agenda, SPEC-048). Cada caso abierto está en
  exactamente una de las tres primeras; los resueltos, en Historial. Los
  contadores cuentan toda la población de la vista, no la página.
- **BR-013 — Trabajar ahora muestra solo lo exigible**, en este orden:
  llamadas acordadas vencidas, habilitaciones vencidas, devueltos de
  verificación, y después **lo más reciente primero** (`last_sighting_at`
  descendente), con la próxima acción como desempate. Una pausa vigente,
  una verificación, una cita futura o una habilitación futura no aparecen
  aquí. El bloque «Compromisos por atender» (SPEC-048 BR-012) sigue
  encima, fuera de los filtros.
- **BR-014 — Recencia como filtro, no como ocultamiento.** El filtro
  `age=` de BR-092 estrecha la lista; las alertas de compromisos y las
  cifras de cabecera no dependen de él.
- **BR-015 — Cada espera se explica.** En espera muestra por qué (pausa por
  rechazo, habilitación, verificación, pedido ajeno), cómo termina (fecha,
  reporte o supervisor) y quién lo devuelve; Historial muestra la
  resolución, quién y cuándo, y enlaza la orden recuperada.

### Panel de gestión y siguiente (CAM-T05)

- **BR-016 — «Guardar y siguiente».** Desde la fila se guarda y, solo
  cuando el servidor confirmó, el foco pasa al siguiente caso exigible de
  la lista, cuya elegibilidad y permiso vuelve a comprobar el servidor al
  guardar (un caso que ya no está a cargo devuelve «actualiza la cola»).
  El borrador se conserva ante error y la clave de idempotencia evita el
  doble registro (BR-090). Teclado: Enter guarda, Esc cierra, flechas
  cambian de fila con foco visible. El panel muestra teléfonos válidos,
  dirección y últimas gestiones sin salir de la bandeja.

### Rectificación (CAM-T06)

- **BR-017 — La rectificación es un registro propio.** Tabla
  `recovery_case_attempt_corrections`: intento original, resultado y
  motivo efectivos, observación, motivo de la corrección, autor y momento.
  El original no se edita ni se borra. No cuenta como contacto: la
  cadencia, la cobertura, las puertas de pérdida y «intentos hoy» leen el
  resultado efectivo con la fecha del original.
- **BR-018 — Efectos recalculados por regla, no a mano.** Al rectificar,
  la consecuencia del resultado efectivo (BR-001) se aplica **desde el
  momento de la corrección**: una pausa por un rechazo que no fue se
  levanta ya; un «vendido» que era «interesado» vuelve a la cadencia. Un
  caso resuelto no se rectifica: su flujo es la reapertura autorizada
  (SPEC-030). Quién puede: el autor del intento el mismo día de Lima; el
  supervisor de su equipo dentro de siete días; `ADMIN` siempre.

### Calidad de datos (CAM-T07)

- **BR-019 — Revisar, no corregir en masa.** Una consulta lista intentos
  cuyo resultado y observación podrían discrepar (por ejemplo,
  `SIN_RESPUESTA` con «interesado» o «llamar mañana» en la observación;
  `RECHAZA` con «huella»). Seguimiento las presenta al supervisor para
  revisar caso por caso con la rectificación de BR-017. Nada cambia solo;
  ningún caso se cierra ni se pausa desde texto libre.

## 5. Decisiones abiertas, resueltas con recomendación

Confirmadas por José una a una el 08/09/2026, con estos matices: la tecla
«N» registra «No contesta · no contesta» sin abrir el motivo; «Cerrar ahora
como rechazo definitivo» aparece en el mismo panel tras «Solicita no ser
contactado»; desde Historial no se actúa; la rectificación aplica la
consecuencia desde el momento de corregir, nunca hacia atrás.


| Decisión | Recomendación | Por qué |
|---|---|---|
| ¿Motivos de no contacto como resultados o como campo? | Campo `reason` del intento; el resultado sigue `SIN_RESPUESTA` | La cadencia y `INUBICABLE` no cambian; los históricos siguen valiendo |
| ¿`NO_CONTACTAR` cierra solo? | No: habilita la puerta y ofrece «cerrar ahora» en el mismo panel; la pérdida sigue siendo decisión explícita (BR-057) | Declarar `LOST` nunca es automático |
| ¿Quién rectifica y hasta cuándo? | Autor el mismo día; supervisor de su equipo 7 días; `ADMIN` siempre | Corrige el error de dedo sin abrir la puerta a reescribir la semana |
| ¿Qué ve el asesor en Historial? | Sus casos resueltos de los últimos 30 días | Suficiente para «¿qué pasó con este cliente?» sin cargar meses |
| Orden de Trabajar ahora | Exigibles primero, luego recientes primero | Es BR-078 aplicado a la cartera propia; lo urgente no espera a lo nuevo |

## 6. Criterios de aceptación

- **AC-001:** registrar «Agenda» retira el caso de Trabajar ahora y lo
  muestra en Mi agenda a su hora; registrar «No interesado» lo muestra en
  En espera con «hasta el jueves 09:00».
- **AC-002:** un teléfono errado queda tachado y el siguiente pasa a ser
  el primero; el caso sigue en Trabajar ahora; con todos errados pasa a
  Por completar y la puerta `DATOS_INVALIDOS` se habilita.
- **AC-003:** «Vendido» sin orden permanece en Por completar con la tarea
  visible; vincular la orden lo lleva a Historial como recuperado.
- **AC-004:** un «ya es Movistar» desmentido vuelve a Trabajar ahora con
  «Devuelto de verificación: sigue portable», quién y cuándo.
- **AC-005:** un caso aparecido hoy se ordena por encima de uno de hace
  tres días cuando ambos están exigibles; una llamada acordada vencida va
  por encima de los dos.
- **AC-006:** rectificar «No interesado» a «Interesado» levanta la pausa,
  no incrementa «intentos hoy», conserva el original visible y deja
  autor, motivo y momento.
- **AC-007:** bandeja, ficha y agenda muestran la misma siguiente acción
  para el mismo caso.
- **AC-008:** el formulario abre sin resultado; elegir «No contesta» pide
  motivo; elegir «Interesado» pide qué sigue; la consecuencia se lee antes
  de guardar.
- **AC-009:** «No cumple antigüedad» con fecha informada guarda la fecha
  como informada, calcula la habilitación y, si es la única línea, lleva
  el caso a En espera con la fecha; sin fecha deja la tarea «pedir fecha».
- **AC-010:** «Guardar y siguiente» solo avanza tras la confirmación del
  servidor; un doble envío no duplica; un caso que dejó de ser del asesor
  devuelve «actualiza la cola» sin perder el borrador.
- **AC-011:** los contadores de las cuatro vistas suman la cartera abierta
  más los resueltos de 30 días, sin solapamiento.

## 7. Fuera de alcance

- Tipificación masiva de cualquier tipo.
- Reapertura de casos resueltos (sigue el flujo de SPEC-030).
- Cambios en el carril interno de recupero de ventas (BR-075).
- Sincronización con herramientas externas.
- Permisos nuevos para `AGENT`.
