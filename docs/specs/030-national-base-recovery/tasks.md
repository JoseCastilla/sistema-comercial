# SPEC-030 — Tareas

## Definición

- [x] Analizar la base real del 26/08/2026 y medir el volumen trabajable.
- [x] Identificar la clave de identidad y las reglas de deduplicación vigentes.
- [x] Definir los filtros de elegibilidad y su carácter administrable.
- [x] Definir el cruce de portabilidad como importación de reporte.
- [x] Definir el triage manual con marcado en lote.
- [x] Definir cadencia, tipificación, pausa y agenda.
- [x] Definir el tratamiento de datos sensibles.
- [x] Decidir la unificación con SPEC-026 y absorber la agenda de reingreso.
- [x] Confirmar SA-002 y SA-003 con la muestra del reporte de portabilidad.
- [x] Definir el caso por cliente con servicios y teléfonos agrupados.
- [x] Incorporar Guinea Mobile (27) al catálogo de cedentes.
- [x] Condicionar los datos sensibles a `Validacion = false`.
- [x] Confirmar SA-001: cadencia de carga inicial de tres días más diaria del
      día anterior; la base no refresca casos y las reapariciones son pedidos
      nuevos (BR-009 y BR-009b).

## Fase 1 — Ingesta y triage

- [x] Esquema `recovery.prisma` con las nueve tablas y sus enumeraciones.
- [x] Migración aditiva `add_national_base_recovery`.
- [x] Normalización compartida de DNI y teléfonos en `@repo/validation`.
- [x] Parser de la base consolidada (columnas `I`, `J` y `N`–`AP`), en
      streaming por filas.
- [x] Evaluación de filtros contra la configuración vigente, con catálogo de
      cedentes administrable.
- [x] Agrupación de servicios y teléfonos por cliente, resolviendo BR-006 y
      BR-007.
- [x] Avistamientos por lote: anotar reapariciones en el caso abierto y crear
      el caso sucesor enlazado cuando el previo está resuelto.
- [x] Previsualización del lote con contadores por motivo de exclusión.
- [x] Confirmación idempotente por bloques con contadores parciales.
- [x] Administración de filtros de elegibilidad en `/admin/recovery-base`.
- [x] Bandeja de triage con selección múltiple y marcado en lote.
- [ ] Inclusión manual de casos excluidos por filtro, con motivo.

## Fase 2 — Portabilidad

- [x] Exportación de números de casos abiertos, incluidos los `WAITING`.
- [x] Importación del reporte CSV de siete columnas, validando el encabezado.
- [x] Importación del cruce rápido con mapeo de columna, solo descartes.
- [x] Cruce sobre todos los casos abiertos, no solo los del lote del día.
- [x] Descarte `YA_ACTIVO` por servicio, cerrando el caso al agotar servicios.
- [x] Espera automática para programadas hacia Movistar con fecha visible.
- [x] Revalidación al día siguiente de programadas sin fecha visible.
- [x] Habilitación automática a `fecha_de_la_ventana` más treinta días.
- [x] Marcado de líneas de planta.
- [ ] Reversión de descarte para `ADMIN`, con motivo.

## Fase 3 — Motor de contactos (construida el 31/08/2026)

- [x] Entrega de bloques a equipos desde el triage, con alcance por rol y
      selección masiva (Shift y por cantidad) — BR-022b, AC-043 a AC-045.
- [x] Cola por equipo con alcance por rol: modo `COLA` en
      `/recovery/distribute` deja el lote `OPEN` sin responsable y sin SLA
      (BR-076); el pool se ve y se toma desde `/recovery/campaigns`.
- [x] Toma atómica por bloque de hasta 10 mediante `updateMany` condicional
      (`status = OPEN AND assignedUserId IS NULL`): el segundo asesor no
      recibe los casos que el primero ya tomó (AC-013, BR-078).
