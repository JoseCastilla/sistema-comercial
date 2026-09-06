# SPEC-047 — Tareas

## Fase 1 — Eje de resultado (RD-01, RD-04)

- [x] BR-001 · Métricas con entregadas por operación; tarjeta hero de
      entregadas con pie y enlace a Pedidos (06/09/2026).
- [x] BR-001/AC-007 · Pedidos `DELIVERED` con la definición de Rendimiento.
- [x] BR-002 · Ingresadas como tarjeta secundaria.
- [x] BR-003 · Comparación de entregadas con maduración equivalente y
      cohorte madura en el pie.
- [x] BR-004 · Orden `ENTREGADAS` por defecto; columna «Entregadas» en
      equipos y asesores.
- [x] BR-005 · Filtro `SIN_ENTREGAS`.
- [x] BR-006 · Nota de fecha en cada bloque; prueba del cruce de meses.
- [x] Pruebas, tipos y lint en verde; recorrido local.
- [x] Verificación en producción (06/09/2026).

## Fase 2 — Cumplimiento y resumen visual (RD-02, RD-03)

- [x] BR-007 · Origen y porcentaje de la cuota en todas las celdas
      (06/09/2026).
- [x] BR-008 · Cuatro tarjetas con «Cuota del tramo».
- [x] BR-009 · Tendencia de entregadas por día de entrega registrada.
- [x] BR-010 · Barras de cumplimiento por equipo.
- [x] BR-011 · Avisos prioritarios.
- [x] BR-012 · Accesos al detalle.
- [x] Corrección de paso: en un mes cerrado la ventana de cuota ya no se
      llama «en curso» (`quotaWindow.isActive` exige el mes actual).
- [x] Pruebas, tipos y lint en verde; recorrido local.
- [ ] Verificación en producción.

## Fase 3 — Bloques separados (RD-05)

- [ ] BR-013 · Resultado → Gestión → Económico → Actividad.
- [ ] BR-014 · Pendientes administrativos contraídos.
- [ ] BR-015 · Tabla compacta con `columnas=todas`.
