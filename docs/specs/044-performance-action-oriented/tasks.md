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
- [ ] Lectura de solo lectura en producción tras el despliegue.

## Fase 2 · Equipos, cuotas y gestión

- [ ] REN-02 · Resumen por equipo con responsable, plantilla y cuota.
- [ ] REN-04 · Avance de cuota visible y ordenable; confirmadas y brecha al
      siguiente tramo; acceso visible a cuotas.
- [ ] REN-05 · Filtros de gestión en la URL con definición.

## Fase 3 · Filtros vivos y jerarquía

- [ ] REN-06 · `DirectoryFilters` en el tablero; nombre del asesor siempre
      filtra; «Ver todo el equipo» aparte.
- [ ] REN-07 · Reordenación de secciones; matriz 7 días / mes.
- [ ] Revisiones de las vistas `SUPERVISOR` y `AGENT`.
