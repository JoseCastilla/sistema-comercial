# SPEC-044 — Tareas

## Fase 1 · Contexto y enlaces (05/09/2026)

- [x] `performance-links.ts` con `ordersHref` (equipo, asesor, cohorte,
      `volver`), `recoveryCasesHref`, y el resto de enlaces del tablero;
      5 pruebas.
- [x] REN-01 · Pedidos: `AWAITING_ACTIVATION` con la definición de
      Rendimiento; `volver=` validado, conservado y visible.
- [x] REN-03 · «Pedidos por recuperar» y «Casos de recupero abiertos» en
      Pendientes de intervención; celdas del desglose enlazadas por asesor
      (y «Sin asesor» a `team=UNASSIGNED`); conteo de casos por responsable
      con el alcance del tablero.
- [x] Recorrido local con sesión de administrador (paridad 17/17, 4/4, 0/0;
      vuelta con filtros; casos 1/1).
- [x] Lectura de solo lectura en producción tras el despliegue (21/21,
      80/80, 70/70; fila individual 7/7, 8/8, 2/2).

## Fase 2 · Equipos, cuotas y gestión (05/09/2026)

- [x] `performance-management.ts` con orden y filtros de gestión; 9 pruebas
      (`rendimiento-gestion.test.ts`).
- [x] REN-02 · Resumen por equipo con responsable, plantilla, pendientes,
      casos y cuota; filas residuales y pie que reconcilia con el alcance.
- [x] REN-04 · Desglose abierto antes de la matriz, ordenable por URL
      (`orden=`), celda de cuota con confirmadas y siguiente tramo, cohorte
      con días explícitos; «Asignar cuotas» junto al resumen por equipo.
- [x] REN-05 · Filtros de gestión (`gestion=`) con definición y «N de M»;
      rigen desglose y matriz; la tarjeta «Asesores con ventas» abre «Sin
      producción».
- [x] Recorrido local con sesión de administrador (reconciliación 177 y 17;
      filtros y orden por URL; vuelta con `orden`/`gestion`).
- [ ] Lectura de solo lectura en producción tras el despliegue.

## Fase 3 · Filtros vivos y jerarquía

- [ ] REN-06 · `DirectoryFilters` en el tablero; nombre del asesor siempre
      filtra; «Ver todo el equipo» aparte.
- [ ] REN-07 · Reordenación de secciones; matriz 7 días / mes.
- [ ] Revisiones de las vistas `SUPERVISOR` y `AGENT`.
