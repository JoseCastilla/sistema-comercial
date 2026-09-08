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

- [ ] Migración `add_recovery_case_commitments`: tabla, enums, índice
      parcial de una sola `PENDING` por caso, eventos
      `COMMITMENT_RESCHEDULED` / `COMMITMENT_CANCELLED`, relleno BR-007.
- [ ] `recovery-agenda.ts`: tipos de elemento, `selectAgendaItem`,
      `commitmentState`, `sameSlot`, `agendaBuckets`; pruebas puras.
- [ ] `AGENDA` crea la cita en la transacción del intento; cualquier
      resultado cierra la `PENDING` como `DONE`; reenvío con la misma clave
      no duplica.
- [ ] Resolver el caso cancela la cita pendiente con motivo «caso resuelto».
- [ ] Ficha: sección «Llamada acordada» con historial de la cita.

## Fase 2 — Mi agenda: semana, día y lista (CAM-F08, P1)

- [ ] `get-agenda.ts` acotado al asesor autenticado, con contexto de vuelta.
- [ ] Página `/recovery/agenda`: barra de filtros en vivo (`vista`, `fecha`,
      `tipo`, `estado`, `recencia`, `q`), cabecera «N citas · M tareas»,
      bloques de vencidos / tareas sin hora / pendientes sin fecha, vistas
      Semana, Día y Lista.
- [ ] Navegación: «Mi agenda» junto a «Mi cola de campaña»;
      `sectionForPath("/recovery/agenda")` → Campañas, con prueba.
- [ ] Bandeja: bloque «Compromisos por atender» fuera de los filtros
      (BR-012).

## Fase 3 — Gestionar desde la agenda (CAM-F09, P1)

- [ ] `reschedule-commitment-action.ts`: motivo, clave de idempotencia,
      solo sobre `PENDING`, evento, `next_action_at` del caso.
- [ ] `cancel-commitment-action.ts`: motivo + siguiente acción (cadencia hoy
      o pausa 1–2 días), mismas garantías.
- [ ] Panel del evento con `cita=<id>` en la URL: contexto del caso,
      registrar gestión, reprogramar, cancelar, historial, abrir ficha;
      borrador conservado ante error.
- [ ] Advertencia «a la misma hora» al agendar y reprogramar (BR-016).

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
