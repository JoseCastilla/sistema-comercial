# SPEC-045 — Tareas

## Fase 1 · Correcciones (06/09/2026)

- [x] PL-02 · Filtro «vencido» en validation (2 pruebas); conteo de la alerta
      con la clasificación y el alcance de la bandeja; enlace a
      `vence=vencido`; opción «Cualquier vencimiento» en la bandeja.
- [x] PL-03 · `campaign-stage-labels.ts`; Preparar, Revisar y Repartir con los
      mismos nombres y contadores enlazados; Preparar con las condiciones de
      Revisar (2 pruebas).
- [x] PL-05 · Cabecera del resumen por equipo con cobertura administrativa y
      enlaces; fila enlazada a la tarjeta del equipo.
- [x] PL-06 · «Pedidos que requieren acción» abre `/orders?status=LOGISTICS`.
- [ ] Recorrido local con sesión de administrador.
- [ ] Lectura de solo lectura en producción tras el despliegue.

## Fase 2 · Resumen administrativo y reparto con carga

- [ ] PL-01 · Resumen de pendientes para ADMIN.
- [ ] PL-04 · Vista previa de carga por participante antes de confirmar.

## Fase 3 · Fuente, columnas y actividad

- [ ] PL-07 · Hora de fuente vs pantalla en Logística.
- [ ] PL-08 · Columnas esenciales visibles en el resumen por equipo.
- [ ] PL-09 · «Trabajados» abre Hoy / Ayer / 7 / 30 días.

## Fase 4 · Control administrativo y consultas externas

- [ ] PL-10 · DNI por alcance y origen; historial paginado de cargas DITO.
- [ ] PL-11 · Textos y accesibilidad de consultas externas y reparto.

## Fase 0 · Operación (spec propia, pendiente de abrir)

- [ ] Worker con cron (AGR, vencimientos, reintento de webhooks).
- [ ] Copias de seguridad programadas y ensayadas.
- [ ] Límite de intentos en login y MFA para ADMIN/BACKOFFICE.
