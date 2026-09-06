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
- [x] Lectura de solo lectura en producción (278/24/83/70 reconciliados;
      3 de 20 sin producción; orden por cuota).

## Fase 3 · Filtros vivos y jerarquía (05/09/2026)

- [x] `DirectoryFilters` con campos de mes y búsqueda opcional; reglas de
      búsqueda y ventana de matriz en `performance-management.ts`; 7 pruebas.
- [x] REN-06 · Barra en vivo en el tablero (mes, búsqueda, vista, equipo,
      asesor); el nombre del asesor siempre filtra; «Ver todo el equipo».
- [x] REN-07 · Secciones reordenadas (equipos y pendientes → desglose →
      comisión → análisis detallado); matriz «últimos 7 días / mes completo»
      por URL sin tocar la cohorte.
- [x] Revisión por lectura del código de las vistas `SUPERVISOR` y `AGENT`
      (decisiones escritas en la spec).
- [x] Recorrido local con sesión de administrador.
- [x] Lectura de solo lectura en producción (barra en vivo, búsqueda «cuya»
      1 de 19 sin tocar 278 ingresadas, matriz de días transcurridos).
- [ ] Recorrido con sesión real de supervisor y de asesor (pendiente de una
      cuenta de prueba; de José).
