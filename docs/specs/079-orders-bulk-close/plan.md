# SPEC-079 — Plan

- `server/order-status-change.ts`: `applyOrderStatusChange` (extraída de `update-order-status-action.ts`) y `OrderStatusUpdateError`.
- `server/close-orders-action.ts`: una transacción por pedido; junta los cerrados y los fallidos.
- `components/bulk-close-bar.tsx`: barra con confirmación.
- `order-inbox.tsx`: casillas en la celda del cliente (`canBulkClose`), solo en `AWAITING_ACTIVATION`.
- `patterns.css`: casilla y nombre en fila, en una línea y en dos.
