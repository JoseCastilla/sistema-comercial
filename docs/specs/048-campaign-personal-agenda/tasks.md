# SPEC-048 — Tareas

Una casilla se marca solo con evidencia en `verification.md`.

## Definición

- [x] `spec.md` con la revisión de la propuesta contra el código (§2),
      reglas BR-001 a BR-018, decisiones abiertas resueltas con
      recomendación (§5) y criterios AC-001 a AC-010 (08/09/2026).
- [x] `plan.md`: cita acordada persistida, tareas derivadas, reloj del caso
      intacto, hora de Lima explícita, fases 0 a 5.
- [ ] José confirma o corrige las cinco recomendaciones de §5 y el relleno
      de históricos (BR-007).

## Fase 0 — Hora de Lima y consolidación (bloqueante)

- [x] Ejecutar `docs/operacion/consultas/horas-agendadas-lima.sql` en
      producción y anotar la distribución de horas (08/09/2026: 45 citas,
      todas corridas cinco horas; 30 vigentes; ver `verification.md`).
- [x] `parseLimaDateTimeLocal` en `@repo/validation` con pruebas en
      `TZ=UTC` y `TZ=America/Lima` (326 pruebas en verde, 08/09/2026).
- [x] `register-recovery-attempt-action.ts` deja de usar `new Date(raw)`
      (tipos y lint limpios; en `main` 787d26b).
- [x] `ENV TZ=America/Lima` en los Dockerfiles de `web`, `api` y `worker`
      (en producción: las citas registradas tras el despliegue salen en hora
      de jornada).
- [x] Migración `add_next_action_corrected_event` aplicada en producción
      (08/09/2026; en local pendiente de `db:migrate:deploy`).
- [x] José ejecutó `corregir-horas-agendadas-2026-09-08.sql` con corte
      16:42:00Z: 30 casos, 30 eventos (08/09/2026; ver `verification.md`).
- [ ] El cruce de portabilidad consolida `portability_eligible_at` en el
      caso (mínimo de líneas activas).

## Fase 1 — Compromisos (CAM-F07, P0)

- [x] Migración `add_recovery_case_commitments`: tabla, enums, índice
      parcial de una sola `PENDING` por caso, eventos
      `COMMITMENT_RESCHEDULED` / `COMMITMENT_CANCELLED`, relleno BR-007
      (escrita el 08/09/2026; se aplica en producción con el despliegue;
      en local pendiente de `db:migrate:deploy`).
- [x] `recovery-agenda.ts`: tipos de elemento y origen con sus etiquetas,
      `selectRecoveryAgendaItem`, `describeRecoveryCommitmentState`,
      `shareRecoveryAgendaSlot`; 12 pruebas puras (338 en el paquete).
      `agendaBuckets` pasa a la fase 5, donde se usa.
- [x] `AGENDA` crea la cita en la transacción del intento; cualquier
      resultado cierra la `PENDING` como `DONE`; el reenvío con la misma
      clave no llega al bloque (BR-090 lo devuelve antes). Vale para ambos
      carriles: la cita pertenece al caso; la agenda filtra por fuente.
- [x] Resolver el caso cancela la cita pendiente con motivo «Caso resuelto».
- [x] Ficha de campaña: sección «Llamada acordada» con la cita vigente (o
      vencida) y el historial con estado, autor y motivo.

## Fase 2 — Mi agenda: semana, día y lista (CAM-F08, P1)

- [x] `recovery-agenda-period.ts`: vista, fecha de Lima, semana lunes a
      domingo, día, lista de siete días, hora de Lima y jornada de la
      cuadrícula; 7 pruebas (345 en el paquete).
- [x] `get-agenda.ts` acotado al asesor autenticado: un elemento por caso
      con el selector de la fase 1, citas cerradas del período, filtros de
      tipo y estado en memoria, recencia y búsqueda en la base, contexto de
      vuelta a la ficha (`from=agenda`).
- [x] Página `/recovery/agenda`: vistas Semana, Día y Lista; navegación
      Anterior / Hoy / Siguiente / Elegir fecha; `QueueFilters` con `q`,
      `age`, `tipo`, `estado` (la fecha viaja sin ser filtro); cabecera con
      llamadas y tareas por separado; bloques de vencidos, tareas sin hora,
      sin gestión y verificación. Sin biblioteca de calendario.
- [x] Navegación: `AdvisorCampaignNav` («Mi cola» · «Mi agenda») en la
      bandeja y en la agenda; `sectionForPath("/recovery/agenda")` →
      Campañas, con prueba.
- [x] Bandeja: bloque «Compromisos por atender» (citas vencidas o a menos de
      dos horas) encima de la lista y fuera de los filtros (BR-012).
- [ ] Recorrido local con cuenta de asesor de prueba (exige aplicar la
      migración de la fase 1 en local) y lectura de producción.

## Fase 3 — Gestionar desde la agenda (CAM-F09, P1)

- [x] `recovery-case-access.ts`: un solo predicado de acceso para
      tipificar, resolver, reprogramar y cancelar (los dos primeros
      refactorizados sin cambio de conducta).
- [x] `reschedule-commitment-action.ts`: hora de Lima, motivo, clave de
      idempotencia, solo sobre `PENDING` (`updateMany … count === 1`),
      cita nueva enlazada desde la anterior, `next_action_at` del caso,
      evento `COMMITMENT_RESCHEDULED`.
- [x] `cancel-commitment-action.ts`: motivo + siguiente acción (volver hoy o
      pausa 1–2 días), caso a `IN_PROGRESS` con su próxima acción, evento
      `COMMITMENT_CANCELLED`; mismas garantías.
- [x] Panel de la cita con `cita=<id>` en la URL de la agenda: caso,
      teléfono, últimas gestiones, historial de la cita (cadena de
      reprogramaciones), registrar resultado (`RegisterAttemptForm` que
      vuelve a la agenda), reprogramar, cancelar, abrir ficha; los
      formularios conservan lo escrito ante error (`useActionState`).
      Las citas de la cuadrícula y la lista abren el panel; la ficha enlaza
      «Reprogramar o cancelar desde mi agenda».
- [x] Advertencia «a la misma hora» al agendar (ficha y bandeja) y al
      reprogramar, y marca ⚠ en la cuadrícula (BR-016); nunca bloquea.
- [ ] Recorrido local con cuenta de asesor de prueba (exige aplicar en
      local las migraciones de la fase 1).

## Fase 4 — Recordatorios y carga (CAM-F10, P1)

- [ ] Sondeo de avisos devuelve `agendaDue` al asesor; aviso flotante con
      enlace a la agenda, visible para `AGENT`.
- [ ] Cabecera con citas y tareas separadas; coincidencias marcadas en la
      cuadrícula; ninguna cifra de «horas ocupadas».

## Fase 5 — Mes (CAM-F11, P2)

- [ ] Vista mensual con conteos por día y tipo; un día abre la vista Día;
      prueba de que los conteos coinciden con Día y Semana.

## Verificación

- [ ] Pruebas puras y de componente en verde; tipos y lint limpios.
- [ ] Recorrido con cuenta de asesor de prueba (ficticia): los siete puntos
      de validación de la propuesta, en `verification.md`.
- [ ] Lectura de producción tras el despliegue: citas creadas por el
      relleno, una cita nueva comprobada en hora de Lima.
- [ ] AG-R12 verificado cuando la bandeja tenga filtros de recientes
      (plan CAM-F01 a CAM-F06).
