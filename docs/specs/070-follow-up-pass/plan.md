# SPEC-070 — Plan de implementación

## 1. Reglas

`@repo/validation/recovery-follow-up.ts`:

- `recoveryLastTouchAt`, `recoveryDaysUntouched`: el último toque es la
  última gestión o, sin gestiones, la asignación.
- `recoveryStaleDays = 7`, `isRecoveryCaseStale`: `ASSIGNED` o
  `IN_PROGRESS`, sin cita pendiente, 7 días o más sin tocar.
- `recoveryIdleOptions` y el filtro `idle` en `selectFollowUpCases`.
- `summarizeFollowUpByAdvisor`.

## 2. Acción

`release-stale-cases-action.ts`: supervisor (sus equipos), administrador o
back office; relee los candidatos, filtra con `isRecoveryCaseStale`, los
pasa a `OPEN` sin responsable en una transacción (con la condición de que
sigan siendo del asesor) y registra un evento por caso. Revalida
Seguimiento, Tablero, Repartir y «Hoy en mi equipo».

`ReleaseStaleCasesForm`: botón, confirmación con cuántos y de quién,
resultado.

## 3. Pantalla

`/recovery/follow-up`: línea de cifras, «Por asesor» con el botón,
`QueueFilters` con `moreFilters` y `visibleExtras={["idle"]}` (la barra
gana `visibleExtras`), tarjetas y paginación.

## 4. Pruebas

- `recovery-follow-up-stale.test.mjs`: días sin tocar, cuándo se puede
  devolver, el filtro y el resumen por asesor.
- `devolver-casos-sin-tocar.test.tsx`: confirmar, cancelar y resultado.
