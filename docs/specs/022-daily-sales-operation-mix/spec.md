# SPEC-022 — Mix de ventas por período

**Estado:** `ENTREGADA` — sin estado hasta hoy; la regla de la semana se corrigió para coincidir con SPEC-005 y el código (06/09/2026)

## Objetivo

Dar visibilidad inmediata sobre la composición de las ventas ingresadas hoy, esta semana y este mes: alta nueva, portabilidad de origen prepago y portabilidad de origen postpago.

## Reglas

- Las cohortes se determinan por `registeredAt` dentro del día, semana calendario de lunes hasta hoy y mes calendario de `America/Lima`.
- ~~La semana puede cruzar de mes; no se recorta artificialmente al primer día del mes.~~ *Corregido el 06/09/2026: la semana **no** cruza de mes, como define SPEC-005 y aplica `getOrderPeriodRange("WEEK")`. La composición semanal ya no se muestra: el tablero (SPEC-044) presenta la composición de las entregadas del mes.*
- El mix reutiliza el mismo alcance de permisos, vista y equipo del panel de rendimiento.
- En vista personal, el asesor o supervisor vendedor ve únicamente su mix.
- En vista de equipo, se muestra el agregado de los tres períodos y un detalle diario desplegable por asesor.
- Las operaciones sin clasificación se muestran como `Por clasificar`; nunca se ocultan del total.
- El mix aparece al consultar el mes en curso, junto al pulso operativo.
- El análisis territorial por departamento o ciudad es una dimensión independiente y no forma parte de este mix comercial.
