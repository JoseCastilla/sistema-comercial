# Tasks — SPEC-032

- [x] `calculatePerformanceMetrics` deriva pagable/comisión de
      `evaluatePerformanceOrderPayment` (BR-001) —
      `packages/validation/src/performance-metrics.ts`.
- [x] Helpers `getLimaDayOfMonth` y `filterOrdersRegisteredThroughLimaDay`
      exportados desde `@repo/validation` (BR-005).
- [x] `getAccessWhere` acepta `salesEnabled`, traduce
      `SUPERVISED_TEAMS_WITH_OWN_AND_ORPHANS` y niega por defecto (BR-003) —
      `apps/web/src/features/performance/server/get-performance-dashboard.ts`.
- [x] Vendedores primarios incluyen al supervisor vendedor (BR-004).
- [x] Comparación pro-rata en KPIs y tabla por asesor, con
      `comparedThroughDay` expuesto y etiquetado en la UI (BR-005, BR-006).
- [x] Fila "Sin asesor" en el análisis detallado con estilo de alerta (BR-002)
      — `performance-dashboard.tsx` + `patterns.css`.
- [x] Pruebas nuevas de dominio en `performance-metrics.test.mjs` (AC-007):
      4 casos, 180 pruebas del paquete en verde.
- [x] TypeScript y lint de `web`, `ui` y `validation` sin errores.
- [x] Validación visual ADMIN con datos locales reales (30/08/2026):
      dashboard y conciliación cuadran en 112 pagables / S/ 2,700.00; suma de
      la tabla = KPI; encabezado pro-rata presente.
- [ ] Validación visual SUPERVISOR vendedor (AC-003) — requiere sesión con ese
      rol.
- [x] Evidencia en `verification.md`.