- [x] Asignación en lote: directa a asesor, equitativa en equipo y envío a
      cola (BR-028). El reparto manual entre equipos se compone con
      "seleccionar los primeros N" + un modo por equipo; cada sub-lote queda
      auditado con su propio lote de eventos.
- [x] Selector de asesores elegibles con exclusión de ausentes registrada en
      la metadata del lote (BR-028b, AC-039) — verificado en local: 12 casos
      entre 3 participantes con 1 excluido produjo 4/4/4 y 0 al excluido.
- [x] Algoritmo de reparto equitativo como función pura
      `distributeCasesEquitably` en
      `@repo/validation/recovery-base-distribution`, con pruebas de
      diferencia máxima, residuo al menos cargado y mezcla por ronda
      (BR-028c, AC-038).
- [x] Redistribución en lote de casos sin gestión (BR-030b, AC-042): vista
      "Asignados sin gestión" en `/recovery/distribute`; un caso con intento
      posterior a su asignación queda fuera del lote y se informa.
- [x] Bloqueo de auto-asignación directa para supervisor vendedor (BR-050b):
      la interfaz lo excluye del selector directo y el servidor lo rechaza;
      la toma del pool excluye los casos que él mismo liberó (BR-050).
- [x] Registro de intentos inmutables con canal, tipificación y teléfono:
      la acción de Fase 5 ahora acepta ambas fuentes, con cadencia por
      fuente (BR-031) — la base exige tres intentos del día y reaparece a las
      9:00 de Lima siguientes con el mínimo cumplido.
- [x] Contador de intentos del día y señal de cobertura insuficiente: "X / 3
      hoy" en cola y ficha, métrica "Sin los 3 intentos de hoy" (BR-032).
- [x] Pausa de uno o dos días con reaparición automática (compartida con el
      carril interno, BR-033).
- [x] Agenda con fecha y hora exactas (compartida, BR-034).
- [ ] Captura manual de antigüedad para líneas sin fecha de ventana (BR-038).
- [x] Prioridad al inicio de la cola al vencer la habilitación (BR-039): la
      toma del pool y el orden del reparto sirven primero las habilitaciones
      vencidas.
- [x] ~~Revelación auditada de datos sensibles (BR-045/BR-046, AC-021)~~
      **Retirada el 03/09/2026** por decisión de producto: padre, madre y
      nacimiento se muestran al asesor que gestiona el caso, en la cola y en
      la ficha, sin acción previa. Las revelaciones ya auditadas se conservan
      y se siguen mostrando donde ocurrieron. Ver la sección "Ficha del
      cliente en la cola" y la spec (BR-045 revisada, BR-046 retirada).
- [ ] Reasignación individual supervisada de un caso de base con gestión
      iniciada (BR-030); la redistribución masiva cubre solo los no
      trabajados.

## Fase 4 — Cierre y medición

- [x] Resolución `RECOVERED` con sugerencia de orden DITO y confirmación
      humana (31/08/2026): la acción de Fase 5 acepta ambas fuentes y la
      ficha de campaña la ofrece con las mismas garantías (BR-042).
- [x] Resolución `LOST` con motivo estructurado y criterios habilitantes por
      motivo (BR-057), compartidos con el carril interno.
- [ ] Resolución obligatoria al séptimo día con escalamiento al supervisor
      (BR-058). La señal ya existe — "Resolver hoy" en cola y ficha desde el
      séptimo día de gestión —; falta el escalamiento automático al
      supervisor en el sondeo de notificaciones.
- [ ] Pérdida automática `YA_MIGRO_OTRA_AGENCIA` cuando un caso con gestión
      porta a Movistar (BR-059).
- [x] Tablero del día en `/recovery/board` (01/09/2026): avance (asignados,
      trabajados, sin primer contacto, agenda vencida — BR-053), cobertura
      con numerador y denominador visibles (BR-054) y efectividad por
      asesor con intentos, contactados, recuperados y pérdidas —
      distinguiendo las pérdidas frente a otras agencias (BR-055). Alcance
      por rol y filtro de equipo para administración. Primera versión: se
      itera durante la semana con datos reales de operación.
