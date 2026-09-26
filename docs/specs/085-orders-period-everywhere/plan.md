# SPEC-085 — Plan

- `get-order-inbox.ts`:
  - `periodFilter` en todas las vistas.
  - Los conteos de logística y escaladas usan `tabWhere`.
  - `advisorScopeWhere` y `logisticsRecords`, con período.
  - `priorPending` con `failed` y `escalated`.
- `order-inbox.tsx`:
  - `PeriodNavigation` sin rama especial.
  - Hora de Máximo en el resumen.
  - La línea de antes, con cuatro cifras.
- `escalation-notification.tsx`: abre el histórico.
