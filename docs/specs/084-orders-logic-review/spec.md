# SPEC-084 — Revisión de la lógica de Pedidos

**Estado:** `ENTREGADA` — José: «analiza la lógica de trabajo, corrige en caso sea necesario» (26/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-26

## 1. Método

Se contrastó cada cifra de Pedidos con la lista que abre, sobre los 1417
pedidos de septiembre en producción (sesión de administrador, solo
lectura). Se clasificó cada pedido en las vistas para ver si caía en una,
en ninguna o en varias. En paralelo, un agente revisó el código.

## 2. Hallazgos y correcciones

| # | Qué pasaba | Evidencia | Corrección |
|---|---|---|---|
| H1 | 24 pedidos no aparecían en ninguna vista | 23 cerrados con problema en Máximo (Cerrados los excluía por Máximo; Entregas fallidas, por estar cerrados) y 1 enviado con entrega rechazada, cuyo estado de entrega era «cancelado» | «Cerrados» incluye a todo cerrado; solo el cancelado con problema en Máximo va a Entregas fallidas. «Por entregar» ya no excluye la entrega cancelada mientras el pedido siga enviado |
| H2 | En «Escaladas», el resumen decía «Ventas 2785» | Esa vista no usa período, y el resumen contaba toda la historia | El resumen siempre cuenta el período elegido |
| H3 | «51 pendientes de meses anteriores» abría 65 | Contaba abiertos y enviados (incluso entregados) y abría el histórico entero, que también tiene este mes | Dos cifras, «N por entregar →» y «M por activar →», cada una con la regla de su vista, en un rango que termina el día antes de este mes |
| H4 | «Cerrar: ya activó» cerraba con un solo toque | Cerrar no se deshace, y en bloque sí se pedía confirmar | Pide un segundo toque («Sí, cerrar: no se puede deshacer» o «Volver»), igual que en bloque |

## 3. Criterios de aceptación

- **AC-001**: la suma de «Por entregar», «Falta activar», «Cerrados» y las
  entregas fallidas del mes es igual a «Todos».
- **AC-002**: cada cifra de meses anteriores abre una lista con esa misma
  cantidad.
- **AC-003**: en «Escaladas», «Ventas» es la cifra del período.
