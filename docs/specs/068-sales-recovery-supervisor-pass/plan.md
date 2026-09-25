# SPEC-068 — Plan de implementación

## 1. Datos

`get-sales-recovery-inbox.ts`:

- Cada caso trae `hot`, `work` (con `describeSalesRecoveryWork`; si hoy no
  toca, la etapa y cuándo vuelve), `fallReason`, `saleDayLabel` y
  `sellerIsAssignee`; los teléfonos suman los de contacto.
- En abiertos, `hotCases` (todas las calientes filtradas, en el orden de la
  cola) y `cases` con las antiguas paginadas; en resueltos, `cases` como
  antes.
- `totals` pasa a `open, hot, cold, hotNotCalled, hotFollowUpOverdue,
  criticalUnassigned, recoveredThisMonth`.
- `byAdvisor` para quien reparte.

`countOverdueInternalCases` cuenta solo lo caliente: lo usan el aviso y el
resumen del administrador.

## 2. Pantalla

- `SalesRecoveryInbox`: línea de cifras, «Por asesor», filtros con
  `moreFilters`, «Cómo funciona» plegado, calientes y antiguas plegadas.
- `SalesRecoveryRow`: tarjeta con editor y reasignación en la tarjeta.
- `QueueFilters`: opción `moreFilters` (sin efecto en las demás pantallas).

## 3. Pruebas

`bandeja-recupero.test.tsx` reescrita: resumen de tres cifras, por asesor y
su enlace, el asesor sin resumen por asesor, la tarjeta caliente, lo antiguo
plegado, crítica y vendedor, «Más filtros» plegado y abierto si hay filtro,
resueltos, enlace a la venta, paginación de lo antiguo, reasignar y
registrar gestión.
