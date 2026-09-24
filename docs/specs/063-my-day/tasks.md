# SPEC-063 — Tareas

Una casilla se marca solo con evidencia en `verification.md`.

## Definición

- [x] `spec.md` con el problema contra el código, BR-001 a BR-017, decisiones
      D-01 a D-05 y AC-001 a AC-011 (24/09/2026).
- [x] `plan.md`: reunir sin recalcular, una sola regla nueva de ubicación,
      fases 0 a 5.
- [ ] José confirma o corrige D-01 a D-05.

## Fase 0 — Regla de ubicación

- [x] `@repo/validation/my-day.ts`: tramos, «ahora» y «más tarde hoy»,
      orden, plazo en palabras; 11 pruebas con fechas fijas en Lima.

## Fase 1 — Lectura

- [x] `getMyDay`: cinco fuentes con techo, solo lo propio, cita manda.
- [x] Pantalla `/my-day` con progreso, «Cómo se calcula», «Ahora» por
      tramos, «Más tarde hoy» plegado, lista vacía y lectura cada minuto.
- [x] Entrada del asesor en `/my-day` (inicio y login) y «Mi día» primero en
      su menú lateral y móvil.
- [x] Recorrido local con sesión de asesor de prueba: AC-001, AC-003,
      AC-007, AC-011 y la ventana de bono cerrada (24/09/2026).
- [ ] AC-010 (lista vacía) con un asesor sin pendientes.
- [x] AC-005: la comisión y las confirmadas coinciden con `/performance`
      para el mismo asesor (24/09/2026).
- [x] Lectura en producción con la cuenta de asesor tras el despliegue.

## Fase 2 — Actuar sin salir

- [ ] Tipificar recupero y campaña desde la fila de «Mi día».
- [ ] «Guardar y siguiente» a lo largo de toda la lista.

## Fase 3 — Avisos

- [ ] BR-013: citas del recupero de ventas en Mi agenda y en el aviso.
- [ ] BR-014: el asesor recibe el aviso de sus recuperos vencidos.

## Fase 4 — Mis ventas del mes

- [ ] Lista de ventas del mes con estado, monto y motivo de no pago.

## Fase 5 — Supervisor vendedor y shadcn/ui

- [ ] «Mi día» en el menú del supervisor vendedor.
- [ ] Piezas shadcn/ui sobre los tokens, con el lockfile limpio.
