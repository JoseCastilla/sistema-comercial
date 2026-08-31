# Plan — SPEC-033

1. Definir `PerformanceCommissionPolicy` y `getPerformanceCommissionPolicy()`
   en `packages/validation/src/performance-metrics.ts`, con el mes opcional
   reservado para vigencias.
2. Hacer que `getPotentialBaseCommissionCents` y `calculateAcceleratorOne`
   lean de la política.
3. Reemplazar los literales de `get-performance-reconciliation.ts` por
   `getPotentialBaseCommissionCents`.
4. Reemplazar los literales del mix en `performance-dashboard.tsx` por la misma
   función.
5. Prueba de dominio que impida la divergencia entre política y tarifas.
6. Verificar tipos, lint y equivalencia visual de montos.
