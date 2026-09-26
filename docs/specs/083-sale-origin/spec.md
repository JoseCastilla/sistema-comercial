# SPEC-083 — Origen de la venta

**Estado:** `ENTREGADA` — José: «sí, agrega el campo Origen de la venta» (26/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-26

## 1. Origen

El análisis por rol (`docs/revisiones/2026-09-25-pedidos-por-rol.md`)
mostró que, en septiembre, 189 de las 804 notas de pedidos solo decían de
dónde salió la venta: «BASE», «CAMPAÑA», «CAMPAÑA MASIVO». El sistema no
tenía un campo para eso, así que se usaba la nota. Eso además impedía
contar las ventas por origen.

## 2. Reglas

- **BR-001 — Un dato propio del pedido**: `sale_origin`, con los valores
  Base, Campaña y Otro. Se guarda también quién lo anotó y cuándo
  (`sale_origin_set_by_user_id`, `sale_origin_set_at`).
- **BR-002 — Se anota en un toque**, en el panel del pedido, debajo del
  DNI: «Origen: Base · Campaña · Otro». Queda marcado lo elegido.
- **BR-003 — Quién lo anota:** quien ve el pedido completo, el mismo
  alcance que el seguimiento. Se puede anotar en cualquier estado, porque
  es un dato de la venta y no del seguimiento. Sin ese alcance, el origen
  solo se lee.
- **BR-004 — En la fila** aparece junto a la orden y el operador: «1966… ·
  Claro · Base · Christian R.».
- **BR-005 — Se recupera lo ya escrito.** La migración pone:
  - «Base» en los pedidos cuya nota empieza con BASE;
  - «Campaña» en los que empieza con CAMPAÑA, CAMPANA o CAMAPAÑA.

  La nota no se toca. Esos pedidos quedan sin autor, porque el dato lo puso
  la migración y no una persona.
- **BR-006 — Despliegue en dos pasos**, según SPEC-004 BR-004:
  1. Primero la migración sola (8da5513). La API la aplica al arrancar.
  2. Después el esquema y el código que la usan, para que la web no pida
     una columna que todavía no existe.

## 3. Siguiente

- Contar las ventas por origen en Rendimiento.
- Que la extensión de DITO lo pregunte al registrar la venta.

Ninguno de los dos está hecho.

## 4. Criterios de aceptación

- **AC-001**: un pedido cuya nota era «BASE» aparece con el origen Base
  sin que nadie lo toque.
- **AC-002**: al tocar «Campaña» en el panel, la fila pasa a decir
  «Campaña».
