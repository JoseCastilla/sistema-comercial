# SPEC-047 — Plan

## Fase 1 — Eje de resultado (RD-01, RD-04)

- **Reglas puras** (`@repo/validation`, `performance-metrics.ts`):
  `deliveredPortability` y `deliveredNewLines` en `PerformanceMetrics`;
  `filterOrdersDeliveredThroughLimaDay` para la maduración equivalente.
- **Servidor** (`get-performance-dashboard.ts`): `comparison.deliveredDelta`,
  `deliveredComparable` (entregadas de la cohorte anterior hasta el mismo
  día) y `deliveredMatured` (con cuántas terminó); orden por defecto
  `ENTREGADAS`.
- **Gestión** (`performance-management.ts`): clave de orden `ENTREGADAS`
  (por defecto) y filtro `SIN_ENTREGAS`.
- **Pedidos** (`get-order-inbox.ts`): `DELIVERED` adopta la definición de
  Rendimiento.
- **Tablero** (`performance-dashboard.tsx`): tarjeta hero de entregadas con
  pie de portabilidades/altas y comparación madura; ingresadas secundaria;
  columna «Entregadas» en equipos y asesores; nota de fecha en cada bloque.
- **Pruebas**: `rendimiento-entregadas.test.ts` (métricas por operación,
  maduración, cruce de meses, orden y filtro nuevos).

## Fase 2 — Cumplimiento y resumen visual (RD-02, RD-03)

- `PerformanceQuotaProgress.source` («ASSIGNED» | «DEFAULT») y porcentaje;
  cuota agregada del alcance en el servidor.
- Consulta de entregas por `deliveredAt` dentro del mes y
  `buildDeliveryTrend` (día, entregadas, acumulado, de meses anteriores).
- Componentes: `ResultSummary` (cuatro tarjetas), `DeliveryTrend`,
  `TeamComplianceBars`, `PriorityNotices`, accesos; CSS nuevo en
  `patterns.css` con tokens existentes.

## Fase 3 — Bloques separados (RD-05)

- Cabeceras de bloque y reordenación; `AdminPendingSummary` en `<details>`
  contraído; `columnas=todas` en `performance-links` y en la tabla.

## Verificación

Pruebas unitarias por fase; recorrido local con sesión de administrador
(paridad tarjeta ↔ Pedidos `status=DELIVERED`, suma por equipos, orden y
filtro); producción en solo lectura con las mismas paridades.