- [x] Conversión por cohorte de los últimos 7 días contra la meta 3–6 %
      (BR-056b), descartes fuera del denominador; cohortes jóvenes marcadas
      "en maduración" en lugar de alarma.
- [x] Descartes del día como contador propio, nunca como pérdidas (BR-056).

## Fase 5 — Puerta interna

- [x] Diseño detallado (30/08/2026): BR-061 a BR-073 y AC-046 a AC-056 en
      `spec.md`.
- [x] SA-004 y SA-005 resueltos el 30/08/2026: un caso abierto por cliente con
      fusión por evento y prioridad máxima (BR-072); creación en el primer
      `NO ENTREGADO` con cierre automático si la entrega ocurre (BR-073).
- [x] Migración `20260830100000_add_internal_recovery_gate`:
      `source_dito_order_id`, `original_agent_user_id`, `original_team_id`,
      `entry_reason`, `entry_observation`, `priority`, sus FKs, índices y el
      **índice parcial único** que garantiza un caso abierto por orden origen
      (BR-061, BR-068). Enums `RecoveryEntryReason` y `RecoveryCasePriority`.
- [x] `ENTREGA_CONCRETADA` en `RecoveryDiscardReason`, en migración aparte por
      la limitación de `ALTER TYPE ... ADD VALUE` (BR-073).
- [x] Reglas puras en `@repo/validation/recovery-internal-gate`: elegibilidad,
      motivo por estado × motivo × submotivo, prioridad, fusión por prioridad
      máxima, veto del originador en Crítica y reloj de dos horas
      (BR-061, BR-063 a BR-067, BR-072).
- [x] Helper transaccional `openInternalRecoveryCase` con idempotencia por
      orden y por cliente, fusión entre puertas y auditoría por evento
      (BR-072, AC-053, AC-054).
- [x] Entrada automática enganchada en las dos transacciones que sí mutan
      estado: actualización desde la bandeja y aprobación de cancelación. El
      webhook y el importador quedaron descartados como enganche porque solo
      dan de alta órdenes `OPEN` (BR-061 corregido).
- [x] Cierre automático `ENTREGA_CONCRETADA` cuando la entrega se concreta
      después de crear el caso (BR-073, AC-056).
- [x] Acción `sendOrderToRecoveryAction` con motivo y observación obligatorios
      y veto de la venta propia (BR-061, BR-067, AC-047).
- [x] Separación de carriles y campañas definida el 30/08/2026 (BR-074 a
      BR-079, AC-057 a AC-061): interno domina la fusión, colas y métricas
      por fuente, carga episódica (BR-009 revisado), retorno automático al
      pool a los dos días sin gestión, cola por recencia con filtros del
      asesor, campañas registradas con sugerencia desde el dashboard.
- [x] Fusión con dominio del carril interno implementada en
      `openInternalRecoveryCase` (BR-072 revisado, AC-057): el caso adopta
      asesor original, equipo, motivo, prioridad máxima y reloj de dos horas;
      la toma de control queda auditada con el responsable previo.
- [x] Formulario "Enviar a recupero" en la tarjeta del pedido, con motivo y
      observación obligatorios; tras crear el caso la tarjeta muestra el badge
      "En recuperación" con prioridad y responsable (AC-047).
- [x] Superficie "Recupero de ventas" en `/recovery/sales`: cuatro
      indicadores (abiertos, contacto vencido, críticas sin responsable,
      recuperadas del mes) y cola ordenada por prioridad, con alcance por rol
      (BR-074). Navegación dividida: "Recupero de ventas" para todos los
      roles y "Base nacional" para supervisión.
