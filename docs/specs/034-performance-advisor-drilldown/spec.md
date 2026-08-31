# SPEC-034 — Filtro por asesor y evidencia de pagables

**Estado:** `IN_PROGRESS`
**Versión:** 1.0
**Fecha:** 2026-08-30

## Problema

El dashboard de rendimiento permite filtrar por equipo, pero no por persona.
Un supervisor que detecta a un asesor con baja conversión en la tabla no puede
aislar su lectura, y los nombres de la tabla no llevan a ningún lado.

Al mismo tiempo, el asesor ve el **número** de sus portabilidades pagables,
pero no puede abrir **cuáles** son. La evidencia orden por orden vive solo en
`/performance/reconciliation`, que es exclusiva de ADMIN. Nadie más puede
auditar la cifra que determina su comisión.

## Objetivo

Que cualquier rol pueda pasar del indicador a las órdenes que lo explican
dentro de su alcance, y que la lectura del rendimiento pueda acotarse a una
persona sin salir del dashboard.

## Reglas de negocio

- **BR-001:** el dashboard acepta un filtro por asesor. El asesor solicitado se
  valida contra el alcance del actor: ADMIN y BACKOFFICE sobre la
  organización, SUPERVISOR sobre los asesores de sus equipos supervisados más
  él mismo cuando tiene venta habilitada. Un identificador fuera del alcance
  se ignora y la vista vuelve a su alcance natural, sin error ni filtración.
- **BR-002:** AGENT no dispone del filtro: su vista ya está acotada a sí mismo.
- **BR-003:** el filtro por asesor convive con el de equipo. Al elegir un
  asesor, la lectura se restringe a sus órdenes en el período, conservando el
  resto de la superficie — KPIs, tendencia, embudo y mix — sin cambiar ninguna
  fórmula.
- **BR-004:** los nombres de la tabla por asesor y las filas de la matriz
  diaria enlazan al dashboard filtrado por esa persona.
- **BR-005:** la evidencia de pagables se abre desde el KPI "Portabilidades
  pagables" hacia la conciliación, cuyo alcance deja de ser exclusivo de
  ADMIN: cada rol ve las órdenes que ya puede ver en la bandeja — AGENT las
  propias, SUPERVISOR las de sus equipos, ADMIN y BACKOFFICE la organización.
- **BR-006:** la conciliación respeta las reglas económicas vigentes de
  SPEC-014: BACKOFFICE no ve importes; SUPERVISOR ve el detalle operativo de
  sus equipos sin el importe individual de cada asesor; AGENT ve su propio
  importe; ADMIN concilia todo.
- **BR-007:** ninguna métrica ni fórmula cambia en este incremento. El filtro
  restringe el conjunto de órdenes, no la manera de calcular.

## Criterios de aceptación

- **AC-001:** ADMIN y SUPERVISOR pueden filtrar el rendimiento por un asesor
  de su alcance y la etiqueta de alcance nombra a esa persona.
- **AC-002:** un identificador de asesor fuera del alcance no filtra ni revela
  datos: la vista vuelve al alcance natural del actor.
- **AC-003:** los nombres de la tabla por asesor son enlaces que aplican el
  filtro conservando mes y equipo.
- **AC-004:** un AGENT abre desde su KPI de pagables la lista de sus órdenes
  pagables del período, con el motivo de cada una.
- **AC-005:** un SUPERVISOR abre la evidencia de su equipo sin ver el importe
  individual por asesor; BACKOFFICE la abre sin importes.
- **AC-006:** un AGENT que solicita la conciliación de otro asesor no obtiene
  sus datos.
- **AC-007:** los totales del dashboard filtrado por asesor coinciden con la
  fila de esa persona en la tabla por asesor.

## Fuera de alcance

- Ordenamiento configurable de la tabla por asesor.
- Página propia por asesor (`/performance/[agentId]`): el filtro cubre la
  necesidad sin duplicar superficie.
- Exportación a CSV.
