# SPEC-048 — Plan de implementación

## 1. Arquitectura

**Una fuente, tres lectores.** Bandeja, ficha y agenda no consultan cosas
distintas: las tres cargan el caso con su intento más reciente y su cita
`PENDING`, y pasan cada caso por un selector puro en `@repo/validation`
(`recovery-agenda.ts`) que devuelve **cero o un elemento de agenda** por
caso (BR-004) o una cita con su estado (BR-005). El selector se prueba solo,
con fechas fijas, en las dos zonas horarias.

**Lo acordado se guarda; lo automático se deriva.** La cita acordada es la
única pieza que necesita historia propia (reprogramar, cancelar, atender sin
contar como llamada), así que tiene tabla. Reintentos, seguimientos,
habilitaciones, «completar venta» y verificación son consecuencias del
estado del caso y ya viven en `next_action_at`, en el último intento y en
las líneas; guardarlas otra vez crearía la segunda agenda que AG-R01
prohíbe.

**El reloj del caso sigue mandando.** `recovery_cases.next_action_at` no
cambia de significado: la bandeja ordena por él, SPEC-040 lo divide en
tramos, el tablero cuenta «Agenda vencida» con él. Crear, reprogramar o
cancelar una cita lo escribe en la misma transacción, de modo que todo lo
que ya existe sigue siendo correcto sin tocarlo.

**Sin biblioteca de calendario.** La semana es una cuadrícula CSS de siete
columnas por franjas de una hora, renderizada en el servidor como el resto
de Campañas; la lista es la misma tabla que la bandeja con otras columnas.
Se evita una dependencia nueva y su carga en el móvil.

## 2. Modelo de datos

Migración `add_recovery_case_commitments` (aditiva; nada se reescribe):

```
recovery_case_commitments
  id                       uuid pk
  organization_id          uuid  → organizations
  case_id                  uuid  → recovery_cases (cascade)
  scheduled_at             timestamptz(3)   -- instante UTC de la hora de Lima acordada
  duration_minutes         int null         -- reservado (§5 de la spec), no se expone
  status                   enum RecoveryCommitmentStatus {PENDING, DONE, RESCHEDULED, CANCELLED}
  origin_attempt_id        uuid null → recovery_case_attempts   -- el AGENDA que la creó
  resolved_attempt_id      uuid null → recovery_case_attempts   -- el intento que la atendió (DONE)
  superseded_by_id         uuid null → recovery_case_commitments -- la cita nueva (RESCHEDULED)
  reason                   text null        -- motivo de reprogramación o cancelación
  cancel_next_action       enum null {RESUME_TODAY, PAUSE_1D, PAUSE_2D}
  created_by_user_id       uuid → users
  closed_by_user_id        uuid null → users
  closed_at                timestamptz(3) null
  client_request_id        uuid null
  created_at               timestamptz(3)
  índices: (case_id, created_at); (organization_id, status, scheduled_at)
  únicos: (case_id, client_request_id); parcial (case_id) WHERE status = 'PENDING'
```

Eventos nuevos en `RecoveryCaseEventType`: `COMMITMENT_RESCHEDULED`,
`COMMITMENT_CANCELLED` (con `previousStatus`/`newStatus` del caso y metadata
con horas anterior y nueva), para que la traza del caso siga en un solo
sitio (SPEC-030 BR-051).

`recovery_cases.portability_eligible_at` deja de estar huérfana: el cruce la
escribe con el mínimo de las líneas activas (BR-006). Sin cambio de esquema.

**Relleno inicial (BR-007)**, en la misma migración como SQL:

```sql
INSERT INTO recovery_case_commitments (…, status, origin_attempt_id, created_by_user_id, created_at)
SELECT … 'PENDING', a.id, a.actor_user_id, a.created_at
FROM recovery_cases c
JOIN LATERAL (SELECT * FROM recovery_case_attempts WHERE case_id = c.id ORDER BY created_at DESC LIMIT 1) a ON true
WHERE c.source = 'NATIONAL_BASE' AND c.status = 'SCHEDULED'
  AND a.result = 'AGENDA' AND a.next_action_at IS NOT NULL
  AND a.next_action_at = c.next_action_at;
```

Antes de aplicarla se cuenta cuántas filas produce en producción
(`docs/operacion/consultas/horas-agendadas-lima.sql` ya lista esa población)
y se anota en `verification.md`.

