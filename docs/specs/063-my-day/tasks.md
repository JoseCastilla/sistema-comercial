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

## Fase 1.1 — Clientes calientes y cuota del mes (24/09/2026)

- [x] BR-018: ventas de los últimos 7 días en «Ahora», la más reciente
      primero; las más antiguas plegadas en «Ventas antiguas por recuperar»,
      sin rojo ni plazos. 16 pruebas de la regla.
- [x] BR-019: tarjeta «Cuota de setiembre» con las portabilidades
      entregadas del mes frente a la cuota asignada.
- [x] Lectura en producción con la cuenta de asesor (24/09/2026).

## Fase 6 — Pulido control por control (24/09/2026)

- [x] Grupo 1, errores: una sola fila por cliente con el motivo de la caída
      (BR-021); aviso oculto en «Mi día» y debajo de la cabecera en el
      celular (BR-024).
- [x] Grupo 2, filas: teléfono a la vista (BR-022); frases, tonos y tipo
      oculto dentro del grupo (BR-023). Pruebas: `my-day.test.mjs` 18 de
      18, `mi-dia-gestion-en-fila.test.tsx` 3 de 3.
- [ ] Grupo 3, editor: resultados en botones con «Otro resultado», canal en
      botones, teléfono como texto cuando hay uno solo.
- [ ] Grupo 4, progreso: «Ahora» primero, franja compacta, sin subtítulo,
      el próximo bono en vez del cerrado, «Tu comisión» unida, grupos que se
      abren por separado.
- [ ] Lectura en producción de cada grupo.

## Fase 2 — Actuar sin salir

- [x] Tipificar citas, ventas caídas y campaña desde la fila de «Mi día»
      con el editor de Campañas (misma acción, mismo borrador, misma clave
      de idempotencia). Los pedidos siguen llevando a Pedidos.
- [x] «Guardar y siguiente» a lo largo de cada lista, saltando pedidos.
- [x] La lectura cada minuto se pausa mientras hay una gestión abierta.
- [x] Corregido el borrador compartido: tras guardar, «Guardar y siguiente»
      dejaba el cambio en espera en vez de abrir el siguiente caso (también
      en la cola de Campañas, SPEC-049 BR-016).
- [x] Recorrido en producción con la cuenta de asesor (sin guardar), 24/09/2026.

## Fase 3 — Avisos

- [x] BR-013: citas de ventas caídas en Mi agenda (rotuladas «venta
      caída», con teléfono de entrega y fecha de la venta), en el panel de
      la cita (reprogramar y cancelar, enlace a la ficha de recupero) y en
      el aviso de citas.
- [x] BR-014: el asesor recibe el aviso de sus ventas caídas calientes
      vencidas; para el asesor ambos avisos abren «Mi día». Plurales sin
      paréntesis.
- [x] Desplegada (24/09/2026): el aviso de administración ya dice
      «320 recuperos vencidos», sin paréntesis.
- [ ] Lectura en producción con la cuenta de asesor (la pestaña de
      producción pasó a sesión de administrador).

## Fase 4 — Mis ventas del mes

- [x] Regla `classifyMyDaySale` / `summarizeMyDaySales` en
      `@repo/validation` (6 pruebas, incluida la igualdad con la comisión base
      de Rendimiento).
- [x] Bloque «Tus ventas del mes» con resumen por grupo, detalle por venta y
      enlace al pedido (3 pruebas de componente).
- [x] Lectura en producción con la cuenta de asesor (24/09/2026).

## Fase 5 — Supervisor vendedor y shadcn/ui

- [x] «Mi día» en el menú del supervisor vendedor: un solo layout
      compartido (antes siete copias idénticas) sabe si el usuario vende
      (membresía de venta activa, la misma de Rendimiento) y el menú lo
      ofrece a quien vende. 4 pruebas del menú.
- [x] CRM versionado para dejar coherente el lockfile (SPEC-062).
- [x] Base shadcn/ui en `apps/web`: `cn` (`lib/utils.ts`), `Button` con
      `asChild` y variantes sobre tokens (los fondos de color usan su token
      «sobre», no blanco fijo), `Badge` por tono, `components.json`.
- [x] «Mi día» usa `Button` y `Badge` en lugar de clases escritas a mano.
- [ ] Lectura en producción.
