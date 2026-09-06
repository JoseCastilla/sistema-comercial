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
- [x] Recorrido con sesión real de supervisor (producción, solo lectura,
      HUANCAYO - EL TAMBO): origen del plan SUP-01..06.
- [x] Recorrido con sesión real de asesor (producción, solo lectura, Jimena
      Cuya): origen del plan ASE-01..06.
- [ ] Supervisor que también vende; supervisor con varios equipos.

## Fase 4 · Supervisor (05/09/2026)

- [x] SUP-01 · Verificado resuelto por la fase 1 con la sesión de supervisor.
- [x] SUP-02 · «Hoy», «Última venta», «N de M días con ventas»; filtro «Sin
      ventas hoy» solo en el mes en curso; textos sin juicio de asistencia.
- [x] SUP-03 · Orden «Bono: más cerca del siguiente tramo».
- [x] SUP-04 · Reparto explicado (objetivo, repartido, diferencia con signo);
      «asignada / por defecto»; «N vendedores × tramo».
- [x] SUP-05 · Cabecera de Cuotas por alcance: «Objetivo de tus equipos».
- [x] SUP-06 · Volúmenes en la comparación; cambiar de equipo quita al
      asesor; aviso de asesor ajeno al equipo.
- [x] Inconsistencia documental SPEC-014 BR-019 vs SPEC-034 registrada.
- [x] Recorrido local con sesión de administrador.
## Fase 5 · Asesor (05/09/2026)

- [x] ASE-01 · Cuota personal en la vista personal, solo lectura, con cohorte.
- [x] ASE-02 · Ventanas en curso / por comenzar / cerradas; «te falta» solo de
      la vigente; aviso en los días sin tramo.
- [x] ASE-03 · Consejo del pulso desde los pendientes reales.
- [x] ASE-04 · Bloque «Pendientes de meses anteriores» con enlace exacto.
- [x] ASE-05 · Orden: objetivo y acciones → hoy → comisión → análisis.
- [x] ASE-06 · Conciliación del asesor sin «Sin asesor» ni columna de asesor.
- [x] Recorrido local con sesión de administrador (bloque de anteriores,
      estados de ventana, conciliación intacta para ADMIN).
- [ ] Lectura de solo lectura en producción con la sesión de asesor.

- [x] Lectura de solo lectura en producción con la sesión de supervisor
      (HUANCAYO - EL TAMBO: cuotas por alcance, reparto 270 de 300, hoy y
      última venta, 95 frente a 13).
