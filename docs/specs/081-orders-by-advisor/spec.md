# SPEC-081 — Pedidos: el equipo por asesor

**Estado:** `VERIFICADA` — José: «sigue con el equipo por asesor para supervisión» (26/09/2026)

**Versión:** 0.1
**Fecha:** 2026-09-26

## 1. Origen

El análisis por rol (`docs/revisiones/2026-09-25-pedidos-por-rol.md`)
mostró que la supervisión mira primero a su equipo: quién tiene entregas
fallidas o fuera de plazo, y cuántas. La bandeja le daba pedido por pedido,
sin ese corte. Es la fase 2 que SPEC-074 dejó pendiente.

## 2. Reglas

- **BR-001 — Una fila por asesor** del alcance, arriba de los filtros. La
  ven supervisión y administración; el asesor no (SPEC-080).
- **BR-002 — Columnas**: Asesor · Entregas fallidas · Fuera de plazo · Por
  entregar · Falta activar. Cada cifra usa la misma regla que la pestaña
  que abre:
  - «Entregas fallidas» no usa el período.
  - «Fuera de plazo» es «Por entregar» con el plazo vencido.
  - El resto usa el período elegido.
- **BR-003 — Cada cifra es un enlace** a esa pestaña con el asesor ya
  filtrado. El nombre filtra la vista abierta por ese asesor; si ya estaba
  filtrado, lo quita. La fila del asesor elegido se marca.
- **BR-004 — Orden:** primero quien suma más entregas fallidas y fuera de
  plazo, después quien tiene más por entregar. No aparecen los asesores sin
  nada pendiente, y las cifras en cero se muestran como «—», sin enlace.
- **BR-005 — Se ven 6 filas**; «Ver los N asesores» muestra el resto. El
  equipo aparece junto al nombre solo cuando hay varios equipos (SPEC-078).
  En el celular, solo las dos primeras cifras.
- **BR-006 — Respeta el filtro de equipo**, pero no el de asesor: la tabla
  sigue mostrando a todos para poder comparar.

## 3. Criterios de aceptación

- **AC-001**: la cifra de «Entregas fallidas» de un asesor coincide con la
  pestaña «Entregas fallidas» filtrada por ese asesor.
- **AC-002**: desde la tabla se llega a la lista de un asesor en un toque.
