# SPEC-033 — Política de comisiones centralizada

**Estado:** `IMPLEMENTED_LOCAL`
**Versión:** 1.0
**Fecha:** 2026-08-30

## Problema

Las tarifas base (S/ 25.00 postpago, S/ 12.50 prepago) y los tramos del
acelerador estaban definidos como literales en tres lugares distintos:
`performance-metrics.ts`, `get-performance-reconciliation.ts` y la interfaz del
mix de ventas. Cambiar una tarifa exigía tocar tres archivos y era fácil dejar
uno desalineado — el mismo tipo de divergencia que SPEC-032 corrigió en la
elegibilidad de pago.

## Objetivo

Una única fuente para toda cifra de la política de comisiones, preparada para
versionar por vigencia cuando exista la liquidación mensual de SPEC-014, sin
cambiar el resultado actual de ningún cálculo.

## Reglas de negocio

- **BR-001:** `getPerformanceCommissionPolicy()` en `@repo/validation` es la
  única fuente de tarifas base por operación y de los tramos del acelerador
  (ventana, objetivos, montos y extra por confirmada). Ningún consumidor puede
  declarar estas cifras como literal propio.
- **BR-002:** el acelerador y `getPotentialBaseCommissionCents` derivan sus
  valores de la política; la conciliación y la interfaz consumen las mismas
  funciones.
- **BR-003:** la firma acepta un mes opcional para introducir vigencias en el
  futuro sin romper a los consumidores. Mientras no existan liquidaciones
  versionadas, devuelve la política única vigente.
- **BR-004:** el cambio es de refactorización: ningún monto, tasa ni tramo
  cambia de valor.

## Criterios de aceptación

- **AC-001:** buscar los literales de tarifas y tramos (`2_500`, `1_250`,
  `20_000`, `30_000`) fuera de la política no devuelve resultados en `apps/web`
  ni en `packages/validation`.
- **AC-002:** el dashboard, el mix y la conciliación muestran exactamente los
  mismos montos que antes del cambio.
- **AC-003:** una prueba de dominio verifica que la política y
  `getPotentialBaseCommissionCents` no pueden divergir.

## Fuera de alcance

- Tabla de tarifas en base de datos y vigencias reales: dependen de la
  liquidación mensual (`DRAFT → LOCKED`) de SPEC-014, aún sin decidir.
- Cambiar valores de tarifas o tramos.
