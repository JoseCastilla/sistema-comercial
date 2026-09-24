# SPEC-064 — Cuota mensual

**Estado:** `VERIFICADA` — cuota mensual en Cuotas, Rendimiento y «Mi día», verificada en producción (24/09/2026)

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

## 3. Decisiones de José (24/09/2026)

- **P-01 — Las cuotas ya cargadas son todas mensuales.** Se toma como
  mensual la de la primera ventana y, si no existe, la de la segunda.
- **Cómo baja la cuota.** José recibe la cuota de la organización (por
  ejemplo 1 000), la reparte entre los equipos, y **cada líder de equipo la
  reparte entre sus asesores según su modalidad de trabajo** (part time, full
  time, externo…). La cifra de cada asesor la decide su líder, que responde
  por cubrir la cuota del equipo con el apoyo de sus asesores. Es la cadena
  de SPEC-038 BR-009, ahora mensual; la modalidad no se modela: el líder la
  refleja en la cifra que asigna.

- **BR-005 — Cuota por defecto** (adoptada como recomendación; José puede
  corregirla): sin cuota asignada, la del mes es **45**, la suma del primer
  tramo de cada bono (30 + 15): el mínimo que cobra los dos bonos, en el
  espíritu de SPEC-038 BR-008. Se rotula «cuota por defecto». Un equipo sin
  cuota propia usa 45 por cada vendedor activo.
- **BR-006 — Qué es «confirmada» en la cuota.** Junto a las entregadas, la
  cuota muestra las que ya pagan comisión (entregadas y cerradas del mes).
  Cuánto falta para el siguiente tramo de bono se sigue diciendo por su
  ventana.

## 4. Fuera de alcance

- Cambiar las ventanas de bono o sus montos.
