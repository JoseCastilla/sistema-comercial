# SPEC-050 — Tareas

Una casilla se marca solo con evidencia en `verification.md`.

## Definición

- [x] `spec.md` con la revisión de la propuesta contra el código (§2),
      reglas BR-001 a BR-011, decisiones con recomendación (§5) y criterios
      AC-001 a AC-007 (08/09/2026).
- [x] `plan.md`: lo confirmado manda en la fila, un solo estado de bandeja
      en el cliente, la devolución como función pura; cinco fases sin
      migraciones.
- [ ] José confirma o corrige las cinco decisiones de §5.

## Fase 1 — Devoluciones y primer contacto

- [ ] Elemento «Primer contacto» (caso sin intentos) y
      `resolveReturnedFromVerification` sobre `CASE_REOPENED` y
      `PORTABILITY_CROSSED` `WAITING → ASSIGNED`; pruebas de las
      transiciones que no son devolución.
- [ ] Bandeja, ficha y agenda muestran origen, fecha y motivo de la
      devolución y aplican el rango 2.

## Fase 2 — Acciones rápidas y acción principal

- [ ] Tecla P «Tiene pedido» con la pregunta «¿confirmó que le interesa?».
- [ ] Acción principal de la fila según qué toca: registrar gestión,
      vincular orden, revisar cierre, resolver datos inválidos, ver motivo,
      gestionar cita.

## Fase 3 — Actualizar tras guardar

- [ ] La fila aplica lo confirmado (qué toca, vista destino, próxima
      acción, intentos) sin moverse; se atenúa si sale de la vista.
- [ ] Registro de casos movidos en el contexto de la bandeja; carril con
      cantidades ajustadas en el cliente; refresco único cuando no queda
      gestión abierta; pruebas de componente.

## Fase 4 — Filtros, cabecera y columnas

- [ ] Filtro por tarea operativa con cantidades y «N de M en esta vista».
- [ ] Cabecera sin cifras de vistas; «Tomar casos libres» compacto;
      columnas reordenadas; sin desplazamiento horizontal a 1280 px.

## Fase 5 — Recorridos (José)

- [ ] Lista de `verification.md` con cuentas de prueba ficticias.
