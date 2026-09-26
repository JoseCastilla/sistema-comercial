# SPEC-075 — Lo que manda Máximo, tal cual

**Estado:** `VERIFICADA` — decisión de José del 25/09/2026

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

José: «actualmente estamos interpretando el mensaje que llega de máximo, mi
equipo me dice que estamos dejando información sin aprovechar. Por ahora
usemos la información original que manda máximo sin interpretarlo nosotros
mismos».

Hasta ahora (SPEC-029, SPEC-041):

- el estado y el motivo se traducían a frases propias («El operador no pudo
  entregar», «El cliente no estaba cuando llegó el courier»);
- se calculaba una acción (`getAgrAction`: Reagendar, Contactar,
  Reingresar…) que se mostraba en la fila, en el panel, en Mi día y en
  Recupero;
- de los 18 campos que manda Máximo se mostraban 5. Quedaban fuera:
  submotivo por separado, estado de gestión, fechas de entrega pactada y
  real, toma del pedido, tipo de delivery, envío, vendedor, quién actualizó
  y cuándo, y cualquier campo nuevo del registro (`rawPayload`).

## 2. Reglas

- **BR-001 — El panel muestra todo lo que manda Máximo con valor.**
  - El valor va tal como llega.
  - Los nombres son los de la fuente, solo con tilde y mayúscula inicial.
  - Va en el orden de la fuente.
  - Se añade la hora de la consulta.
  - Los campos que Máximo agregue en el futuro también aparecen, con su
    propio nombre.
  - No se muestra `order_id`, el identificador interno.
- **BR-002 — Máximo se ve en cualquier pedido que tenga su dato**, no solo
  en las entregas fallidas. Sin problema de entrega (por ejemplo,
  AGENDADO), el recuadro va en gris, no en ámbar.
- **BR-003 — Fila:** la columna «Acción» pasa a llamarse «Máximo» y muestra
  su estado tal cual. En la fila de dos líneas dice «Máximo: <estado>».
- **BR-004 — Entregas fallidas:**
  - Las cifras son los estados de Máximo con su texto («CANCELADO 100 ·
    RECHAZADO 60 · …»), en lugar de coordinar, contactar y reingresar.
  - El filtro «Acción» pasa a llamarse «Estado en Máximo».
  - Parámetro: `maximo=<estado>`, que reemplaza a `accion`.
- **BR-005 — Mi día y Recupero** dicen «Máximo: <estado> · <motivo> ·
  <submotivo>», sin traducir.
- **BR-007 — Qué no se muestra** (José, 25/09/2026, sobre el panel en
  producción, 22 campos):
  - **No sirven para gestionar:** fechas de entrega pactada, de entrega real
    y de toma del pedido; vendedor y nombre del vendedor; monto a cobrar y
    monto facturado; región y zonal.
  - **Ya los dice la ficha:** nombre y teléfono del cliente; departamento,
    provincia y distrito; tipo de delivery; entidad (somos nosotros).
  - **El teléfono del receptor** solo aparece si es distinto del teléfono
    del cliente.
  - **Quedan:**
    - estado, motivo y submotivo;
    - estado de gestión, resultado y próxima acción;
    - fecha de compromiso;
    - quién actualizó y cuándo;
    - pedido y envío en Máximo, como referencia para reclamar.
  - Los campos nuevos siguen apareciendo solos.
  - La lista vive en `features/orders/agr-delivery-fields.ts` y se prueba
    en `campos-maximo.test.ts`.
- **BR-008 — El dato viejo no se presenta como actual.** Máximo deja de
  consultarse cuando el pedido se cierra o se entrega (SPEC-029). En
  producción, 267 pedidos cerrados seguían diciendo «AGENDADO». Ahora la
  fila no muestra el estado de Máximo en esos pedidos, y el panel dice
  «Último dato de Máximo · del <fecha>. Ya no se consulta».
- **BR-006 — Sin cambios por ahora:**
  - Qué pedidos cuentan como entrega fallida (SPEC-029 BR-017).
  - El orden de la bandeja, que todavía usa la acción calculada por dentro
    (`getPriority`) y no la muestra. **Pendiente de José:** si el orden
    también debe dejar de usarla.

## 3. Criterios de aceptación

- **AC-001**: en el panel no queda ninguna frase propia sobre Máximo; cada
  valor coincide con lo guardado en `rawPayload`.
- **AC-002**: un campo nuevo en `rawPayload` aparece sin tocar código.
- **AC-003**: las cifras de Entregas fallidas suman el total «Por revisar».
