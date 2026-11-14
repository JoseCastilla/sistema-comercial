# Plan — SPEC-089

1. Módulo puro `apps/web/src/features/agr-delivery/delivery-reading.ts`,
   junto a `order-history.ts` (no en `packages/validation`: lee la forma
   de la foto que arma `order-history.ts` y reutiliza su `parseAgrDateTime`
   y `readString`):
   - `readAgrDeliveryReading(snapshot)` → `AgrDeliveryReading`
     (estado, último movimiento, motivo, pedido, frase de visitas, visitas,
     cierre, movimientos), con las fechas ya formateadas en Lima.
   - `compareAgrVisits` / `describeAgrVisits` (BR-002),
     `formatAgrDate` (BR-003), `clipAgrText` (BR-004),
     `formatAgrStateLabel`, y `agrDeliveryReadingKeys` (lo que el bloque ya
     dice, para no repetirlo entre los campos sueltos).
   - Lee `historial` defensivamente: cada evento debe ser objeto con
     `estado`; acepta `tiempo_hrs` o `tiempoHrs`; ordena por `seq`.
2. Componente `features/agr-delivery/components/agr-delivery-reading.tsx`
   (`AgrDeliveryReadingBlock`): sin estado propio; usa
   `features/recovery/components/copy-value.tsx` (el control del teléfono)
   para el pedido. Estilos nuevos `.ui-agr-reading*` en
   `packages/ui/src/styles/patterns.css`, solo con tokens existentes (día y
   noche por `tokens.css`).
3. Pedidos: `OrderInboxItem.agrDelivery.reading` se calcula en
   `get-order-inbox.ts`; `fields` se conserva para las filas
   (`getAgrReasonText`). `AgrDeliveryPanel` en `order-inbox.tsx` pasa a
   pintar el bloque con su tono y su pie de siempre.
4. Recupero: `get-sales-recovery-case.ts` amplía solo en la ficha la
   selección de la foto (`rawPayload`, `fetchedAt`) sobre
   `salesRecoveryFallOrderSelect`, con el mismo `where` por rol; expone
   `agrDelivery` y `sales-recovery-case-detail.tsx` pinta el mismo bloque
   tras la tarjeta de trabajo.
5. Logística: `app/admin/logistics/page.tsx` selecciona
   `changedOrders`, `errorOrders` y `errorMessage` y los muestra.
6. Pruebas: `visitas-maximo.test.ts` (función pura) y
   `visitas-maximo-bloque.test.tsx` (componente); actualizar
   `historial-maximo.test.ts`, `hoja-pedidos.test.tsx` y
   `lista-asesor.test.ts` al tipo nuevo.
7. Nota en SPEC-075 BR-007; tipos, lint y pruebas de `web` y `@repo/ui`.
8. Pendiente fuera de esta entrega: recorrido visual en navegador
   (`verification.md`), commit y despliegue.
