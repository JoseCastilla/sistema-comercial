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

## Fases siguientes

- Fase 2: agregación por equipo en el servidor (reutilizando el desglose por
  asesor y las cuotas de `get-performance-quotas`), orden por URL, filtros
  de gestión como parámetros.
- Fase 3: `DirectoryFilters` en el tablero y reordenación de secciones;
  matriz con rango de días visible.

## Verificación

Pruebas puras de los enlaces; recorrido local con sesión de administrador
(enlaces, vuelta, paridad de conteos) y lectura de producción; cada fase se
revisa también con el alcance de `SUPERVISOR` y la vista `SELF` antes de sus
revisiones propias.
