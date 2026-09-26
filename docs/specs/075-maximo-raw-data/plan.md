# SPEC-075 — Plan

- `get-order-inbox.ts`:
  - `getAgrDeliveryFields` arma los campos desde `rawPayload`: primero los
    conocidos, en el orden de la fuente; después los nuevos, por nombre.
  - `describeAgrDeliveryRaw` junta estado, motivo y submotivo en una línea.
  - El filtro `maximo` compara con `agrDeliverySnapshot.estadoPedido`.
  - El resumen logístico agrupa por estado de Máximo (`byState`).
- `order-inbox.tsx`:
  - Se quitan `getAgrStatusLabel`, `getAgrReasonLabel` y las reglas de
    traducción.
  - `AgrDeliveryPanel` recorre `fields`.
- `order-scope-filters.tsx`: el selector «Estado en Máximo» usa las
  opciones de `byState`.
- `get-my-day.ts` y `sales-recovery-fall.ts` usan `describeAgrDeliveryRaw`.
- `getAgrAction` queda solo para `getPriority`.
