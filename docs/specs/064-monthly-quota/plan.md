# SPEC-064 — Plan

1. **Modelo.** Migración aditiva: `PerformanceQuota.window` pasa a admitir
   `MONTH` (o se vuelve opcional), con índice único por período y
   destinatario para `MONTH`. Relleno idempotente según la respuesta a P-01.
2. **Regla pura.** `getMonthlyQuotaProgress(metrics, target)` en
   `@repo/validation`: entregadas del mes frente a la cuota.
3. **Cuotas.** Sin selector de ventana; el reparto y sus avisos sobre la
   cifra mensual.
4. **Rendimiento.** Tarjeta, resumen por equipo y avance por asesor leen la
   cuota mensual; el tramo de bono se sigue mostrando aparte.
5. **«Mi día».** Deja la lectura provisional de SPEC-063 BR-019 y usa la
   misma regla.
