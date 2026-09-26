# SPEC-070 — Seguimiento de Campañas, control por control

**Estado:** `ENTREGADA` — diez mejoras aprobadas por José; el grupo 5 con 7 días (25/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

Segunda pasada del supervisor, tras Recupero de ventas (SPEC-068) y «Hoy en
mi equipo» (SPEC-069). Se recorrió en producción con la sesión de la
supervisora de Huancayo · El Tambo (solo lectura). José respondió «avanza
con todo en ese orden, el grupo 5 con 7 días» y autorizó ejecutar sin
preguntar las mejoras de presentación que se encuentren.

Lo que se vio: **220 de los 227 clientes de la cartera llevaban más de 7
días sin gestión**, la mayoría desde el 3/9; ese día solo un asesor había
trabajado campaña. La pantalla no lo decía: listaba los 227 en una tabla de
diez columnas que no cabía (1017 px en 680), 100 por página y 10 219 px, con
la fecha interna de la próxima acción («3/9, 10:19») en rojo en todas las
filas. Esos casos tampoco volvían solos a los casos libres: BR-077 de
SPEC-030 solo devuelve lo que nunca se gestionó, y un caso gestionado se
queda con su asesor hasta que alguien decida (BR-030).

## 2. Reglas

### Grupo 1 — Errores

- **BR-001 — Sin fechas internas en rojo.** La tarjeta dice cuánto lleva
  sin tocar («Sin tocar desde el 03/09 · 22 días») y, si hay cita, la cita
  («Cita vencida del 24/09 10:00» en rojo solo si venció).
- **BR-002 — Nada cortado.** Tarjetas en lugar de la tabla.
- **BR-003 — Plurales.** «227 casos».

### Grupo 2 — Por asesor

- **BR-004 — Una línea por asesor**, primero quien más tiene sin tocar:
  «57 de 57 sin tocar hace 7 días o más · 0 con gestión hoy · 2 citas
  vencidas». Un clic filtra su cartera; el resumen mira siempre todo el
  alcance (`summarizeFollowUpByAdvisor`).
- **BR-005 — Una línea de cifras** en lugar de cuatro tarjetas: cartera,
  sin tocar hace 7 días o más, con gestión en el período, citas vencidas
  y, solo si hay, sin primer contacto. Cada cifra abre lo que cuenta.

### Grupo 3 — La tarjeta

- **BR-006 — La tarjeta de la cola**: cuánto lleva sin tocar, cliente con
  teléfono, asesor, «0 de 3 hoy» en gris, la última gestión con su
  observación y «Abrir caso».
- **BR-007 — Lo que sobra**: el DNI en «Ver datos»; sin la columna
  «Estado».

### Grupo 4 — Filtros

- **BR-008 — «Sin tocar desde»** a la vista: sin gestión hoy, 3 días o más,
  7 días o más. Se cuenta desde la última gestión o, sin gestiones, desde
  la asignación (`recoveryDaysUntouched`).
- **BR-009 — «Más filtros».** Tipificación, próxima acción, primer
  contacto, período, gestión en el período y estado, plegados; el tablero
  sigue abriendo Seguimiento con esos parámetros.

### Grupo 5 — Devolver a los casos libres (decisión de José)

- **BR-010 — Devolver lo que lleva 7 días sin gestión.** Desde su línea, el
  supervisor devuelve a los casos libres de su equipo los casos de un
  asesor que llevan 7 días o más sin gestión, sin cita pendiente y fuera de
  verificación (`isRecoveryCaseStale`). Pide confirmar con cuántos y de
  quién; el servidor vuelve a comprobar cuáles cumplen. Cada caso queda
  `OPEN` en el pool de su equipo, sin responsable, con un evento
  `ASSIGNED_TO_TEAM` que dice quién lo devolvió y a quién se le quitó
  (`LIBERADO_SIN_GESTION`). Nada se devuelve solo: complementa SPEC-030
  BR-030 (la redistribución de casos gestionados es una decisión humana) y
  BR-077 (el retorno automático de lo nunca gestionado).

## 3. Fuera de alcance

- Repartir y el tablero (siguiente pasada).
- Devolver casos de un asesor de otro equipo.

## 4. Criterios de aceptación

- **AC-001** — La supervisora ve, sin filtrar, cuántos casos de cada asesor
  llevan 7 días o más sin tocar.
- **AC-002** — Ninguna tarjeta se corta; en el celular la página no se
  desplaza de lado.
- **AC-003** — Devolver pide confirmar y deja un evento por caso con quién
  lo hizo.
- **AC-004** — Un caso con cita pendiente o en verificación no se devuelve.
