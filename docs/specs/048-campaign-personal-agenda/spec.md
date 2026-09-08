# SPEC-048 — Mi agenda: compromisos y próximas acciones del asesor de campaña

**Estado:** `BORRADOR` — fase 0 (hora de Lima) entregada y datos corregidos en producción el 08/09/2026 (787d26b, 30 citas); fases 1 (compromisos), 2 (Mi agenda: semana, día, lista) , 3 (reprogramar y cancelar desde la agenda) y 4 (recordatorios y carga) entregadas el 08/09/2026, pendientes de recorrido local y lectura de producción; fase 5 (mes) sin construir y decisiones de §5 pendientes de confirmación

> Propuesta «Agenda personal de campañas» (08/09/2026), ampliación del plan
> «Bandeja de campañas orientada a oportunidades recientes» (CAM-F01 a
> CAM-F06, que no está en el repositorio). Se apoya en SPEC-030 (BR-029b,
> BR-032 a BR-035, BR-039, BR-085, BR-086) y SPEC-040 BR-003. Conserva los
> requerimientos anteriores de la bandeja del asesor (BR-088 a BR-090).

## 1. Origen

La bandeja «Mi cola de campaña» ordena los casos del asesor por próxima
acción y muestra esa fecha en cada fila, pero no ofrece una vista temporal:
el asesor no puede ver de un vistazo qué compromisos tiene mañana a las
diez, cuántas llamadas acordadas caen el jueves ni qué hueco le queda para
agendar una más. Hoy «agendado» es una fila más entre cien.

La propuesta añade **Mi agenda** dentro de Campañas: una vista semanal,
diaria, en lista y mensual de los compromisos y tareas que salen de sus
casos, sin desplazar la gestión de la bandeja.

## 2. Revisión de la propuesta contra el código (08/09/2026)

La propuesta es coherente con las reglas vigentes y con lo construido. Estos
son los hallazgos que cambian el plan; cada uno lleva su decisión.

### 2.1 Hoy no existe una entidad «compromiso»

La agenda vive en dos columnas: `recovery_cases.next_action_at` (el reloj
único que ordena la bandeja, alimenta los tramos de SPEC-040 BR-003 y la
«Agenda vencida» del tablero) y `recovery_case_attempts.next_action_at`
(solo en intentos `AGENDA`). El estado `SCHEDULED` lo comparten tres
orígenes distintos: la cita acordada (`AGENDA`), el interesado con pedido
ajeno (`INTERESADO_CON_PEDIDO`, mañana a las 09:00) y la habilitación de
portabilidad. La pausa por rechazo, en cambio, deja el caso `IN_PROGRESS`
con próxima acción a uno o dos días.

**Consecuencia:** AG-R02 está bien fundada — `SCHEDULED` no significa cita —
y reprogramar sin crear un intento (AG-R05) es imposible con el esquema
actual: hoy la única forma de mover una agenda es registrar otro intento
`AGENDA`, que cuenta como llamada. Hace falta persistir la **cita acordada**
como registro propio (§4, BR-002). Las tareas automáticas —reintento,
seguimiento, habilitación, completar venta, verificación— **se derivan** del
caso y su último intento, como ya hace la bandeja: no se duplican en una
segunda agenda (AG-R01).

### 2.2 Defecto real: la hora acordada se guarda cinco horas antes en producción

El formulario envía el valor crudo del campo `datetime-local`
(`2026-09-09T10:00`, sin zona) y el servidor hace `new Date(raw)`, que
interpreta la cadena en la zona **del proceso**. El contenedor de la web no
fija `TZ` (Node 22 sobre `bookworm-slim`, sin `ENV TZ`), así que en
producción una cita a las 10:00 de Lima se guarda como 10:00 UTC, es decir
05:00 de Lima: el caso reaparece antes de que empiece la jornada y la fila
muestra las 05:00. En el equipo de desarrollo, con zona de Lima, el mismo
código funciona, por eso no se detectó. Comprobación:

