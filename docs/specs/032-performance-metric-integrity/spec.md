# SPEC-032 — Integridad de métricas de rendimiento

**Estado:** `IN_PROGRESS`
**Versión:** 1.0
**Fecha:** 2026-08-30

## Problema

El dashboard de rendimiento presenta tres inconsistencias que erosionan la
confianza en sus números:

1. Una portabilidad entregada y cerrada **sin asesor asignado** suma como
   pagable y genera comisión base en el dashboard, pero la conciliación la
   excluye con razón `UNASSIGNED`. Los totales de ambas superficies no cuadran.
2. Un **supervisor con venta habilitada** no ve sus propias ventas en la vista
   de equipo, porque el traductor de alcance del dashboard nunca activa la rama
   `SUPERVISED_TEAMS_WITH_OWN_AND_ORPHANS`; peor, si esa rama llegara a
   activarse, el traductor no la reconoce y caería al alcance de toda la
   organización.
3. La **comparación mensual** contrasta el mes en curso (parcial) contra el mes
   anterior completo. El día 5 el delta siempre es catastrófico; el día 28,
   optimista. La señal no sirve para decidir.

## Contexto operativo

Desde septiembre de 2026 toda venta nace dentro del Sistema Comercial, por lo
que **ninguna orden debe quedar huérfana**. Una orden sin asesor deja de ser un
caso tolerado y pasa a ser una alerta de calidad de datos que debe verse, no
diluirse en los totales.

## Reglas de negocio

- **BR-001:** una orden sin asesor asignado no es pagable ni genera comisión en
  ninguna superficie. El dashboard y la conciliación derivan la elegibilidad de
  pago de la misma cascada (`evaluatePerformanceOrderPayment`); queda prohibido
  duplicar la regla en línea.
- **BR-002:** las órdenes sin asesor de la cohorte se presentan como fila
  propia "Sin asesor" en el análisis por asesor, de modo que la suma de la
  tabla cuadre con los KPIs. La fila es una alerta de calidad de datos, no un
  participante del ranking.
- **BR-003:** el alcance del supervisor con venta habilitada incluye sus
  propias órdenes además de las de sus equipos supervisados y las huérfanas
  (`SUPERVISED_TEAMS_WITH_OWN_AND_ORPHANS`), replicando el comportamiento de la
  bandeja. El traductor de alcance a Prisma cubre todos los tipos de alcance de
  forma exhaustiva y, ante un tipo no reconocido, niega el acceso en lugar de
  ampliarlo.
- **BR-004:** el supervisor con venta habilitada cuenta como vendedor activo en
  la cobertura y en la tabla por asesor, aunque su equipo primario de venta no
  esté entre los que supervisa.
- **BR-005:** cuando el mes consultado es el mes en curso, toda comparación
  contra el mes anterior usa la porción equivalente: del día 1 al día
  transcurrido en Lima. Los meses cerrados comparan mes completo contra mes
  completo. Aplica a los KPIs y a la variación por asesor.
- **BR-006:** la comparación pro-rata se declara en la interfaz ("vs. días
  1–N del mes anterior"); nunca se presenta como si fuera el mes completo.

## Criterios de aceptación

- **AC-001:** una portabilidad entregada y cerrada sin asesor no suma en
  "Portabilidades pagables", no aporta comisión y aparece en la fila "Sin
  asesor" del análisis detallado.
- **AC-002:** el total estimado del dashboard coincide con el de
  `/performance/reconciliation` para el mismo período y alcance.
- **AC-003:** un supervisor con venta habilitada ve sus propias ventas en la
  vista de equipo, incluso si su equipo primario no está supervisado por él.
- **AC-004:** el traductor de alcance no devuelve el alcance de organización
  para ningún tipo distinto de `ORGANIZATION`.
- **AC-005:** en el mes en curso, los deltas de KPIs y de la tabla por asesor
  comparan los mismos días transcurridos y la etiqueta lo declara.
- **AC-006:** al consultar un mes cerrado, la comparación vuelve a ser mes
  completo contra mes completo.
- **AC-007:** pruebas de dominio cubren la exclusión de pagables sin asesor y
  el recorte pro-rata del mes anterior.

## Fuera de alcance

- Metas configurables, proyección de cierre de mes y tabla de tarifas
  versionada (quedan para un incremento posterior).
- Cambios en la bandeja de pedidos o en el motor de recuperos.
- Agregación en SQL y caché del dashboard.
