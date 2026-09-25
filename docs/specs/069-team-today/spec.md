# SPEC-069 — Hoy en mi equipo

**Estado:** `BORRADOR` — propuesta para que José la revise (25/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

Al recorrer las pantallas de la supervisora de Huancayo · El Tambo
(25/09/2026) se vio que el supervisor **no tiene su «Mi día»**. Entra a
Pedidos, un tablero de 394 ventas del mes, y para saber qué asesor va
atrasado tiene que cruzar tres pantallas: Recupero de ventas, Seguimiento y
Tablero de Campañas. Ese día:

- Recupero de ventas: 21 ventas caídas calientes y **ninguna llamada**, en
  los cinco asesores (SPEC-068).
- Campañas: 227 clientes en cartera, 7 citas vencidas, 4 con gestión hoy y
  0 % de cobertura (0 de 217 con sus 3 intentos del día).
- Pedidos: 171 entregas fallidas por gestionar y 13 fuera de plazo.

Cada cifra existe, pero en pantallas distintas, sin decir de quién es, y
mezclando lo caliente con lo antiguo. José eligió escribir esta pantalla
como spec antes de construirla.

## 2. Objetivo

Una pantalla que responda, al abrir el sistema: **¿quién de mi equipo
necesita que yo haga algo hoy, y qué?**

## 3. Reglas

- **BR-001 — Es la entrada del supervisor.** «Hoy en mi equipo» es el primer
  ítem del menú del supervisor y la página a la que entra (hoy entra a
  Pedidos, que sigue en el menú). *Supuesto; ver P-01.*
- **BR-002 — Se arma con el «Mi día» de cada asesor.** Lo que cuenta de un
  asesor sale de `getMyDay` de ese asesor, sin reglas propias: un caso dice
  lo mismo en «Mi día», en la cola y aquí. Esto incluye lo caliente y lo
  antiguo (SPEC-063 BR-018), las citas, los pedidos que lo necesitan, la
  campaña y el avance del mes.
- **BR-003 — Arriba, el equipo en una línea.** «21 calientes sin llamar · 7
  citas vencidas · 13 pedidos que necesitan acción · cuota del equipo 180 de
  400», por ejemplo. Solo cifras de hoy y calientes; lo antiguo no hace
  ruido.
- **BR-004 — Una tarjeta por asesor, ordenada por lo que se pierde.**
  Primero quien tiene ventas calientes sin llamar vencidas, después citas
  vencidas, después pedidos, después campaña. Cada tarjeta dice:
  - **Ahora:** ventas caídas calientes sin llamar (y cuántas vencidas),
    citas vencidas y pedidos que lo necesitan; son los tramos «Ahora» de su
    «Mi día».
  - **Campaña:** casos por trabajar hoy y cuántos tienen sus 3 intentos.
  - **Hoy hizo:** gestiones registradas y ventas ingresadas hoy, y a qué
    hora fue su última gestión.
  - **Mes:** cuota («32 de 60 entregadas»), la misma de Rendimiento
    (SPEC-064).
  - **Antiguas:** una cifra en gris, sin color.
- **BR-005 — Cada cifra abre lo que cuenta.** Ventas caídas → Recupero de
  ventas filtrado por el asesor; citas → Seguimiento del asesor con agenda
  vencida; campaña → Seguimiento del asesor; pedidos → Pedidos filtrados por
  el asesor.
- **BR-006 — «Ver su día».** Desde la tarjeta, el supervisor abre el «Mi
  día» del asesor tal como lo ve él, en solo lectura: la misma lista, sin
  editor. Sirve para acompañar al asesor sin preguntarle qué tiene
  pendiente. *Supuesto; ver P-02.*
- **BR-007 — Sin gestiones no es ausencia.** «Sin gestiones hoy» se dice
  como un hecho y en gris hasta las 11:00; después, en ámbar. La pantalla
  no marca a nadie como ausente.
- **BR-008 — Se actualiza sola** cada 60 segundos y al volver a la
  pestaña, como «Mi día».
- **BR-009 — En el celular, tarjetas una debajo de otra**, sin
  desplazamiento lateral.
- **BR-010 — Alcance.** Los asesores activos con venta habilitada de los
  equipos que el supervisor supervisa. El supervisor que vende no se
  cuenta a sí mismo aquí: lo suyo está en su «Mi día».

## 4. Fases

- **Fase 1 — Lectura.** BR-001 a BR-005 y BR-007 a BR-010.
- **Fase 2 — «Ver su día».** BR-006.
- **Fase 3 — Actuar desde aquí** (fuera de este borrador): reasignar en
  bloque las ventas calientes sin llamar de un asesor a otro, por ejemplo
  cuando falta. Solo si José la pide después de usar la fase 1. *Ver P-03.*

## 5. Preguntas para José

- **P-01 — ¿Reemplaza a Pedidos como entrada del supervisor?**
  Recomendación: sí. Pedidos sigue en el menú, un clic abajo.
- **P-02 — ¿El supervisor puede ver el «Mi día» de cada asesor en solo
  lectura?** Recomendación: sí; es la forma más corta de acompañar sin
  interrumpir.
- **P-03 — ¿Reasignar en bloque desde aquí?** Recomendación: después de
  usar la fase 1; la reasignación caso por caso ya está en Recupero de
  ventas (SPEC-068).
- **P-04 — El supervisor que también vende, ¿entra a su «Mi día» o a «Hoy
  en mi equipo»?** Recomendación: a «Hoy en mi equipo», con «Mi día» como
  segundo ítem del menú.

## 6. Fuera de alcance

- El administrador: tiene su propio resumen de pendientes.
- Comisiones individuales en esta pantalla: siguen en Rendimiento.
- Mensajes o avisos al asesor desde aquí.

## 7. Criterios de aceptación

- **AC-001** — Con los datos del 25/09/2026, la supervisora ve en la
  primera pantalla que sus cinco asesores tienen ventas calientes sin
  llamar, y cuántas cada uno.
- **AC-002** — La cifra de un asesor coincide con lo que muestra su «Mi
  día» y con su línea en Recupero de ventas.
- **AC-003** — Cada cifra abre la lista que la explica, filtrada por el
  asesor.
- **AC-004** — En el celular la página no se desplaza de lado.
- **AC-005** — Con 10 asesores, la página carga en menos de 2 segundos.
