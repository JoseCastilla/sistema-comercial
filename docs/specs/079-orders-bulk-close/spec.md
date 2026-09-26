# SPEC-079 — Cerrar varios pedidos a la vez

**Estado:** `ENTREGADA` — José: «sí, avanza con cerrar varios a la vez» (26/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-26

## 1. Origen

El análisis por rol (`docs/revisiones/2026-09-25-pedidos-por-rol.md`)
mostró que en septiembre el 77 % de los 863 cierres (661) los hizo una sola
persona de backoffice, uno por uno. Cada cierre pedía elegir el pedido,
abrir un selector, elegir «Cerrado» y guardar. Cerrar significa que el
operador ya activó la línea (SPEC-012).

## 2. Reglas

- **BR-001 — Solo en «Falta activar».** Cada pedido entregado sin cerrar
  lleva una casilla, pero solo quien puede cerrar ese pedido
  (`canClose`) puede marcarla. Por ejemplo, un supervisor no cierra su
  propia venta (SPEC-012): la casilla aparece desactivada.
- **BR-002 — La barra «Cerrar varios»** tiene:
  - «Marca los que el operador ya activó», o «N pedidos marcados».
  - «Marcar los N de esta página».
  - «Desmarcar».
  - El botón «Cerrar: ya activaron (N)».
- **BR-003 — Se confirma con la cifra**: «¿Cerrar N pedidos? No se puede
  deshacer», con los botones «Sí, cerrar N pedidos» y «Volver». Cerrar es
  definitivo.
- **BR-004 — La misma regla que el cierre de uno.** Cada pedido pasa por
  `applyOrderStatusChange`: alcance, permiso, historial, quién cerró y
  cierre del caso de recupero. Esa lógica ahora vive en
  `order-status-change.ts` y la comparten el cambio uno por uno y el
  cierre en bloque. La nota de cada pedido se conserva.
- **BR-005 — Un pedido que falla no detiene a los demás.**
  - Cada cierre va en su propia transacción.
  - La respuesta dice «Se cerraron N pedidos. M no se cerraron.» y, debajo,
    cada código con su motivo.
- **BR-006 — Límites:**
  - Hasta 100 pedidos por vez: una página tiene 50.
  - Los identificadores repetidos cuentan una sola vez.
  - Solo en escritorio.

## 3. Criterios de aceptación

- **AC-001**: cerrar 30 pedidos cuesta marcarlos (o «Marcar los 30»),
  cerrar y confirmar; ya no son 30 formularios.
- **AC-002**: cada pedido cerrado en bloque queda en el historial con quién
  y cuándo, igual que al cerrar uno.
- **AC-003**: si un pedido ya estaba cerrado o lo cambió otra persona, los
  demás se cierran y ese aparece con su motivo.
