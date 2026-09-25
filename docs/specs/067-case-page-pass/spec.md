# SPEC-067 — Ficha del caso, control por control

**Estado:** `ENTREGADA` — quince mejoras aprobadas por José (25/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

Cuarta pasada control por control, tras «Mi día» (SPEC-063 fase 6), la cola
de Campañas (SPEC-065) y Mi agenda (SPEC-066). Se recorrieron en producción,
con la sesión de una asesora y solo lectura, la ficha de un caso de Campañas
y la de una venta caída. José respondió «avanza con todo en ese orden».

Lo que se vio: las dos fichas tenían diseños distintos y en ninguna la
acción principal estaba a la vista. En el celular, el formulario de la
ficha de Campañas empezaba a 1875 px de una página de 2909. La ficha de
Campañas decía en rojo «Ya puede portar · habilitación de portabilidad» y
«Próxima acción: 9/9, 12:40», mientras la cola y «Mi día» decían «desde el
12/09 · Ya puede portar: llámalo». El registro era el formulario viejo de
cuatro campos con el teléfono vacío; en la venta caída, su recuadro lo
recortaba. «Resolver el caso» llegaba marcado en «Recuperado», con un aviso
amarillo y el botón deshabilitado.

## 2. Reglas

### Grupo 1 — Errores

- **BR-001 — El mismo plazo y la misma frase que «Mi día».** Campañas usa
  `describeCampaignWorkDue` y `campaignWorkActions`; la venta caída,
  `describeSalesRecoveryWork` (nueva, compartida con «Mi día»). Sin «Próxima
  acción» en rojo.
- **BR-002 — Nada recortado.** El registro ya no vive en el recuadro que lo
  cortaba.
- **BR-003 — Por qué se cayó, como en «Mi día».** La venta caída muestra la
  acción que sugiere la logística o el motivo (`describeSalesRecoveryFall`,
  compartida con «Mi día»).
- **BR-004 — Volver a donde se estaba.** Desde «Mi día» (`from=mi-dia`) se
  vuelve a «Mi día», a la fila del caso; si no, a la cola o a Recupero de
  ventas.
- **BR-005 — Cerrar sin nada elegido.** Ver BR-015.
- **BR-006 — Sin horas inventadas.** «Puede portar desde el 12/09», sin
  «00:00».

### Grupo 2 — La parte de arriba

- **BR-007 — El teléfono junto a lo que hay que hacer.** Un toque llama en
  el celular; un clic lo copia en la computadora.
- **BR-008 — «Registrar gestión» arriba, abierto.** El editor de botones de
  «Mi día», la cola y la agenda, con el teléfono ya elegido. Si el asesor lo
  cierra, queda cerrado. Al guardar, la ficha se vuelve a leer.
- **BR-009 — La regla de los 7 días en una línea.** «Lleva 7 días contigo:
  ciérralo o agenda una fecha; si no, pasa a tu supervisor.»
- **BR-010 — Venta caída sin tarjetas de cifras.** El plazo, «Venta del
  24/09 · pedido …» con enlace y el motivo.
- **BR-011 — La regla del plazo plegada y en palabras simples.**

### Grupo 3 — Datos de consulta

- **BR-012 — «Datos del cliente» plegado.** Identidad (DNI, padres,
  nacimiento), teléfonos, dónde entregar y líneas. El mapa, a un clic
  («Ver en el mapa» o «Mostrar el mapa aquí»).
- **BR-013 — Historial de gestiones como lista.** Resultado · canal ·
  fecha · quién · teléfono, y la observación entre comillas. Plurales de
  verdad.
- **BR-014 — Encabezados sin jerga.** «Campaña · {equipo}» y «Venta caída»;
  sin el subtítulo de la venta caída.

### Grupo 4 — Cerrar el caso

- **BR-015 — «Cómo termina» sin opción marcada.** El aviso de cada opción
  aparece al elegirla; «Perdido» pide elegir el motivo; el botón se
  habilita cuando hay lo necesario. Sin «orden DITO».

## 3. Fuera de alcance

- Las pantallas de supervisor (Seguimiento, verificación).
- `RegisterAttemptForm` se retira: ya no lo usa ninguna pantalla.

## 4. Criterios de aceptación

- **AC-001** — Un mismo caso dice el mismo plazo y la misma frase en «Mi
  día», la cola y su ficha.
- **AC-002** — Al abrir la ficha, el editor de botones está a la vista con
  el teléfono elegido, en la computadora y en el celular.
- **AC-003** — Desde «Mi día», «Volver» regresa a «Mi día».
- **AC-004** — «Cerrar el caso» no llega con nada elegido.