## 3. Hora de Lima (BR-001)

Ayudante puro `parseLimaDateTimeLocal(raw: string): Date | null` en
`@repo/validation`: acepta `AAAA-MM-DDTHH:mm` (lo que emite `datetime-local`)
y construye el instante con `-05:00` explícito, igual que ya hacen
`recovery-follow-up.ts` y `recovery-queue-filters.ts` para la medianoche.
Sustituye a `new Date(raw)` en `register-recovery-attempt-action.ts` y lo
usan reprogramar y cancelar. Prueba con `TZ=UTC` y con `TZ=America/Lima`
dando el mismo instante.

La validación «debe ser futura» del cliente sigue en el navegador (que sí
está en Lima); la del servidor compara el instante ya convertido.

**Datos ya guardados mal (confirmado el 08/09/2026, spec §2.2):** todas
las citas registradas antes del despliegue de la corrección están cinco
horas antes, no solo las de madrugada. Corrección con
`docs/operacion/consultas/corregir-horas-agendadas-2026-09-08.sql`, en una
transacción y con un instante de corte igual al despliegue del código
corregido: suma cinco horas a la próxima acción de los 30 casos `SCHEDULED`
vigentes y a la hora acordada de los intentos `AGENDA` anteriores al corte,
y deja un evento `NEXT_ACTION_CORRECTED` por caso con la hora anterior, la
nueva y el intento (migración `add_next_action_corrected_event`). Tocar la
hora del intento roza SPEC-030 BR-035: se hace porque el valor guardado no
es lo que el asesor registró sino su traducción errónea, y el evento
conserva el valor anterior. Lo ejecuta José después de desplegar; el script
no corre solo ni dos veces (el corte lo impide).

## 4. Seguridad y alcance

- Página y acciones exigen `requireCommercialAccess`; la población se acota
  por organización, fuente `NATIONAL_BASE` y `assignedUserId = yo`. Para
  `ADMIN`, `BACKOFFICE` y `SUPERVISOR` sin casos propios la página explica
  que la agenda es del asesor y enlaza a Seguimiento.
- Reprogramar y cancelar reutilizan el `where` de acceso de
  `registerRecoveryAttempt` extraído a `recovery-case-access.ts` (una sola
  definición para tipificar, reprogramar y cancelar).
- Datos sensibles: la agenda muestra lo que muestra la bandeja (nombre,
  DNI copiable, teléfono); nada de columnas `A`–`M` ni padres.

## 5. Idempotencia y concurrencia

- `client_request_id` nace con el borrador y viaja en cada envío; el
  servidor devuelve la cita existente si la reconoce (mismo patrón que
  BR-090).
- La transición sale de `PENDING` con `updateMany … where status = 'PENDING'`
  y se comprueba `count === 1`; si es 0, otro actor ya la cerró: error «esta
  cita ya cambió», borrador intacto (BR-010).
- El índice parcial garantiza que dos reprogramaciones concurrentes no dejen
  dos citas pendientes.
- Registrar un intento cierra la cita pendiente dentro de la transacción del
  intento (BR-003, BR-005); resolver el caso, dentro de la de resolución
  (BR-011).

## 6. Rendimiento

Población: casos abiertos de un asesor (decenas, como mucho pocos cientos)
más sus citas de un período. Tres consultas por vista: casos con último
intento y cita pendiente; citas del período en cualquier estado (para
«Reprogramados», «Cancelados», «Completados»); citas `PENDING` vencidas sin
límite de período. Todo en memoria después, con el selector puro. El mes
usa las mismas consultas con un rango mayor y agrega por día.

## 7. Fases

Cada fase se entrega sola, en `main`, con su evidencia.

### Fase 0 — Hora de Lima y consolidación (bloqueante, CAM-F07 parcial)

1. Consulta de producción `horas-agendadas-lima.sql`; anotar resultado
   (hecho el 08/09/2026: 45 citas, todas corridas, 30 vigentes).
2. `parseLimaDateTimeLocal` con pruebas en las dos zonas; sustituir
   `new Date(raw)` en el registro de intentos.
3. `ENV TZ=America/Lima` en los Dockerfiles de `web`, `api` y `worker`, para
   que cualquier resto de código dependiente de la zona falle hacia el lado
   correcto. No sustituye al ayudante: el código sigue sin depender del `TZ`.