```
TZ=UTC          node -e 'new Date("2026-09-09T10:00").toISOString()'  → 2026-09-09T10:00:00.000Z
TZ=America/Lima node -e 'new Date("2026-09-09T10:00").toISOString()'  → 2026-09-09T15:00:00.000Z
```

Afecta a `register-recovery-attempt-action.ts` (ficha y bandeja); es el
único campo de fecha y hora de la plataforma (los de Pedidos son solo fecha).

**Confirmado en producción el 08/09/2026** con
`docs/operacion/consultas/horas-agendadas-lima.sql`: de 45 citas, 32 caen
entre las 02:00 y las 07:00 de Lima. Y las 13 que parecen normales también
están corridas: su hora «acordada» coincide minuto a minuto con la hora de
registro menos cinco (registrada 18:35 → acordada 13:35; 17:38 → 12:37;
11:44 → 06:43): el asesor eligió «mañana a esta hora» y el sistema la
guardó cinco horas antes. **Todas las citas están corridas**, no solo las
de madrugada; 30 están vigentes. Se corrige el código **antes** de
construir la agenda (BR-001) y los datos con un script con evidencia
(`corregir-horas-agendadas-2026-09-08.sql`, plan §3): un calendario sobre
horas equivocadas es peor que ninguno.

### 2.3 «Ya puede portar» no tiene fuente fiable a nivel de caso

El cruce de portabilidad escribe `portability_eligible_at` **por línea**
(`recovery_case_services`); la columna homónima del caso la leen la bandeja,
Repartir y la toma de bloques, pero nadie la escribe. La captura manual de
antigüedad (SPEC-030 BR-038) sigue abierta. **Decisión:** la habilitación se
deriva de las líneas activas del caso —la fecha más temprana entre las no
descartadas— y el cruce consolida esa fecha en el caso al terminar (BR-006).

### 2.4 El plan anterior (CAM-F01 a CAM-F06) no está en el repositorio

La bandeja actual no tiene tramos de recencia comercial ni bloque de
«compromisos por atender»: los filtros de recencia existen solo en las colas
administrativas (SPEC-030 BR-092, `recovery-queue-filters.ts`). AG-R12 y la
«integración con ranking» de la propuesta presuponen ese plan. **Decisión:**
esta spec construye el bloque «Compromisos por atender» de la bandeja
(BR-012) y reutiliza los tramos de BR-092 para su propio filtro; cuando el
plan CAM-F01 a CAM-F06 llegue al repositorio, comparte ambas piezas. AG-R12
solo se verifica cuando la bandeja tenga filtros de recientes.

### 2.5 La pausa por rechazo falta en los tipos

Un caso pausado por `RECHAZA` o `CANCELADO` (SPEC-030 BR-033) vuelve a la
cola al vencer la pausa. No es cita ni cadencia ordinaria. **Decisión:** se
presenta como «Volver a intentar» con origen «pausa por rechazo» (BR-004,
BR-011).

### 2.6 Lo que se acepta tal cual

Vistas, bloques complementarios, navegación, datos visibles, acciones desde
el evento, integración con el ranking, fuera de alcance y lista de
validación. Los criterios CAM-F07 a CAM-F11 se conservan con su prioridad.

## 3. Alcance

- **Superficie:** `/recovery/agenda` («Mi agenda»), sección Campañas. Para
  `AGENT` y para el supervisor vendedor sobre sus propios casos. La
  supervisión de agendas ajenas queda fuera de esta versión (§7).
- **Población:** casos `NATIONAL_BASE` del asesor autenticado en
  `ASSIGNED`, `IN_PROGRESS`, `SCHEDULED` o `WAITING`, más sus citas
  atendidas, reprogramadas o canceladas para consulta histórica.
- **Fuente única:** bandeja, ficha y agenda leen el mismo selector puro
  (`@repo/validation`) sobre caso + último intento + citas acordadas.

## 4. Reglas

### Tipos y ciclo de vida (CAM-F07)

