# SPEC-064 — Tareas

- [x] `spec.md` y `plan.md` con la decisión de José del 24/09/2026.
- [x] «Mi día» ya lee la cuota como mensual de forma provisional (SPEC-063
      BR-019).
- [x] José responde P-01: todas las cuotas cargadas son mensuales (24/09/2026).
- [x] Migración aditiva (`MONTH` en `PerformanceQuotaWindow`) y relleno
      idempotente: la de la primera ventana; si no, la de la segunda.
- [x] `monthlyQuotaWindow` y `getDefaultMonthlyQuotaTarget` (45) con prueba.
- [x] Cuotas sin selector de ventana; la acción guarda siempre `MONTH`.
- [x] Rendimiento con la cuota mensual: tarjeta, resumen por equipo, avance
      por asesor, panel personal y de cumplimiento.
- [x] «Mi día» sobre la regla definitiva.
- [ ] Pantalla de Cuotas recorrida con sesión de administrador o líder.
- [ ] Verificación en producción: la misma cifra en las tres pantallas.
