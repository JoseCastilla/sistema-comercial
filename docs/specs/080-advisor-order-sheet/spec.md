# SPEC-080 — La hoja de pedidos del asesor, en una sola lista

**Estado:** `ENTREGADA` — José: «sí, sigue con la lista única para el asesor» (26/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-26

## 1. Origen

El análisis por rol (`docs/revisiones/2026-09-25-pedidos-por-rol.md`)
mostró que en septiembre un asesor tuvo como máximo 10 pedidos en curso, y
que casi la mitad falló según Máximo. Lo que hace en Pedidos es llamar al
cliente y decir en qué quedó el pedido. Siete pestañas lo obligaban a
buscar algo que una lista ordenada ya puede mostrar.

## 2. Reglas

- **BR-001 — El asesor no tiene pestañas.** Entra a sus ventas del mes
  (`ALL`), en una sola lista, sin páginas (hasta 300). Conserva el período,
  la búsqueda y el plazo.
- **BR-002 — La lista va agrupada por lo que toca**, en este orden
  (`advisor-order-groups.ts`):
  1. **Entrega fallida: llama al cliente.** Máximo reporta un problema con
     un dato vigente, o nuestro estado es No entregado o Rechazado.
  2. **Por entregar.**
  3. **Entregadas, falta activar.** Con la aclaración «Se cierran cuando el
     operador activa la línea».
  4. **Cerradas**, plegado.
  5. **Canceladas**, plegado.

  Dentro de cada grupo se mantiene el orden por urgencia. Los grupos sin
  pedidos no aparecen.
- **BR-003 — En la entrega fallida, el porqué en la fila**: «Máximo:
  CLIENTE AUSENTE · CLIENTE NO CONTESTA LLAMADAS», tal como llega
  (SPEC-075). Se ve con la hoja en una línea y en dos.
- **BR-004 — Selección y pasos en el orden de pantalla.** Al entrar queda
  elegido el primero del primer grupo. «Guarda y pasa al siguiente»
  (SPEC-074) y ↑ ↓ siguen el orden de la lista y saltan las cabeceras de
  grupo.
- **BR-005 — En el celular**, los mismos grupos, con las mismas cabeceras
  y los mismos plegados.
- **Sin cambios para supervisión y administración**: siguen con las
  pestañas de SPEC-074.

## 3. Criterios de aceptación

- **AC-001**: un asesor entra a Pedidos y ve primero sus entregas fallidas,
  con el motivo de Máximo, sin elegir ninguna pestaña.
- **AC-002**: lo cerrado y lo cancelado no ocupan lugar hasta que se pide
  «Ver».