- **BR-001 — Hora de Lima, siempre.** Toda fecha y hora que el asesor escribe
  se interpreta en `America/Lima` (desfase fijo `-05:00`, sin horario de
  verano) sin depender de la zona del servidor ni del navegador; toda fecha
  se muestra en Lima. Corrige el defecto de §2.2 y cubre citas, pausas y
  reprogramaciones.
- **BR-002 — La cita acordada es un registro propio.** Tabla
  `recovery_case_commitments`: caso, fecha y hora acordadas, estado
  (`PENDING`, `DONE`, `RESCHEDULED`, `CANCELLED`), intento que la originó,
  intento que la atendió, compromiso que la sustituyó, motivo, actor y
  momento, y `client_request_id` único por caso. Los registros son de solo
  añadir: un estado cambia de `PENDING` a uno terminal y nunca vuelve; nada
  se edita ni se borra. Un caso tiene **a lo sumo una cita `PENDING`**
  (índice parcial).
- **BR-003 — Nace con el intento `AGENDA`.** Registrar `AGENDA` crea la cita
  en la misma transacción que el intento y fija `next_action_at` del caso a
  la misma hora; si existía una cita `PENDING`, queda `DONE` atendida por ese
  intento (hubo llamada). Reenviar el formulario con la misma clave no crea
  una segunda cita (BR-090).
- **BR-004 — Las tareas se derivan, no se guardan.** Del caso y su último
  intento salen, excluyentes y en este orden de comprobación:

  | Tipo | Etiqueta | Se deriva de | Presentación |
  |---|---|---|---|
  | `VERIFICACION` | Pendiente de verificación | estado `WAITING` | Listado aparte; sin fecha ni hora; no exige llamada |
  | `CITA_ACORDADA` | Llamada acordada | cita `PENDING` | Evento con fecha y hora exactas; ocupa su hora en la agenda |
  | `COMPLETAR_VENTA` | Completar venta | último intento `VENDIDO` y caso abierto | Tarea del día, sin hora |
  | `SEGUIMIENTO` | Seguimiento pendiente | último intento `INTERESADO_CON_PEDIDO` (BR-086) | Tarea con vencimiento (la mañana siguiente), sin hora |
  | `HABILITACION` | Ya puede portar | fecha de habilitación derivada de las líneas activas (§2.3), futura o vencida sin intento posterior | Recordatorio de fecha, sin hora |
  | `REINTENTO` | Volver a intentar | cualquier otro `next_action_at` (cadencia BR-032, pausa BR-033, retorno del cruce) | Tarea del día, sin hora |
  | `SIN_FECHA` | Sin gestión aún | `ASSIGNED` sin intentos y sin próxima acción | Bloque «Pendientes sin fecha» |

  Ninguna tarea automática ocupa una hora en la cuadrícula: su marca de
  tiempo es un centinela del sistema (las 09:00 del día siguiente, «ahora»),
  no un acuerdo con el cliente (AG-R02, AG-R10).
- **BR-005 — Estados de una cita.** `PENDING` mientras nadie la atiende,
  aunque su hora haya pasado (**vencida** = `PENDING` con hora anterior a
  ahora; conserva su fecha original, AG-R04). `DONE` cuando se registra un
  intento sobre el caso con la cita pendiente, cualquiera sea el resultado
  (AG-R06: atender es registrar el resultado; no existe «marcar como hecha»).
  `RESCHEDULED` cuando se reprograma; `CANCELLED` cuando se cancela o el caso
  se resuelve.
- **BR-006 — Habilitación consolidada.** El cruce de portabilidad escribe en
  el caso la fecha de habilitación más temprana de sus líneas activas; la
  agenda y la bandeja la leen de ahí. Una habilitación nunca se presenta como
  cita acordada ni inventa hora.
- **BR-007 — Registros históricos.** Al desplegar, se crea una cita `PENDING`
  **solo** para los casos `SCHEDULED` cuyo intento más reciente es `AGENDA` y
  cuya próxima acción coincide con la de ese intento. El resto de próximas
  acciones siguen siendo tareas derivadas. Ningún registro sin origen
  identificable se convierte en cita.

### Gestión desde la agenda (CAM-F09)

