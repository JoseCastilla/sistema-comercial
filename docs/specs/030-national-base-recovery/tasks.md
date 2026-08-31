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

## Fase 3 — Motor de contactos

- [x] Entrega de bloques a equipos desde el triage, con alcance por rol y
      selección masiva (Shift y por cantidad) — BR-022b, AC-043 a AC-045.
- [ ] Cola por equipo con alcance por rol.
- [ ] Toma atómica mediante actualización condicional.
- [ ] Asignación en lote: directa a asesor, equitativa en equipo, manual entre
      equipos y envío a cola (BR-028).
- [ ] Selector de asesores elegibles con exclusión de ausentes registrada
      (BR-028b).
- [ ] Algoritmo de reparto equitativo como función pura en `@repo/validation`
      (BR-028c).
- [ ] Redistribución en lote de casos sin gestión de un asesor (BR-030b).
- [ ] Bloqueo de auto-asignación directa para supervisor vendedor (BR-050b).
- [ ] Registro de intentos inmutables con canal, tipificación y teléfono.
- [ ] Contador de intentos del día y señal de cobertura insuficiente.
- [ ] Pausa de uno o dos días con reaparición automática.
- [ ] Agenda con fecha y hora exactas.
- [ ] Captura manual de antigüedad para líneas sin fecha de ventana.
- [ ] Prioridad al inicio de la cola al vencer la habilitación.
- [ ] Revelación auditada de datos sensibles: solo `Validacion = false` y tras
      un intento `INTERESADO`.
- [ ] Reasignación supervisada con historial.

## Fase 4 — Cierre y medición

- [ ] Resolución `RECOVERED` con sugerencia de orden DITO y confirmación humana.
- [ ] Resolución `LOST` con motivo estructurado y criterios habilitantes por
      motivo (BR-057).
- [ ] Resolución obligatoria al séptimo día con escalamiento al supervisor
      (BR-058).
- [ ] Pérdida automática `YA_MIGRO_OTRA_AGENCIA` cuando un caso con gestión
      porta a Movistar (BR-059).
- [ ] Tablero de avance, cobertura y efectividad por asesor.
- [ ] Conversión por cohorte contra el rango objetivo del 3 % al 6 %
      (BR-056b), con descartes fuera del denominador.
- [ ] Separación de descartes por portabilidad respecto de las pérdidas.

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
- [ ] Retorno automático al pool de casos de base sin gestión (BR-077).
- [ ] Orden de cola por recencia + habilitaciones y filtros del asesor sobre
      el pool (BR-078).
- [ ] Campañas de base: activación registrada, checklist carga → cruce →
      distribución, y sugerencia en el dashboard de rendimiento (BR-079).
- [ ] Métricas segregadas por fuente en tablero y dashboard (BR-075, AC-061).
- [ ] Inclusión de casos internos en la exportación y cruce de portabilidad
      (BR-069, AC-051).
- [ ] Métricas internas y evolución del KPI "Por recuperar" del dashboard
      (BR-070).
- [ ] Reproducir los casos de referencia de SPEC-026 (AC-052).

## Verificación

- [ ] Pruebas de dominio con la base real como fixture.
- [ ] Prueba de concurrencia sobre la toma de casos.
- [ ] Verificación con roles `AGENT`, `SUPERVISOR`, `SUPERVISOR` vendedor,
      `BACKOFFICE` y `ADMIN`.
- [ ] Verificación de que sensibles y columnas `A`–`M` no salen en listas ni
      exportaciones.
- [ ] Aprobar antes de desplegar.
