# SPEC-074 — Plan (fase 1)

- **Servidor**:
  - `get-order-inbox.ts`:
    - Vistas nuevas `TO_MOVE` y `DONE`.
    - `tabCounts`: la cifra de cada pestaña en el período.
    - Nombre corto del asesor en `advisorOptions`.
  - `page.tsx`: `TO_MOVE` es la vista por defecto.
- **`order-next-step.tsx`**:
  - `getOrderSteps` da los pasos según el estado.
  - `OrderNextStep` llama a `updateOrderStatusAction` con la nota.
- **`order-inbox.tsx`**:
  - Pestañas con cifra y `visibleFilterOptions`.
  - Resumen sin avisos.
  - Panel con «¿En qué va?» y «Otro cambio».
  - Fila con teclado y sin copiar al elegir.
  - `selectNextAfter` pasa al pedido de abajo.
- **`order-realtime-status.tsx`**: prop `updatedAt`.
