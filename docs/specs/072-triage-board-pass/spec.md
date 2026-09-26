# SPEC-072 — Revisar y Tablero, control por control

**Estado:** `ENTREGADA` — mejoras de presentación, con la autorización de José del 25/09/2026

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

Cuarta pasada del supervisor (José: «sigue con Revisar y Tablero»). Solo
presentación: ninguna regla de revisión, reparto ni cálculo cambia.

Lo que se vio con la sesión de la supervisora: Revisar abría «Revisar mi
bloque» con 0 casos por verificar y el menú lo anunciaba como «Clientes
nuevos por contactar»; cuatro tarjetas repetían las tres pestañas; un
párrafo fijo de atajos de teclado; «caso(s)». El Tablero no decía que 223
de 227 casos llevaban más de 7 días sin tocar; su tabla por asesor
desbordaba (914 px en 717) con una columna «Equipo» que repetía el mismo
nombre; «Cómo se calcula» ocupaba un bloque fijo; y la conversión dibujaba
una tabla vacía.

## 2. Reglas de presentación

### Revisar

- **BR-001 — Las vistas llevan su cifra** («Verificados por entregar 0 ·
  Falta consultar 0 · Con pedido en curso 6»), sin tarjetas ni subtítulo;
  al lado, «66 disponibles para asignar en Repartir →».
- **BR-002 — Sin nada que revisar, el siguiente paso**: Repartir y
  Seguimiento.
- **BR-003 — Filtros**: búsqueda y lote a la vista; departamento, plan y
  antigüedad en «Más filtros».
- **BR-004 — Atajos de teclado plegados** y «N de M marcados». La tabla se
  conserva: su manejo con teclado (copiar DNI y líneas) es a propósito.
- **BR-005 — El menú dice lo que hay**: «Revisar, repartir y seguir la
  base» para supervisión y administración.

### Tablero

- **BR-006 — «Sin tocar hace 7 días o más»** en la cartera, la misma cifra
  de Seguimiento (`recoveryDaysUntouched`, SPEC-070), que abre esos casos.
- **BR-007 — «Equipo» solo con varios equipos**: la tabla por asesor cabe.
- **BR-008 — «Cómo se calcula» plegado**; sin subtítulo; sin el botón a
  Seguimiento (ya está en las pestañas y cada cifra lleva allí).
- **BR-009 — Sin cargas, una línea** en lugar de una tabla vacía.
- **BR-010 — Fechas y plurales** como en el resto.
