# SPEC-044 — Rendimiento orientado a la acción

Estado: **fase 3 construida** (05/09/2026); fases 1 y 2 entregadas y
verificadas en producción. Las vistas `SUPERVISOR` y `AGENT` se revisaron por
lectura del código; el recorrido con sesión real sigue pendiente. Plan «Rendimiento orientado a
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

#### Decisiones de la fase 2 (asumidas y escritas, 05/09/2026)

- **Pertenencia al equipo** en el resumen: la del pedido (`assignedTeamId`),
  la misma que usa el filtro de equipo. Los pedidos sin equipo van a la fila
  «Sin equipo asignado» (con o sin asesor) y los de equipos fuera del alcance
  listado a «Otros equipos»; ninguna de las dos enlaza, porque Pedidos no
  tiene un filtro que signifique exactamente eso. Un pie «Total del alcance»
  suma las filas y coincide con los indicadores.
- **Cuota del equipo** sin cuota fijada: el tramo por defecto por cada
  vendedor activo, igual que en la página de cuotas (SPEC-038 BR-008). A
  nivel de equipo no hay «siguiente tramo»: los bonos son individuales.
- **Responsable**: el primer supervisor activo del equipo; sin ninguno, la
  fila dice «Sin supervisor» y la cabecera cuenta cuántos equipos están así.
- **Orden por cuota** («más cerca de llegar»): primero quienes no la alcanzan,
  del que menos le falta al que más; después los cumplidos, de mayor a menor
  entregadas; sin cuota, al final. El orden por defecto sigue siendo pagables
  → ingresadas → nombre.
- **El filtro de gestión y el orden** rigen el desglose **y** la matriz por
  día: una sola lista de asesores por pantalla. La fila «Sin asesor» solo se
  muestra sin filtro. Un valor desconocido en `orden=` o `gestion=` vuelve al
  defecto sin error.
- **Siguiente tramo del bono** en la celda de cuota solo cuando añade
  información (tramo distinto de la cuota o confirmadas distintas de
  entregadas); el detalle completo va siempre en el `title`.
- **El desglose queda abierto** por defecto y sube junto al resumen por
  equipo, antes de la matriz; la reordenación completa es REN-07 (fase 3).

### Fase 3 — Filtros vivos y jerarquía (REN-06, REN-07)

- **BR-009** Barra en vivo compartida (`DirectoryFilters`): equipo y asesor
  aplican al cambiar, búsqueda por nombre acota el desglose, fichas
  quitables; el nombre del asesor siempre filtra por él.
- **BR-010** Orden de pantalla: filtros → indicadores → equipos y pendientes
  → avance individual → análisis detallado; matriz con «últimos 7 días /
  mes completo» que no altera la cohorte de los indicadores.

#### Decisiones de la fase 3 (asumidas y escritas, 05/09/2026)

- **La barra en vivo es `DirectoryFilters`**, extendida con campos de mes
  (`fields`) y con la búsqueda opcional: el mes aplica al cambiar pero no es
  un filtro que se «quite» (siempre hay un mes), así que no sale como ficha y
  «Limpiar filtros» lo conserva. Las flechas de mes anterior/siguiente se
  mantienen.
- **Búsqueda por nombre (`q=`)**: acota el desglose y la matriz, nunca los
  indicadores ni el resumen por equipo; compara sin tildes ni mayúsculas y
  exige dos caracteres. La fila «Sin asesor» se oculta mientras hay búsqueda
  o filtro de gestión.
- **El nombre del asesor siempre filtra por él**; «Ver todo el equipo» es un
  enlace propio en la cabecera que quita asesor y búsqueda y conserva mes,
  equipo, orden, gestión y ventana de la matriz. La ficha «Asesor: …» de la
  barra también lo quita.
- **Orden de pantalla**: controles → indicadores → [resumen por equipo |
  avance del mes] + pendientes → desglose por asesor → comisión → «Análisis
  detallado» (tendencia diaria, matriz por asesor y día, conversión y
  composición; pulso diario en la vista personal). Con un asesor aislado o en
  la vista personal no hay resumen por equipo: en su lugar va el avance del
  mes, como antes.
- **Ventana de la matriz (`matriz=7D|MES`)**: «últimos 7 días» son los
  últimos siete días transcurridos del mes elegido (en un mes cerrado, del
  25 al fin de mes); por defecto 7 días en el mes en curso y mes completo en
  uno cerrado; la URL manda. La columna total suma solo los días visibles y
  se llama «7 días» o «Mes» según la ventana; la cabecera lo dice y recuerda
  que los indicadores siguen contando el mes completo.
- **Vista `SUPERVISOR`** (por lectura del código): la barra ofrece «Mis
  equipos» y sus asesores; el resumen por equipo lista sus equipos y sus
  pedidos propios en otro equipo caen en «Otros equipos»; el selector «Vista»
  aparece solo si también vende. **Vista `AGENT`/personal**: barra con solo
  el mes (y «Vista» si aplica), sin búsqueda; sin resumen por equipo, sin
  desglose ni matriz; el orden es controles → indicadores → avance del mes +
  pendientes → comisión → análisis (pulso diario, conversión, composición).

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

## 6. Criterios de aceptación de la fase 2

- **AC-007:** la suma de ingresadas de las filas del resumen por equipo (más
  las residuales) es igual a «Ventas ingresadas»; igual para pagables, por
  activar, por recuperar y casos de recupero.
- **AC-008:** cada equipo muestra su supervisor o «Sin supervisor», y
  `N sin producción` abre el tablero de ese equipo con `gestion=SIN_PRODUCCION`.
- **AC-009:** la celda de cuota muestra entregadas/cuota y confirmadas, y la
  cabecera dice los días exactos de la ventana y si está en curso o cerrada.
- **AC-010:** `orden=CUOTA` pone primero a quien menos le falta;
  `gestion=<clave>` acota el desglose y la matriz, muestra la definición y
  «N de M asesores»; volver a elegir el filtro lo quita.
- **AC-011:** los enlaces a Pedidos conservan `orden` y `gestion` en `volver=`.

## 7. Criterios de aceptación de la fase 3

- **AC-012:** escribir dos letras en «Buscar asesor» acota el desglose y la
  matriz sin botón, la URL lleva `q=` y los indicadores no cambian.
- **AC-013:** el mes, el equipo y el asesor aplican al cambiar; los filtros
  activos se ven como fichas y se quitan uno a uno; «Limpiar filtros»
  conserva el mes.
- **AC-014:** el nombre de un asesor ya filtrado sigue filtrando por él;
  «Ver todo el equipo» vuelve al conjunto conservando mes y orden.
- **AC-015:** la matriz cambia entre 7 días y mes completo por URL, con los
  días exactos en la cabecera; «Ventas ingresadas» no cambia.
- **AC-016:** el resumen por equipo y los pendientes van antes del desglose;
  el análisis detallado, al final.