- **BR-008 — Reprogramar no es llamar.** Reprogramar crea una cita nueva
  `PENDING` con la hora nueva, marca la anterior `RESCHEDULED` apuntando a la
  nueva, exige motivo, guarda actor y momento, y mueve `next_action_at` del
  caso a la hora nueva. No crea intento, no cuenta para los tres del día ni
  para las puertas de pérdida. Lleva `client_request_id`: un reenvío devuelve
  la cita ya creada.
- **BR-009 — Cancelar exige decir qué sigue.** Cancelar una cita marca la
  cita `CANCELLED` con motivo y obliga a elegir la siguiente acción: **volver
  a la cadencia hoy** (próxima acción ahora, caso `IN_PROGRESS`) o **pausar
  uno o dos días** (BR-033). El caso nunca queda sin próxima acción ni se
  cierra por cancelar (AG-R07). Para acordar otra hora, se reprograma.
- **BR-010 — Mismos permisos y concurrencia que tipificar.** Reprogramar y
  cancelar usan el mismo predicado de acceso que registrar un intento
  (organización, rol, asignación; supervisor dentro de sus equipos). Actúan
  solo sobre una cita `PENDING`: si al llegar la petición ya estaba atendida,
  reprogramada o cancelada, el servidor rechaza con «esta cita ya cambió» y
  la interfaz conserva el borrador.
- **BR-011 — Origen visible.** Cada elemento dice de dónde sale: «acordada
  con el cliente», «cadencia del día», «pausa por rechazo», «habilitación de
  portabilidad», «gestión comercial» o «verificación». Y al reasignar un caso
  sus citas pendientes siguen al caso: la agenda es del responsable vigente
  (AG-R08). Resolver un caso cancela sus citas pendientes con motivo
  «caso resuelto» en la misma transacción.

### Vistas y bandeja (CAM-F08, CAM-F10, CAM-F11)

- **BR-012 — Bloque «Compromisos por atender» en la bandeja.** La bandeja
  muestra, encima de la lista y fuera del alcance de los filtros, las citas
  vencidas y las que vencen en las próximas dos horas, con enlace a la fila
  y a la agenda (AG-R12). El resto del ranking no cambia.
- **BR-013 — Vistas.** Semana (predeterminada, lunes a domingo), Día, Lista
  y Mes. La cuadrícula presenta la jornada de **08:00 a 20:00 de Lima**; una
  cita fuera de ese tramo extiende la cuadrícula, no desaparece. Estado en la
  URL: `view=semana|dia|lista|mes` (semana se omite), `fecha=AAAA-MM-DD`,
  `tipo=`, `estado=`, `age=` (el mismo parámetro de recencia que las demás
  colas, BR-092) y `q=`. Filtros en vivo sin botón «Filtrar» (SPEC-030
  BR-089); la fecha y la vista sobreviven a «Limpiar filtros».
- **BR-014 — Bloques complementarios siempre visibles.** «Compromisos
  vencidos» (citas `PENDING` con hora pasada, aunque su fecha esté fuera del
  período visible), «Tareas del día sin hora acordada» (reintentos,
  seguimientos, habilitaciones y completar venta que vencen hoy o antes) y
  «Pendientes sin fecha». Los filtros de tipo, estado y recencia estrechan la
  cuadrícula y la lista; nunca ocultan los vencidos.
- **BR-015 — Cantidades que no mienten.** Los contadores diferencian citas y
  tareas; nunca se presentan como horas ocupadas: sin duración definida una
  cita es un instante (AG-R10). Los conteos del Mes salen del mismo selector
  que Día y Semana.
- **BR-016 — Coincidencias.** Dos citas `PENDING` del mismo asesor en el
  mismo tramo de quince minutos se señalan como «a la misma hora» en la
  agenda y al agendar o reprogramar. Es una advertencia: no bloquea ni cambia
  nada (AG-R09). Detectar solapamientos por intervalo queda para cuando
  exista duración.
