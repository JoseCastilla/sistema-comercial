# SPEC-064 — Cuota mensual

**Estado:** `BORRADOR` — decisión de José del 24/09/2026; una pregunta abierta sobre las cuotas ya cargadas (24/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-24

## 1. Origen

Al revisar «Mi día» en producción (SPEC-063), José vio que la asesora
Alexandra tenía «38 de 100» de cuota y 51 ventas pagables. Aclaró que **la
cuota de 100 es lo que debe lograr en todo el mes**.

SPEC-038 (BR-007, BR-010) define la cuota **por ventana** (1 al 15 y 25 a fin
de mes) y el sistema la guarda y la mide así (`PerformanceQuota.window`). La
pantalla de Cuotas abre en la ventana vigente (`get-performance-quotas.ts:90`),
que del 1 al 24 es la primera: una cuota mensual cargada a inicios de mes
queda guardada como cuota de la ventana del 1 al 15, y Rendimiento la mide
solo contra las ventas de esos días. Por eso decía 38 y no 52.

## 2. Regla

- **BR-001 — La cuota es del mes completo.** Se mide en portabilidades
  entregadas de las ventas ingresadas en el mes (cohorte por ingreso, mismo
  criterio de SPEC-038 BR-007 sin recortar por ventana).
- **BR-002 — Los bonos no cambian.** Siguen por ventana (SPEC-038 BR-001 a
  BR-006): la cuota es un objetivo de gestión y no paga (SPEC-038 BR-012).
- **BR-003 — Misma cadena de reparto** (organización → equipo → asesor,
  SPEC-038 BR-009) y mismo congelamiento al cerrar el mes (BR-010), sin
  selector de ventana.
- **BR-004 — Una sola lectura en todas las pantallas.** «Mi día»,
  Rendimiento (tarjeta, resumen por equipo, avance por asesor) y Cuotas
  muestran la misma cifra mensual.

## 3. Pregunta abierta

- **P-01 — Las cuotas ya cargadas.** ¿Las cuotas de setiembre (y las de
  meses anteriores) se cargaron pensando en el mes completo? Recomendación:
  sí, porque la pantalla abría en la primera ventana. Se toma como mensual la
  de la primera ventana y, si no existe, la de la segunda; si un asesor tiene
  las dos, José decide cuál vale.

## 4. Fuera de alcance

- Cambiar las ventanas de bono o sus montos.
