# Verificación — SPEC-033

## Automatizada — 30/08/2026

- [x] `pnpm run test` en `packages/validation`: 181 pruebas en verde, incluida
      la nueva "la política de comisiones es la única fuente de tarifas y
      tramos".
- [x] `pnpm run check-types` y `pnpm run lint` en `apps/web` sin errores.
- [x] Grep de `2_500|1_250|30_000|20_000` en `apps/web/src`: solo quedan
      timeouts sin relación con comisiones; en `packages/validation/src` solo
      la política (AC-001).

## Visual — sesión ADMIN local, 30/08/2026

- [x] `/performance` de agosto tras el cambio: mix "8 pagables × S/ 12.50 =
      S/ 100.00" y "104 pagables × S/ 25.00 = S/ 2,600.00"; total estimado
      S/ 2,700.00 — idéntico a la evidencia previa al cambio (AC-002).
