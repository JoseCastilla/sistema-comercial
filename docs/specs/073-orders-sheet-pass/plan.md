# SPEC-073 — Plan

En `order-inbox.tsx`:

- `OrderSummary` reemplaza `MetricGroup` y los tres avisos (`ui-inbox-alert`, `ui-recovery-queue` y `ui-prior-pending`).
- `attentionItems` arma los enlaces de «por atender» con los mismos `ordersHref` que usaban los avisos anteriores.
- `OrderDetails` se reordena: el panel del operador va tras la identidad, y la ficha comercial (`ui-order-identity`) va tras la gestión.
- `DesktopOrderList` suma a cada fila:
  - `ui-order-grid__meta`, con orden, operador y asesor bajo el nombre;
  - `ui-order-grid__inline-action`, con la acción junto al estado.

  Las dos quedan ocultas en la hoja ancha.

En `patterns.css`:

- `.ui-order-grid` pasa a ser contenedor `order-list`.
- `@container order-list` pasa la fila a dos renglones con `grid-template-areas` bajo 45,25 rem, o bajo 49,85 rem con Asesor.
