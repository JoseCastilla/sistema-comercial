# Plan — SPEC-034

1. **Módulo de alcance compartido.** `performance-access.ts` concentra la
   traducción de alcance a Prisma (`getPerformanceAccessWhere`), la resolución
   de equipos y venta habilitada (`resolvePerformanceScope`) y la validación
   del asesor solicitado (`resolveRequestedAdvisor`). Dashboard y conciliación
   consumen la misma regla.
2. **Filtro por asesor en el dashboard.** El filtro se **interseca** con el
   alcance del actor, de modo que un identificador indebido nunca amplía la
   visibilidad; además se valida contra la organización y los equipos
   supervisados para poder volver al alcance natural.
3. **Aislamiento de la lectura.** Con un asesor seleccionado, la cobertura se
   omite y la tabla y la matriz muestran solo a esa persona.
4. **Enlaces de ida y vuelta.** Nombres de la tabla y de la matriz enlazan al
   dashboard filtrado; el KPI de pagables y "Revisar cálculo" enlazan a la
   conciliación conservando mes, equipo y asesor.
5. **Conciliación por rol.** La página pasa de `requireAdminAccess` a
   `requireCommercialAccess`; el alcance se aplica en el `where` base y los
   importes se redactan según SPEC-014: BACKOFFICE sin montos, SUPERVISOR sin
   importe por línea, AGENT y ADMIN con detalle.
6. Verificar tipos, lint y equivalencia de cifras entre ambas superficies.