4. Migración `add_next_action_corrected_event` y script de corrección de
   datos con corte igual al despliegue; lo ejecuta José y anota el conteo.
5. El cruce consolida `portability_eligible_at` en el caso (BR-006).

### Fase 1 — Compromisos (CAM-F07, P0)

6. Migración `add_recovery_case_commitments` + enums + relleno BR-007.
7. `recovery-agenda.ts` en `@repo/validation`: tipos de elemento, estados,
   `selectAgendaItem(case)`, `commitmentState(commitment, now)`,
   `sameSlot(a, b)` (BR-016), `agendaBuckets` para el mes. Pruebas.
8. `registerRecoveryAttempt`: con `AGENDA` crea la cita; con cualquier
   resultado cierra la `PENDING` como `DONE`. Sin cambio para el asesor.
9. `resolveRecoveryCase`: cancela la `PENDING` con motivo «caso resuelto».
10. Ficha: sección «Llamada acordada» con historial de la cita (cadena
    `superseded_by_id`).

### Fase 2 — Mi agenda: semana, día y lista (CAM-F08, P1)

11. `get-agenda.ts`: carga acotada por alcance + selector puro; contexto
    `volver=` a la ficha como BR-089.
12. Página `/recovery/agenda` con `AgendaFilters` (barra en vivo, `extras`
    de `QueueFilters`), cabecera con cifras «N citas · M tareas», bloques
    de vencidos, tareas sin hora y pendientes sin fecha, y las tres vistas.
13. Navegación: entrada «Mi agenda» junto a «Mi cola de campaña» para el
    rol con casos propios; `sectionForPath("/recovery/agenda")` → Campañas
    con su prueba.
14. Bandeja: bloque «Compromisos por atender» (BR-012) fuera de los filtros.

### Fase 3 — Gestionar desde la agenda (CAM-F09, P1)

15. `reschedule-commitment-action.ts` y `cancel-commitment-action.ts` con
    motivo, clave de idempotencia, comprobación `PENDING`, evento del caso y
    escritura de `next_action_at`.
16. Panel del evento (ruta con estado en la URL, `cita=<id>`): caso y
    contexto, «Registrar gestión» (reutiliza `CampaignAttemptEditor`),
    «Reprogramar», «Cancelar y definir qué sigue», «Historial», «Abrir
    ficha». Borrador conservado ante error (`PanelDraftGuard`).
17. Advertencia de coincidencia al agendar y reprogramar (BR-016).

### Fase 4 — Recordatorios y carga (CAM-F10, P1)

18. Sondeo de avisos: `agendaDue` para el asesor (vencidas + próximas 15
    minutos); `EscalationNotification` habilitado para `AGENT` con enlace a
    la agenda.
19. Cabecera de la agenda: citas y tareas por separado, sin «horas
    ocupadas»; coincidencias marcadas en la cuadrícula.

### Fase 5 — Mes (CAM-F11, P2)

20. Vista mensual con conteos por día y tipo desde `agendaBuckets`; elegir
    un día abre la vista Día; prueba de igualdad de conteos.

## 8. Pruebas

- **Puras (`@repo/validation`, `node --test`)**: `parseLimaDateTimeLocal`
  en dos zonas; un solo elemento por caso y prioridad de derivación;
  `WAITING` nunca ocupa hora; habilitación sin hora; vencida conserva fecha;
  `sameSlot` con 14 y 16 minutos; conteos del mes = suma de días.
- **Componente (`vitest`)**: filtros de la agenda navegan por URL y se
  quitan uno a uno; el bloque de vencidos sobrevive a los filtros;
  `sectionForPath` de la ruta nueva; el panel conserva el borrador tras un
  error de la acción.
- **Recorrido con sesión de asesor de prueba** (ficticia, nunca una persona
  real): la lista de validación de la propuesta, punto por punto, en
  `verification.md`.

## 9. Migración y despliegue

- Una migración aditiva con relleno SQL idempotente (`ON CONFLICT DO
  NOTHING` sobre el índice parcial no aplica; se protege con `NOT EXISTS`).
- Publicar en `main` despliega (`./scripts/entregar.sh`); EasyPanel toma web
  y api. Los Dockerfiles cambian (`TZ`): conviene revisar el primer arranque
  en los registros del contenedor.
- Después del despliegue: consulta de producción con el número de citas
  creadas por el relleno y una cita nueva agendada por un asesor de prueba
  comprobada en hora de Lima.
