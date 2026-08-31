# Verificación — SPEC-034

## Automatizada — 30/08/2026

- [x] `pnpm run check-types` y `pnpm run lint` en `apps/web` sin errores.

## Visual — sesión ADMIN local, 30/08/2026

- [x] **AC-001:** el selector "Asesor" lista los 14 vendedores activos del
      alcance. Al elegir a Angieska De Los Rios, el encabezado de alcance pasa
      a nombrarla.
- [x] **AC-003:** los nombres de la tabla y de la matriz son enlaces con la
      forma `/performance?month=2026-08&agent=<id>`, conservando mes y equipo.
- [x] **AC-007:** con el filtro aplicado, los KPIs muestran 30 ingresadas, 23
      entregadas y 22 pagables, que coinciden exactamente con la fila de esa
      asesora en la tabla sin filtrar (30 / 76.7 % / 22).
- [x] La lectura queda aislada: la tabla y la matriz muestran una sola fila, y
      la cobertura de vendedores desaparece por carecer de sentido para una
      persona.
- [x] **Coherencia entre superficies:** la conciliación filtrada por la misma
      asesora reporta 22 pagables y S/ 537.50, idéntico a la columna
      "Estimado" de su fila en el dashboard.
- [x] La conciliación conserva el asesor al cambiar de resultado o de página,
      y "Volver a rendimiento" regresa al dashboard filtrado.

## Pendiente

- **AC-004, AC-005 y AC-006** requieren sesiones AGENT, SUPERVISOR y
  BACKOFFICE. La redacción por rol está implementada en el servidor
  (`showTotals`, `showLineAmounts`) y el alcance se aplica en el `where` base,
  pero falta la comprobación visual con cada sesión.
