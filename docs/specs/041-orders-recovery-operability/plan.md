# SPEC-041 — Plan

## 1. Arquitectura

Ninguna pieza nueva de infraestructura: las dos bandejas adoptan mecánicas
que ya existen y que la operación ya conoce.

- **Recupero de ventas** reutiliza `QueueFilters` (SPEC-030 BR-092), la
  misma barra de las colas de Campañas, con vista, equipo, responsable y
  cuatro selectores adicionales declarados como `extras`. La página sigue
  siendo un componente de servidor; la barra es el único cliente.
- **Pedidos** gana un componente cliente pequeño, `OrderScopeFilters`, que
  sustituye a los dos formularios GET (equipo y búsqueda). No conoce la URL:
  recibe de la bandeja el constructor `ordersHref`, que ya sabe conservar
  período, rango, vista y página, y le pasa solo lo que cambia. Así ningún
  filtro puede olvidarse de conservar algo que la bandeja sí conserva.
- **Reglas puras en `@repo/validation`**: `order-inbox-filters.ts` (valores
  del filtro de acción y de plazo, qué acciones abarca un grupo, ventana del
  plazo) y `sales-recovery-filters.ts` (vistas, estados por vista,
  prioridades y motivos con sus etiquetas). Las etiquetas viven una sola vez
  y las usan la tabla y los selectores.

## 2. Decisiones

### La acción derivada se filtra por ids, a propósito

La acción comercial (SPEC-029 BR-019) se calcula en código a partir del
estado y el motivo del courier; no está en la base. El conjunto de entregas
fallidas es pequeño y la bandeja ya lo cargaba entero para los indicadores.
Se saca esa consulta de la transacción, se le pide también el `id`, y el
filtro por acción se traduce a `id IN (…)`. Persistir la acción exigiría una
columna y su migración para una lista de decenas de filas.

### El plazo se filtra con la misma regla que rotula la fila

`getSlaState` decide el rótulo de cada fila (fuera de plazo, vence pronto,
sin horario, sin plazo). El filtro traduce cada tramo a una condición
equivalente sobre `deliveryDueAt`, `deliveryMethod`, `status` y
`deliveryStatus`. La ventana temporal de los tramos con fecha es una función
pura probada, para que «fuera de plazo» y «vence en 30 minutos» no puedan
divergir entre el filtro y la fila.

### En Recupero, los indicadores cuentan sobre el alcance

Igual que Seguimiento (SPEC-040): búsqueda, equipo y responsable acotan la
consulta y, con ella, las cifras de cabecera; prioridad, motivo, estado y
vencimiento se resuelven en memoria sobre la cartera ya ordenada (BR-095) y
solo acotan la lista. Resueltos pagina en la base —el histórico crece sin
tope y no hay nada que ordenar en memoria— y se ordena por fecha de
resolución.

### Búsqueda de Pedidos: tres caracteres o Enter

La búsqueda de Pedidos es `contains` sobre nueve campos; con uno o dos
caracteres devolvería media bandeja y la haría parpadear entre tecla y
tecla. Se exige tres caracteres para el disparo automático; Enter aplica
con cualquier largo, porque quien escribe «19» y pulsa Enter sabe lo que
quiere.

## 3. Verificación

- Puras: `order-inbox-filters.test.mjs` y `sales-recovery-filters.test.mjs`.
- Web: `pedidos-filtros.test.tsx` (pausa, Enter, asesor por equipo, plazo,
  acción, fichas) y `bandeja-recupero.test.tsx` (barra, vista de resueltos,
  indicadores que conservan filtros).
- Recorrido por fetch en local con sesión de administrador y lectura de
  solo lectura en producción tras el despliegue, registradas en
  `verification.md`.
