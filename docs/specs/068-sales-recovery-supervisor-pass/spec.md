# SPEC-068 — Recupero de ventas del supervisor, control por control

**Estado:** `VERIFICADA` — dieciséis mejoras aprobadas por José, verificadas en producción (25/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

Primera pasada control por control de las pantallas del supervisor. Se
recorrió en producción con la sesión de la supervisora de Huancayo · El
Tambo (solo lectura). José respondió «avanza con todo en ese orden».

Lo que se vio: 97 ventas caídas abiertas en una tabla de ocho columnas
que no cabía (916 px en 741) y medía 19 070 px. 83 decían «Primer contacto
vencido», todas en ámbar, mezclando lo caliente con lo antiguo. El
recorrido estimó 42 calientes contando por el día en que la venta se cayó;
con la regla del sistema (el día de la venta, SPEC-063 BR-018) son 21, y
**ninguna tenía una llamada**, en los cinco asesores. La pantalla no dejaba
verlo. El aviso decía «96 recuperos
vencidos», contando también lo antiguo, mientras para el asesor lo antiguo
ya no hace ruido (SPEC-063 BR-014, BR-018).

## 2. Reglas

### Grupo 1 — Errores

- **BR-001 — Lo antiguo no hace ruido.** Caliente es una venta de los
  últimos 7 días (`isMyDayHotSale`). Lo antiguo no se pinta ni cuenta en
  las cifras de arriba ni en el aviso.
- **BR-002 — El plazo con la regla de «Mi día».** `describeSalesRecoveryWork`
  (SPEC-067); sin fechas viejas presentadas como próxima acción.
- **BR-003 — Nada cortado.** Tarjetas en lugar de la tabla.
- **BR-004 — Lo antiguo, paginado aparte.** Las calientes completas
  arriba; las antiguas paginadas dentro de su bloque plegado.
- **BR-005 — Plurales y fechas.** «casos», «08/09 12:40».

### Grupo 2 — Por asesor

- **BR-006 — Una línea por asesor** (solo para quien reparte): calientes
  sin llamar de calientes, seguimientos vencidos y antiguas; primero quien
  más calientes tiene sin llamar; un clic filtra sus casos.
- **BR-007 — Tres cifras.** Calientes sin llamar, seguimientos vencidos
  (calientes) y recuperadas este mes. «Críticas sin asignar» solo si hay.
- **BR-008 — El aviso cuenta lo caliente.** «N ventas calientes vencidas»
  (primer contacto, seguimiento o cita vencidos en ventas de los últimos 7
  días); lo mismo en el resumen del administrador.

### Grupo 3 — La tarjeta

- **BR-009 — La tarjeta de «Mi día».** Plazo (solo en lo caliente), venta
  y pedido, cliente con teléfono, qué hacer, por qué se cayó
  (`describeSalesRecoveryFall`), última gestión y responsable.
- **BR-010 — Prioridad solo si es crítica.**
- **BR-011 — Sin «Estado».** La última gestión ya lo dice.
- **BR-012 — El vendedor solo si no es quien la tiene.**
- **BR-013 — «Reasignar» a la vista**, como acción secundaria que abre su
  formulario en la tarjeta.

### Grupo 4 — Encabezado y filtros

- **BR-014 — Sin subtítulo; «Cómo funciona» plegado** y en palabras simples.
- **BR-015 — «Más filtros».** A la vista, la búsqueda y el asesor (y el
  equipo para el administrador); vista, prioridad, motivo, estado y
  vencimiento plegados, abiertos si alguno está en uso. La barra compartida
  gana la opción `moreFilters`.
- **BR-016 — «Ventas antiguas por recuperar (N)» plegado al final.**

## 3. Fuera de alcance

- «Hoy en mi equipo» como pantalla de entrada del supervisor (propuesta
  aparte).
- Reasignar varios casos a la vez.

## 4. Criterios de aceptación

- **AC-001** — La supervisora ve cuántas calientes tiene cada asesor sin
  llamar sin desplazarse ni filtrar.
- **AC-002** — Lo antiguo no aparece en ámbar ni en las cifras de arriba ni
  en el aviso.
- **AC-003** — Ninguna tarjeta se corta; en el celular la página no se
  desplaza de lado.
- **AC-004** — Registrar gestión y reasignar siguen funcionando desde la
  tarjeta.
