# SPEC-080 — Plan

- `features/orders/advisor-order-groups.ts`: `getAdvisorOrderGroup`, `groupAdvisorOrders` y `getAgrReasonText`.
- `get-order-inbox.ts`: `advisorPageSize` de 300 para el asesor.
- `page.tsx`: vista por defecto del asesor, `ALL`.
- `order-inbox.tsx`:
  - Sin pestañas para el asesor.
  - `DesktopOrderList` con `groups`: cabeceras, plegado y motivo.
  - Teclado entre grupos.
  - `displayItems` para elegir y avanzar.
  - Grupos en el celular.
- `patterns.css`: `.ui-order-grid__group` y `.ui-order-grid__reason`.
