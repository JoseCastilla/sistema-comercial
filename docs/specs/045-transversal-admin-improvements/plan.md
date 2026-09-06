# SPEC-045 — Plan

## Fase 1

- **`packages/validation/recovery-internal-due.ts`**: `internalRecoveryAnyDue`
  («vencido»), `InternalRecoveryDueFilter`, `internalRecoveryDueFilterOptions`,
  `parseInternalRecoveryDueFilter`, `matchesInternalRecoveryDueFilter` (2
  pruebas node:test).
- **`features/recovery/server/count-overdue-internal-cases.ts`**:
  `getSalesRecoveryAccessWhere` (el mismo alcance por rol que la bandeja) y
  `countOverdueInternalCases` (misma clasificación). La ruta de notificaciones
  lo usa; la alerta enlaza a `vence=vencido`; la bandeja acepta el filtro y lo
  ofrece como «Cualquier vencimiento».
- **`features/recovery/campaign-stage-labels.ts`**: etiquetas, pistas y
  destinos por población; Preparar, Revisar y Repartir los consumen. Preparar
  añade tres conteos con las condiciones de Revisar.
- **Tablero**: cabecera del resumen por equipo con cobertura administrativa y
  enlaces (ADMIN); fila «Sin supervisor · lo cubre administración» enlazada a
  la tarjeta del equipo.
- **Logística**: `Metric` con `href="/orders?status=LOGISTICS"` y pista.
- **Pruebas**: `campanas-etapas.test.ts` (2).

## Fase 2

- **`features/performance/admin-pending.ts`** (puro): bloques, definiciones,
  responsables y destinos; `get-admin-pending-summary.ts` obtiene los doce
  conteos con las mismas condiciones que las pantallas que abren; el tablero
  lo incluye solo para ADMIN sin filtros (`adminPending`).
- **`AdminPendingSummary`** en el tablero, después de los pendientes del mes.
- **`features/recovery/distribution-preview.ts`** (puro):
  `previewEquitableLoad` y `previewDirectLoad` sobre `distributeCasesEquitably`;
  Repartir suma dos `groupBy` (sin primer contacto, vencidos) por asesor y el
  formulario muestra la vista previa en los tres modos (selectores ahora con
  etiqueta accesible).
- **Pruebas**: `campanas-reparto-carga.test.ts` (5).

## Fase 3

- **`features/agr-delivery/schedule.ts`** (puro): `agrSyncSlotHours`,
  `resolveAgrScheduleKey` (la sincronización lo usa) y
  `describeAgrSchedule` (última esperada, próxima, atraso con margen); la
  página de Logística los muestra.
- **Validation**: `FollowUpCaseLike.attemptsInPeriod`; `worked` filtra por el
  período; etiquetas «en el período».
- **Seguimiento**: `periodo=` con `resolveRecoveryBoardPeriod`, intentos
  cargados desde el inicio del período, indicador «Con gestión · período» y
  selector de período. **Tablero**: «Trabajados» enlaza en los cuatro
  períodos.
- **Resumen por equipo**: `activeMembers` por `groupBy` de miembros activos;
  CSS con cabecera y primera columna fijas y rejilla `--teams`.
- **Pruebas**: `logistica-horario.test.ts` (4); `recovery-follow-up.test.mjs`
  ajustado.

## Fase 4

- **`features/dni/dni-stats.ts`** (puro): `splitBySource`,
  `buildDniLookupStats`; `getDniLookupOverview` cuenta por alcance con un
  `groupBy` por origen; el formulario muestra «Tu actividad» y «Toda la
  organización»; el panel de saldo explica la fecha del reporte.
- **`/admin/dito-imports`**: `historial=1&pagina=N`, conteo total, tabla de
  20 por página en solo lectura con navegación.
- **Consultas externas**: textos en `/tools/lines` y en el marco;
  `aria-label` en el selector de equipo del triage.
- **Pruebas**: `dni-actividad.test.ts` (2).
- Fase 0 (spec propia): worker, copias de seguridad, login.