- [x] Reasignación de casos internos desde la bandeja
      (`assignSalesRecoveryCaseAction` + evento `ASSIGNED_TO_USER`): la
      Crítica excluye al originador del selector y el servidor lo rechaza sin
      excepción de rol; un supervisor no puede asignarse a sí mismo; el nuevo
      responsable recibe su propio reloj de dos horas y una agenda pactada no
      se pisa (BR-029, BR-030, BR-065, BR-067).
- [x] Tabla `recovery_case_attempts` (inmutable: sin camino de actualización)
      con canal, resultado tipificado BR-036, teléfono, observación y actor;
      compartida entre carriles (BR-035).
- [x] Ficha del caso en `/recovery/sales/[caseId]`: datos, motivo con la
      observación del OL, historial de intentos, formulario de gestión y de
      resolución. Alcance por rol (el asesor solo sus casos asignados).
- [x] Registro de intentos con efectos en la misma transacción: primer
      contacto, `IN_PROGRESS`, agenda que suspende cadencia (BR-034), pausa
      de 1–2 días por rechazo (BR-033) y cadencia D1/D3/D7 desde la
      asignación con aviso de resolución obligatoria al agotarse
      (BR-066, BR-058). Helpers puros con pruebas.
- [x] Resolución `RECOVERED` con sugerencia de orden por documento —
      posterior al caso, no cancelada, distinta de la origen — y confirmación
      humana (BR-042); `LOST` con motivo estructurado y observación
      obligatoria, `OTRO` vetado para el asesor (BR-043, BR-057). Evento
      `CASE_RESOLVED` en ambos caminos.
- [x] Criterios habilitantes por motivo de pérdida (BR-057) como función pura
      `evaluateInternalLossReasonGates` con pruebas: INUBICABLE exige 3 días
      con 3+ intentos sin respuesta (calendario de Lima), RECHAZO_DEFINITIVO
      dos rechazos en días distintos o la solicitud expresa del cliente
      (checkbox + observación + al menos un intento), y el resto la evidencia
      de su intento. La interfaz marca ⏳ y explica qué falta; el servidor
      recalcula desde los intentos reales y rechaza el cierre prematuro.
- [x] Vigilancia del SLA (BR-066/BR-058): el sondeo de notificaciones ya
      cuenta los casos internos con la próxima acción vencida en el alcance
      del supervisor, y el aviso flotante "recupero(s) vencido(s)" enlaza a
      la bandeja. Reutiliza el canal en tiempo real + sondeo de respaldo de
      los escalamientos.
- [x] Retorno automático al pool de casos de base sin gestión (BR-077,
      AC-058): barrido perezoso e idempotente `returnStaleBaseCasesToPool`
      al abrir las superficies de campaña y antes de cada toma; regla pura
      `shouldReturnBaseCaseToPool` con pruebas.
- [x] Orden de cola por recencia + habilitaciones y filtros del asesor sobre
      el pool (BR-078, AC-059): toma por bloque con filtros de departamento
      y plan; habilitaciones vencidas primero, luego lo más reciente.
- [ ] Campañas de base: activación registrada, checklist carga → cruce →
      distribución, y sugerencia en el dashboard de rendimiento (BR-079).
- [ ] Métricas segregadas por fuente en tablero y dashboard (BR-075, AC-061).
- [ ] Inclusión de casos internos en la exportación y cruce de portabilidad
      (BR-069, AC-051).
- [ ] Métricas internas y evolución del KPI "Por recuperar" del dashboard
      (BR-070).
- [ ] Reproducir los casos de referencia de SPEC-026 (AC-052).

## Verificación por tandas y anticuamiento (01/09/2026)

- [x] BR-080 a BR-084 definidos con José: verificación derivada por línea,
      el rápido nunca verifica, exportación incremental, triage separado en
      listos/esperando, advertencia al distribuir sin verificar y caducidad
      a los 7 días con motivo `VENCIDO`.
- [x] Migración `20260901150000_add_recovery_discard_vencido`.
- [x] Exportación incremental con tandas (`?take=200/500`), solo líneas sin
      consultar o en revalidación, más recientes primero, deduplicadas;
      verificado en local: la tanda emite 200 exactos y un número ya
      consultado no vuelve a salir (AC-062).
