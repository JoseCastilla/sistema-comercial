# SPEC-044 — Plan

## Fase 1

- **`performance-links.ts`**: todos los enlaces del tablero en un módulo puro
  y probado (`performanceHref`, `advisorHref`, `reconciliationHref`,
  `ordersHref`, `recoveryCasesHref`). El componente deja de construir URLs.
- **Paridad «por activar»** en `get-order-inbox.ts` (`AWAITING_ACTIVATION`):
  misma definición que `performance-metrics.ts`.
- **`volver=`** en Pedidos: la página lo valida (solo `/performance…`), viaja
  en `OrderInboxData.returnTo`, `ordersHref` lo conserva y la cabecera lo
  muestra.
- **Casos de recupero** en el tablero: un `groupBy` por responsable con el
  mismo alcance que el tablero (asesor, equipo, cartera propia, equipos
  supervisados), total en «Pendientes de intervención» y por fila en el
  desglose, ambos enlazando a `/recovery/sales` (SPEC-041).

## Fase 2

- **`performance-management.ts`** (puro, probado): claves de orden
  (`orden=`) y de filtros de gestión (`gestion=`) con etiqueta y definición;
  `parse*`, `matchesManagementFilter`, `filterBreakdown`, `sortBreakdown`.
- **Servidor** (`get-performance-dashboard.ts`): `buildQuotaProgress` compartido
  (entregadas, confirmadas, brecha, siguiente tramo individual);
  `buildTeamSummaries` agrupa los pedidos por `assignedTeamId`, cuenta la
  plantilla por equipo (`sellersByTeam`), casos de recupero por equipo
  (segundo `groupBy`), supervisor activo y cuota de equipo (fila
  `performanceQuota` con `teamId` o defecto × plantilla); `quotaWindow`
  expone `startDay`/`endDay`; devuelve `sort`, `management`, `teams`.
- **Enlaces**: `performanceHref` conserva `orden` y `gestion`; `sortHref`,
  `managementHref` (alterna), `quotasHref`; `recoveryCasesHref` admite equipo.
- **Componente**: `TeamSummaryPanel` (tabla con pie de reconciliación),
  `ManagementBar` (fichas-enlace con `aria-current` y definición),
  `AdvisorBreakdown` (abierto, ordenado y filtrado, `QuotaCell` con
  confirmadas y siguiente tramo); la matriz sigue el mismo filtro y orden; la
  tarjeta «Asesores con ventas» abre `gestion=SIN_PRODUCCION`.
- **CSS**: `.performance-management*` y `.performance-teams tfoot` en
  `patterns.css`.

## Fase 3

- **`DirectoryFilters`** gana `fields` (campos de mes que aplican al cambiar y
  no se «quitan») y `search` opcional; los directorios administrativos no
  cambian.
- **`performance-management.ts`**: `normalizeSearchTerm`,
  `filterBreakdownBySearch` (sin tildes ni mayúsculas), `matrixRangeKeys`,
  `parseMatrixRange`, `resolveMatrixRange`, `selectMatrixDays`.
- **Enlaces**: `performanceHref` conserva `q` y `matriz`; `advisorHref` ya no
  alterna; `teamHref` («Ver todo el equipo»), `matrixHref`.
- **Servidor**: acepta `search` y `matrix`; devuelve `search`, `matrixRange` y
  `matrixRangeRequested`; sin equipos que resumir no hay filas residuales.
- **Componente**: `visibleAdvisors` (gestión + búsqueda + orden) para desglose
  y matriz; barra `DirectoryFilters` con mes, búsqueda, vista, equipo y
  asesor; «Ver todo el equipo» en la cabecera; matriz con fichas de ventana y
  días recortados; secciones reordenadas con el encabezado «Análisis
  detallado».
- **Pruebas**: `rendimiento-filtros-vivos.test.tsx` (7) y ajuste de
  `rendimiento-enlaces.test.ts`.

## Fase 4 · Supervisor

- **`performance-management.ts`**: filtro `SIN_VENTAS_HOY`
  (`requiresCurrentMonth`, contexto `todayIndex`), orden `BONO`,
  `summarizeAdvisorActivity` (hoy, última venta, días con ventas, sin
  futuros).
- **`quota-distribution.ts`**: `describeQuotaDistribution` (UNDER / EXACT /
  OVER con texto).
- **`get-performance-quotas.ts`**: `organization.scope`
  (`SUPERVISED_TEAMS` para el supervisor), `explicitTarget`, `teamCount`; el
  objetivo mostrado al supervisor es la suma de sus equipos.
- **`get-performance-dashboard.ts`**: `advisorOutsideTeam`.
- **`DirectoryFilters`**: `resets` por selector.
- **Componentes**: columnas «Hoy» / «Última venta» (`ActivityCell`), `title`
  con volúmenes, `comparedVolumes` en la tarjeta principal, aviso de asesor
  ajeno, cabecera de Cuotas por alcance, textos de reparto, «asignada / por
  defecto».
- **Pruebas**: `rendimiento-supervisor.test.tsx` (6).

## Fase 5 · Asesor

- **`accelerator-windows.ts`** (puro): `describeAcceleratorWindows` (estado
  por día), `isOutsideAcceleratorWindows`, `describePendingAdvice`.
- **Servidor**: `personalQuota` (vista personal, misma cuota que supervisión),
  `acceleratorWindows` + `todayDay`, `pendingBeforeMonth` (conteo y rango
  exacto con `aggregate`).
- **Enlaces**: `applyOrdersScope` compartido; `earlierPendingHref` (`RANGE`
  + `status=ACTIVE` + alcance + `volver`).
- **Componentes**: `PersonalQuotaPanel`, `EarlierPendingBlock`, comisión con
  estado por ventana, consejo del pulso desde pendientes, reorden de la vista
  personal; conciliación sin «Sin asesor» ni columna de asesor para `AGENT`.
- **Pruebas**: `rendimiento-asesor.test.ts` (7).

## Verificación

Pruebas puras de los enlaces; recorrido local con sesión de administrador
(enlaces, vuelta, paridad de conteos) y lectura de producción; cada fase se
revisa también con el alcance de `SUPERVISOR` y la vista `SELF` antes de sus
revisiones propias.
