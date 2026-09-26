# SPEC-076 — La lista de pedidos crece con la página

**Estado:** `VERIFICADA` — mejora de presentación, con la autorización de José del 25/09/2026

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

José, sobre la lista de Pedidos: «cuando hay más pedidos, se ocultan y uno
debe desplazar dentro de esa caja, ¿tenemos otras alternativas? El asesor
mira pocos pedidos en el día, pero el administrador o supervisor tienen más
pedidos consolidados».

La lista vivía en una caja de altura fija (`100vh - 17rem`) con su propio
desplazamiento. En un panel de 1070 px se veían unos 5 pedidos, y la página
tenía dos barras de desplazamiento, una dentro de la otra.

## 2. Alternativas evaluadas

| Alternativa | Veredicto |
|---|---|
| Caja con desplazamiento propio (actual) | Descartada: esconde pedidos y hay dos desplazamientos |
| Lista que crece con la página, con la cabecera de columnas y el panel de gestión pegados arriba | **Elegida**: un solo desplazamiento, el que ya usa el mouse y el celular |
| Virtualizar la lista (TanStack Virtual) | Queda para cuando una página muestre cientos de pedidos; con 50 por página no hace falta |
| Agrupar por asesor, plegable | Útil para supervisión; se evalúa en SPEC-074 |

## 3. Reglas

- **BR-001 — Un solo desplazamiento:** la lista mide lo que miden sus
  pedidos.
- **BR-002 — La cabecera de columnas queda pegada arriba** al bajar la
  página. El panel de gestión ya iba pegado y acompaña.
- **BR-003 —** `overflow: clip` recorta las esquinas sin crear un
  contenedor de desplazamiento, así la cabecera pegada funciona.

## 3. Criterios de aceptación

- **AC-001**: con 50 pedidos, la lista no tiene barra de desplazamiento
  propia.
- **AC-002**: al bajar la página, la cabecera de columnas sigue visible.
