# SPEC-066 — Mi agenda, control por control

**Estado:** `ENTREGADA` — quince mejoras aprobadas por José (25/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

Tercera pasada control por control (tras «Mi día», SPEC-063 fase 6, y la
cola de Campañas, SPEC-065). Se recorrió en producción con la sesión de una
asesora (solo lectura). José respondió «avanza con todo en ese orden».

Lo que se vio: la asesora no tenía ninguna llamada acordada en todo
setiembre y, aun así, «Mi agenda» medía 3800 px en la computadora y 4400 px
en el celular. Repetía los 26 casos de la cola como «Tareas del día sin hora
acordada», todos en rojo «Vencida», y debajo dibujaba una semana vacía de
08:00 a 20:00. Las cifras decían «Tareas en el período 1» y «1 elemento(s)»
sobre 26 filas; «Lista» decía «Nada en este período» debajo de ellas; las
habilitaciones aparecían «a las 00:00»; en el celular las tablas medían 695
px en 339. El panel de una cita registraba el resultado con el formulario
viejo de listas desplegables.

## 2. Reglas

### Grupo 1 — Errores

- **BR-001 — Una cifra, una población.** La línea de cifras cuenta las
  mismas citas que se ven.
- **BR-002 — Ninguna vista contradice a otra.** Sin tareas en la agenda, no
  hay una lista de 26 arriba y «Nada en este período» abajo.
- **BR-003 — Sin horas inventadas.** Lo que no tiene hora no aparece a las
  00:00 (las habilitaciones salen de la agenda).
- **BR-004 — Cabe en el celular.** Sin tablas anchas: tarjetas.
- **BR-005 — Se atiende con el editor de siempre.** Registrar el resultado
  de una cita usa el editor de botones de «Mi día» y la cola.

### Grupo 2 — Qué muestra

- **BR-006 — Solo llamadas acordadas.** Citas de la base de campaña y de
  ventas caídas del asesor (SPEC-063 BR-013). Reintentos, seguimientos,
  habilitaciones, ventas por completar y verificaciones viven en la cola y
  en «Mi día».
- **BR-007 — El rojo es la cita que el asesor dejó vencer.** Mismo plazo y
  tono que «Mi día» y la cola (`describeCampaignWorkDue`): «venció hace 2 h»
  en rojo, «en 40 min» en ámbar, «a las 17:00» en neutro.
- **BR-008 — Sin citas, una línea.** Dice cómo se agenda; no se dibuja una
  cuadrícula vacía.

### Grupo 3 — La cita

- **BR-009 — La tarjeta de «Mi día».** Hora y plazo, cliente con teléfono a
  la vista, lo acordado («Acordado: «…»») y la última gestión. «Registrar
  gestión» abre el editor en la tarjeta, con «Guardar y siguiente» entre las
  citas pendientes; «Reprogramar», «Cancelar cita» e «Historial» son
  acciones secundarias que se abren de a una. `cita=<id>` (desde la ficha
  del caso) lleva al día de esa cita y abre su historial.
- **BR-010 — Sin «Oportunidad: de hace N días».** Una venta caída dice de
  qué venta viene («Venta caída · venta del 18/09»).

### Grupo 4 — Encabezado, navegación y filtros

- **BR-011 — Una línea de cifras.** Sin subtítulo ni tarjetas: «2 llamadas
  acordadas en estos 14 días · 1 vencida».
- **BR-012 — Dos vistas.** «Próximas» (predeterminada): catorce días desde
  la fecha, agrupados por día («Hoy», «Mañana», «Lunes 28/09»), con las
  vencidas siempre arriba (SPEC-048 BR-014). «Mes»: cuántas citas cae cada
  día; un día abre «Próximas» desde él. Se retiran las cuadrículas de
  semana y día; un enlace viejo con `view=semana|dia|lista` abre «Próximas».
- **BR-013 — Navegar sin pasos de más.** Flechas compactas «‹ Hoy ›» y la
  fecha cambia al elegirla, sin «Ir».
- **BR-014 — Filtros justos.** Búsqueda y estado (pendientes, vencidas,
  atendidas, reprogramadas, canceladas). Sin «Tipo» ni «Antigüedad».
- **BR-015 — Plurales de verdad.** Sin «(s)».

## 3. Fuera de alcance

- La ficha del caso (`/recovery/campaigns/[caseId]`) y la de Recupero de
  ventas siguen usando `RegisterAttemptForm`; es la siguiente pasada.
- Las pantallas de supervisor.

## 4. Criterios de aceptación

- **AC-001** — Un asesor sin citas ve una línea que dice cómo agendar; la
  página no repite la cola.
- **AC-002** — En el celular (375 px) la página no se desplaza de lado.
- **AC-003** — Una cita se atiende con el editor de botones y queda
  «Atendida» en su tarjeta; reprogramar y cancelar siguen funcionando.
- **AC-004** — Las vencidas se ven arriba, con su fecha, desde cualquier
  período.