- [x] Barrido perezoso `expireUnverifiedCases` al abrir la preparación y
      antes de cada exportación; regla pura con prueba
      (`isRecoveryConsultationExpired`).
- [x] Avance de consulta en la preparación: sin consultar / líneas abiertas
      / casos listos.
- [x] Triage con vistas listos (por defecto) y esperando consulta, con
      contadores separados (AC-063); verificado en local con la base real:
      24 listos + 1,900 esperando = 1,924.
- [x] Distribución: badge "Sin verificar" por fila y advertencia con conteo
      en el resultado, sin bloquear (AC-064).
- [ ] Anticuamiento de casos verificados sin trabajar (consulta vieja):
      pendiente para campañas registradas (BR-079).

## El ciclo del lead en manos del asesor (01/09/2026)

- [x] BR-085 a BR-087 y AC-066 a AC-069 definidos con José: la palabra del
      asesor nunca cierra un caso; verificación por reporte (admin, lote) o
      confirmación manual del supervisor; el interesado con pedido ajeno se
      agenda solo para la mañana siguiente conservando a su asesor.
- [x] Migración `20260901180000_add_interested_with_order_result`
      (`INTERESADO_CON_PEDIDO` en `RecoveryAttemptResult`).
- [x] `YA_ACTIVO` en caso de base → `WAITING` con asesor conservado, visible
      al fondo de su cola ("En verificación"), líneas a la próxima
      exportación (AC-066).
- [x] `INTERESADO_CON_PEDIDO` → `SCHEDULED` a las 9:00 de Lima siguientes,
      distintivo "Pedido en curso: ¿ya cayó?" en cola y ficha, líneas en
      revalidación diaria (AC-069). Cuenta como contacto efectivo en los
      criterios de pérdida.
- [x] BR-059 implementado en el cruce (AC-067): portado a Movistar con
      intentos → `LOST · YA_MIGRO_OTRA_AGENCIA` con el reporte como
      evidencia; sin intentos → `DISCARDED · YA_ACTIVO`. "No portado" sobre
      un caso en verificación/revalidación vuelve al asesor asignado con
      próxima acción inmediata (o al triage si no tiene); portado a otro
      operador con habilitación futura agenda el caso a esa fecha.
- [x] Verificación manual del supervisor en la ficha
      (`verifyReportedActiveAction`): confirmar → pérdida con su usuario
      como evidencia; desmentir → vuelve a la cola del asesor (AC-068). El
      asesor no ve esos botones.
- [x] E2E verificado el 01/09 contra el API vivo: caso reportado que el
      reporte confirma → `LOST · YA_MIGRO_OTRA_AGENCIA`; caso que el
      reporte desmiente → `ASSIGNED` de vuelta a su asesor con próxima
      acción inmediata.

## Bandeja del asesor y barrido rápido (01/09/2026)

- [x] Filtros de departamento y plan sobre la cola propia del asesor
      ("hoy solo llamo Lima"), con conteo real y paginación de 100 por
      página hasta cubrir el mes completo.
- [x] Exportación `?days=N`: **barrido** de todas las líneas cargadas en los
      últimos N días, consultadas o no, para el filtro rápido diario — caza
      al cliente que portó después de su consulta. Botón "Barrido: últimos
      3 días completos" en la preparación. Verificado: incluye la línea
      consultada y viva que la exportación de pendientes excluye.

## Recorte del barrido diario (02/09/2026)

- [x] BR-082b: regla pura `needsPortabilityRecross` en `@repo/validation` —
      vuelve al filtro externo la línea que está en otro operador o sin
      consultar, y la programada hacia Movistar **sin fecha**; queda fuera
      la programada con fecha (su respuesta ya se conoce) y la portada.
      Cinco pruebas nuevas en `recovery-portability.test.mjs`.
