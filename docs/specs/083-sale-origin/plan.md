# SPEC-083 — Plan

- Migración `20260926120000_add_dito_order_sale_origin`: tipo `SaleOrigin`, tres columnas, clave foránea y relleno desde la nota.
- `dito.prisma` y `core.prisma`: campo y relación `DitoOrderSaleOriginSetBy`.
- `server/set-sale-origin-action.ts`: alcance con `resolveDitoOrderVisibility`.
- `components/sale-origin-picker.tsx`: el selector del panel.
- `get-order-inbox.ts`: `saleOrigin` y `canSetSaleOrigin`.
- `order-inbox.tsx`: el selector en el panel y el origen en la fila.
