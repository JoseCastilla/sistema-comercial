# SPEC-044 — Rendimiento orientado a la acción

Estado: **fase 1 en construcción** (05/09/2026). Plan «Rendimiento orientado a
la acción» v1.0, revisado con José el 05/09/2026 sobre la vista de `ADMIN`;
las revisiones de `SUPERVISOR` y `AGENT` quedan pendientes. Se apoya en
SPEC-027 (tablero), SPEC-032 (integridad de métricas), SPEC-034 (filtro por
asesor), SPEC-038 (aceleradores y cuotas) y SPEC-041 (Pedidos y Recupero).

## 1. Origen

El tablero responde bien «cuánto» y mal «qué hago ahora». Sus cifras no
abren lo que cuentan (o abren más de lo que cuentan), no hay resumen por
equipo, el avance de cuota vive contraído y sin orden, y los filtros se
aplican con botón.

## 2. Verificación de los hallazgos (05/09/2026, lectura del código)

| Acción | Hallazgo | Contraste |
|---|---|---|
| REN-01 | El indicador individual abre toda la organización | Real: `ordersHref` no mandaba `advisor`. Además, «Entregadas por activar» y el filtro `AWAITING_ACTIVATION` de Pedidos tenían definiciones distintas (Rendimiento exige `deliveredAt`; Pedidos excluía `CANCELLED`). |
| REN-02 | Sin resumen por equipo | Real: desglose por asesor y agregado `workforce`; la cuota por equipo solo en `/performance/quotas`. |
| REN-03 | «Recuperar» y «Por activar» no son enlaces; «Recuperar» mezcla pedidos y casos | Real. |
| REN-04 | Detalle contraído, sin orden; confirmadas no se muestran aunque viajan | Real. |
| REN-05 | Sin filtros de gestión | Real; existe el contador de vendedores sin ventas, sin acceso. |
| REN-06 | Filtros con «Aplicar»; el nombre del asesor quita el filtro en silencio | Real. |
| REN-07 | Matriz antes que responsables y pendientes; siempre mes completo | Real. |

## 3. Invariantes (del plan; no se tocan)

Cohorte por fecha de ingreso en America/Lima; comparación del mes actual
contra los mismos días transcurridos del anterior; cuota sobre portabilidades
entregadas y acelerador sobre confirmadas; política centralizada de
comisiones; alcance e importes por rol.

## 4. Reglas

### Fase 1 — Contexto y enlaces (REN-01, REN-03)

- **BR-001 · Cada cifra abre exactamente lo que cuenta.** Los enlaces del
  tablero a Pedidos llevan la cohorte (`period=RANGE&from&to`), el estado, el
  **equipo y el asesor** vigentes; una fila del desglose lleva su propio
  asesor; la fila «Sin asesor» lleva `team=UNASSIGNED`. En la vista personal
  no viaja equipo ni asesor: el alcance ya es el propio. Pedidos valida el
  alcance en el servidor (SPEC-010, SPEC-041).
- **BR-002 · Una sola definición de «por activar».** Pedidos adopta la de
  Rendimiento, que es la que paga: entregada (`deliveryStatus = DELIVERED`
  con `deliveredAt`) y no cerrada con fecha. El indicador y la lista que abre
  cuentan lo mismo (SPEC-040 BR-001).
- **BR-003 · Volver a Rendimiento con los filtros.** Cada enlace lleva
  `volver=` con la ruta de Rendimiento vigente; Pedidos lo acepta solo si es
  una ruta interna de `/performance`, lo conserva al cambiar filtros y muestra
  «← Volver a Rendimiento».
- **BR-004 · Pedidos por recuperar y casos de recupero son cosas distintas.**
  «Pedidos por recuperar» son pedidos del mes no entregados o cancelados y
  abren Pedidos; «Casos de recupero» son casos abiertos con responsable y
  cadencia en Recupero de ventas y abren esa bandeja filtrada por
  responsable (o por equipo). El tablero muestra ambos, en «Pendientes de
  intervención» y en el desglose por asesor, con su definición al pie.
- **BR-005 · Las celdas del desglose son enlaces.** «Pedidos por recuperar»,
  «Casos de recupero» y «Por activar» de cada asesor abren su conjunto; un
  cero no enlaza.

### Fase 2 — Equipos, cuotas y gestión (REN-02, REN-04, REN-05)

- **BR-006** Resumen por equipo: supervisor responsable (o «sin
  supervisor»), vendedores activos con y sin producción, ingresadas, tasa de
  entrega, pagables, por activar, por recuperar, cuota / avance / brecha de la
  ventana vigente; los totales por equipo más «sin asignación» reconcilian
  con el alcance sin duplicados.
- **BR-007** Avance de cuota visible antes de la matriz, con entregadas
  (cuota) y confirmadas (acelerador) diferenciadas, brecha y faltantes para
  el siguiente tramo, ordenable por URL; ventana y fechas de cohorte
  explícitas; fuera de ventana activa, la última cerrada.
- **BR-008** Filtros de gestión en la URL —sin producción, con entregas por
  activar, con pedidos por recuperar, cuota pendiente— con definición
  visible; «sin producción» = vendedor activo habilitado con cero ingresadas;
  «cuota pendiente» = entregadas < cuota, sin proyección.

### Fase 3 — Filtros vivos y jerarquía (REN-06, REN-07)

- **BR-009** Barra en vivo compartida (`DirectoryFilters`): equipo y asesor
  aplican al cambiar, búsqueda por nombre acota el desglose, fichas
  quitables; el nombre del asesor siempre filtra por él.
- **BR-010** Orden de pantalla: filtros → indicadores → equipos y pendientes
  → avance individual → análisis detallado; matriz con «últimos 7 días /
  mes completo» que no altera la cohorte de los indicadores.

## 5. Criterios de aceptación de la fase 1

- **AC-001:** con asesor y equipo filtrados, «Entregadas por activar = N»
  abre Pedidos con exactamente N pedidos; igual «Pedidos por recuperar».
- **AC-002:** con los mismos datos, `status=AWAITING_ACTIVATION` en Pedidos
  cuenta lo mismo que «Entregadas por activar» en Rendimiento.
- **AC-003:** desde esa lista, «← Volver a Rendimiento» regresa al mismo
  mes, equipo y asesor.
- **AC-004:** «Casos de recupero abiertos» abre Recupero de ventas filtrada
  por el asesor (o el equipo) y su cifra coincide con «Casos abiertos» allí.
- **AC-005:** en la vista personal del asesor ningún enlace lleva equipo ni
  asesor.
- **AC-006:** tipos, lint y pruebas en verde.