- [x] `?days=N&scope=recross` aplica el recorte en la exportación. El
      receptor es texto libre, así que el filtro corre en memoria sobre la
      regla pura y el `take` se corta después de filtrar, para no emitir
      tandas cortas.
- [x] La preparación anuncia cuántos números salen antes de gastarlos en la
      herramienta externa y cuántos quedan fuera. El barrido sin recortar
      queda disponible solo cuando hay algo excluido que auditar.

## Triage operable sin ratón (02/09/2026)

- [x] Cada línea del caso se copia con un clic en la tabla del triage, como
      ya ocurría con el DNI: la consulta en OSIPTEL se hace número por
      número y seleccionar texto dentro de una fila que además marca al
      cliente no era viable.
- [x] AC-043 alcanzable con teclado, con el reparto de la hoja de cálculo
      (corregido el 02/09/2026 con el supervisor delante): arriba y abajo
      cambian de cliente, izquierda y derecha eligen el dato, **Espacio
      copia ese dato** y **Shift + Espacio marca al cliente**. Sobre la fila,
      sin dato elegido, Espacio copia el DNI. Marcar pasa por la misma regla
      que el ratón, donde Shift + clic sigue extendiendo el rango.
- [x] Foco itinerante: una sola fila entra en el orden de tabulación, porque
      250 filas tabulables dejarían la paginación a 250 pulsaciones.
- [x] El cursor se ve: `.ui-table tbody tr[data-focused]` marca las celdas
      con sombras internas. Un `outline` sobre la fila no se pinta con
      `border-collapse: collapse` —el mismo motivo por el que el hover tiñe
      la celda—, y sin marca visible navegar con las flechas era a ciegas.
      Solo el borde, sin fondo, para que una fila enfocada y marcada muestre
      las dos cosas.

## El triage dice por qué no cambió un caso (02/09/2026)

- [x] El marcado en lote distingue las tres causas de un caso que no se
      mueve —ya estaba en ese estado, ya está cerrado, o no pertenece a los
      equipos de quien lo intenta— y las cuenta por separado. Antes las
      tapaba una sola frase que culpaba al alcance: un supervisor que
      marcaba «en espera» casos que el cruce ya había puesto en espera
      recibía un mensaje sobre sus equipos y se iba a revisar permisos.
- [x] La columna de estado aparece en cuanto hay una fila en espera, no solo
      cuando conviven dos estados. Una bandeja entera en espera la escondía
      justo cuando decía lo único que importaba.
- [x] BR-022b/BR-029 cerrado en la lectura: un `?team=` en la barra de
      direcciones ya no puede ampliar el alcance de un supervisor.
      `assignedTeamId` pisaba la restricción a sus equipos; ahora el filtro
      solo estrecha.

## Las esperas vuelven y los lotes se superponen (02/09/2026)

- [x] BR-024b: `releaseWaitingBaseCases`, barrido perezoso e idempotente
      como BR-077 y BR-084, devuelve a `TRIAGE` la espera manual al día
      siguiente y la portación programada al día siguiente de su ventana,
      conservando el equipo. Excluye las esperas con dueño y las marcadas
      para revalidación (BR-085/BR-086).
- [x] BR-082b corregido: `needsPortabilityRecross` compara la ventana con
      el día de hoy en Lima. Con la fecha por delante la línea sigue fuera
      del barrido; pasada la ventana vuelve a entrar, para que el reporte
      responda lo que antes se daba por supuesto.
- [x] `?scope=waiting`: descarga de los **pedidos en curso**, las líneas de
      los casos en espera, sin ventana de días —lo que interesa de una
      espera es si el pedido se concretó, y eso no caduca a los tres días—.
      El botón anuncia cuántos números salen y solo aparece si hay esperas.
- [x] BR-009c: la confirmación pregunta si ya vio esos pedidos **antes** de
      crear un caso, mirando todos los casos del cliente y no solo el
      abierto. El evento de avistamiento se escribe solo si hubo
      avistamiento nuevo.