- **BR-017 — Recordatorio interno.** El sondeo de avisos existente devuelve
  al asesor cuántas citas tiene vencidas o dentro de los próximos quince
  minutos; el aviso flotante enlaza a la agenda y desaparece al registrar el
  resultado. Sin correo, sin SMS, sin mensajes al cliente.
- **BR-018 — Recencia.** El filtro de recencia reutiliza los tramos de
  SPEC-030 BR-092 (hoy, ayer, 2 a 3 días, más de 3) sobre `last_sighting_at`.
  Se muestra en cada elemento como «oportunidad de hoy / de ayer / de hace N
  días».

## 5. Decisiones que la propuesta dejó abiertas

Resueltas con recomendación para avanzar; José confirma o corrige.

| Decisión | Recomendación adoptada | Por qué |
|---|---|---|
| Anticipación del recordatorio | 15 minutos antes, dentro de la plataforma, hasta registrar el resultado | Es el sondeo que ya existe; una anticipación mayor se ignora |
| Duración de las citas | Sin duración en esta versión; columna `duration_minutes` reservada, nula | Nadie la acordó con el cliente; inventarla produce falsos solapamientos |
| Jornada del asesor | 08:00 a 20:00 de Lima, fija para todos | No hay configuración de jornada; una cita fuera del tramo se muestra igual |
| Compromisos en registros históricos | Solo `SCHEDULED` con último intento `AGENDA` y misma próxima acción (BR-007) | Es el único origen identificable sin ambigüedad |
| Franjas de reintento | Sin franjas: el reintento es tarea del día, sin hora (BR-004) | La cadencia actual solo distingue «ahora» y «mañana a las 09:00» |

## 6. Criterios de aceptación

- **AC-001:** agendar para mañana a las 10:00 desde la bandeja, en un
  servidor con `TZ=UTC`, guarda las 15:00 UTC y la fila, la ficha y la agenda
  muestran «10:00»; el caso no exige gestión hoy.
- **AC-002:** la cita aparece el día y la hora correctos en la semana y en el
  día; el mes cuenta una cita ese día y el mismo número en Día y Semana.
- **AC-003:** reprogramar conserva la cita anterior como `RESCHEDULED`, crea
  una `PENDING` con la hora nueva, no añade intentos, y un reenvío con la
  misma clave no duplica nada.
- **AC-004:** registrar `SIN_RESPUESTA` sobre un caso con cita pendiente la
  deja `DONE` y la siguiente tarea es «Volver a intentar» de hoy (o de mañana
  a partir del tercer intento), sin hora en la cuadrícula.
- **AC-005:** un caso con habilitación derivada de sus líneas se muestra como
  «Ya puede portar» con fecha y sin hora; nunca como llamada acordada.
- **AC-006:** resolver un caso con cita pendiente la deja `CANCELLED` con
  motivo «caso resuelto»; reasignarlo la mantiene `PENDING` y desaparece de
  la agenda del asesor anterior.
- **AC-007:** con un filtro de tipo o recencia aplicado, el bloque de
  vencidos sigue visible; en la bandeja, el bloque «Compromisos por atender»
  ignora los filtros.
- **AC-008:** dos citas a las 10:00 y 10:10 del mismo día muestran la
  advertencia «a la misma hora»; ninguna se rechaza.
- **AC-009:** un asesor no ve citas de casos ajenos; `?q=` busca solo en sus
  casos (BR-088); cancelar una cita ya atendida devuelve error y conserva lo
  escrito.
- **AC-010:** el despliegue crea citas `PENDING` solo para los casos de BR-007
  y ninguna para el resto de `SCHEDULED`.

## 7. Fuera de alcance

- Sincronización con calendarios externos.
- Mensajes automáticos al cliente.
- Mezclar campañas y recupero de ventas en una misma agenda (BR-075).
- Reprogramación automática de citas vencidas.
- Agenda de un asesor vista por su supervisor (`?asesor=` acotado por
  COR-04) y agenda de equipo: siguiente versión.
- Duración de citas y solapamiento por intervalo; jornada configurable.
- Captura manual de antigüedad (SPEC-030 BR-038): sigue en esa spec.
