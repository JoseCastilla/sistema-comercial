# SPEC-086 — Plan

- Tabla `agr_delivery_missing_orders` (migración
  `20261023120000_add_agr_delivery_missing_orders`): una fila por venta
  ausente con `first_missing_at`, `last_checked_at`, `source_imported_at` y
  `alerted_at`. Aditiva; la API la aplica al arrancar.
- `features/agr-delivery/missing-orders.ts`: regla pura de BR-001.
- `order-history.ts`: `readAgrSourceImportedAt` lee `freshness.imported_at`.
- Sincronización: `fetchAgrDeliveryRecord` devuelve también la hora de
  importación; la corrida guarda la más reciente y, al terminar, registra
  las ausentes. Encontrar la venta borra su fila en la misma transacción
  que guarda la instantánea.
- Pedidos: `agrDeliveryMissing` en la consulta, `missingFromMaximo` en cada
  venta, `totals.missingFromMaximo`, filtro `sinmaximo=1`, franja, insignia
  y aviso del panel. Tono de peligro nuevo para `.ui-order-notice`.
- Logística: cifra y tabla para reportar.

**Entrega en dos pasos**, como SPEC-083: primero la migración sola, para que
la Web no consulte una tabla que todavía no existe.