## Ficha del cliente en la cola (03/09/2026)

Origen: el asesor tenía que entrar a la ficha completa para ver los datos del
cliente, y eso lo sacaba de su cola —filtro, posición y el hilo de a quién
venía llamando—.

- [x] "Ver datos" despliega la ficha en la propia fila: identidad del titular,
      todos los teléfonos de contacto, dónde entregar (dirección compuesta,
      ubicación, referencia, indicaciones y enlace al mapa) y líneas a portar.
      La cola trae esos campos en la misma lectura; sin viajes extra.
- [x] "Abrir" sigue siendo la ficha completa: detalle, historial y registro
      del intento.
- [x] Al registrar un intento desde campañas el asesor vuelve a su cola con el
      mensaje de éxito, que lleva información operativa (intentos del día,
      cadencia agotada). El destino es un parámetro del formulario: en
      recupero de ventas se queda donde está.
- [x] `SIN_RESPUESTA` se muestra como «No contesta» y `RECHAZA` como «No
      interesado»; el valor persistido no cambia, así que histórico y conteos
      siguen cuadrando. Se agrega `CANCELADO`: pausa la cadencia como
      `RECHAZA` y no cierra el caso. Migración
      `20260903000000_add_cancelado_attempt_result`.
- [x] Rótulos de resultado en un solo módulo (`attempt-result-labels.ts`);
      vivían duplicados en tres pantallas.
- [x] Color por resultado del último intento en el borde izquierdo de la fila,
      no en el fondo.
- [x] Composición de dirección y lectura de coordenadas en `contact-summary.ts`,
      compartido entre la ficha y la cola.
- [x] Mapa embebido (OpenStreetMap) en la ficha completa, sin clave ni cuenta;
      el enlace a Google Maps se conserva. En la cola queda solo el enlace
      para no enviar coordenadas a un tercero por cada fila abierta.

## Superficie y honestidad de datos (31/08/2026)

- [x] Filtros de trabajo (equipo, departamento, plan, DNI) en el triage y en
      la distribución, resueltos en el servidor.
- [x] Métricas del triage calculadas con `count` reales, no sobre las filas
      visibles: el tope silencioso de 500 quedó reemplazado por paginación
      con total declarado.
- [x] Embudo de campaña en `/admin/recovery-base` (triage → espera → por
      distribuir → en gestión → recuperados) con la siguiente acción como
      ancla para retomar en otra sesión.
- [x] Navegación: "Campañas" visible para todos los roles, cada uno hacia su
      superficie — admin prepara, supervisión hace triage, asesor trabaja su
      cola en `/recovery/campaigns`.
- [x] BR-074 reforzado: el triage y la distribución filtran
      `source = NATIONAL_BASE` explícitamente.

## Verificación

- [x] Pruebas de dominio del reparto y la cadencia (11 pruebas en
      `recovery-base-distribution.test.mjs`; 226 en verde en el paquete).
- [x] Verificación en local con sesión `SUPERVISOR` (31/08/2026): liberar 12
      → equitativa 3 participantes / 1 excluido → 4/4/4 → redistribución de 5
      a la cola; eventos auditados con actor, participantes, excluidos y
      responsable previo verificados en base de datos; intento sobre ficha
      con contador 1/3 y cadencia vigente el mismo día.
- [ ] Pruebas de dominio con la base real como fixture.
- [ ] Prueba de concurrencia sobre la toma de casos (el diseño la garantiza
      por `updateMany` condicional; falta el test automatizado).
- [ ] Verificación con roles `AGENT`, `SUPERVISOR` vendedor y `BACKOFFICE` —
      bloqueada por la falta de cuentas de prueba por rol.
- [ ] Verificación de que sensibles y columnas `A`–`M` no salen en listas ni
      exportaciones.
- [ ] Aprobar antes de desplegar.
