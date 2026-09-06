# SPEC-044 — Rendimiento orientado a la acción

Estado: **fases 1 a 6 entregadas y verificadas en producción** (05/09/2026).
Queda la validación con un supervisor de varios equipos. Quedan las validaciones con sesión de supervisor
que vende y supervisor multiequipo. Las vistas `SUPERVISOR` y `AGENT` se revisaron por
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

### Fase 4 — Supervisor (plan «Rendimiento accionable para supervisores» v1.0, 05/09/2026)

Revisado con la sesión de supervisor de HUANCAYO - EL TAMBO en producción.

| Acción | Hallazgo del plan | Contraste |
|---|---|---|
| SUP-01 | Los enlaces por activar / por recuperar omiten el asesor | **Ya resuelto por la fase 1** (BR-001/BR-003): con la sesión de supervisor, «Pedidos por recuperar 7» de Christian abre Pedidos con `advisor=` y devuelve 7; la vuelta conserva `agent=`. Sin cambios. |
| SUP-02 | «6 de 6 con ventas» no distingue una venta de actividad sostenida | Real. |
| SUP-03 | Falta una tabla de intervención ordenable antes de la matriz | Parcial: la tabla existe desde la fase 2 y va antes de la matriz; faltaba el orden por cercanía al bono. |
| SUP-04 | El reparto «330 frente a 300» no se explica | Real. |
| SUP-05 | «Organización» en cuotas es la suma de los equipos visibles del supervisor | Real: `organizationTarget` caía a la suma de los equipos del alcance y se etiquetaba «Organización». |
| SUP-06 | Filtros con botón; variación sin volúmenes; asesor incompatible al cambiar de equipo | Filtros vivos ya resueltos por la fase 3; volúmenes y asesor incompatible, reales. |

**Inconsistencia documental registrada** (corrección al plan anterior): SPEC-014
BR-019 (31/08/2026) autoriza al `SUPERVISOR` a ver el importe individual de
comisión de sus asesores y es lo implementado (`showsIndividualCommission`).
SPEC-034 (§ alcance y AC-005) todavía dice que el supervisor no ve importes:
está desactualizada frente a BR-019. Se conserva la autorización implementada;
SPEC-034 no se reescribe aquí.

- **BR-011 · Acompañar sin juzgar (SUP-02).** El desglose muestra por asesor
  «Hoy» (solo en el mes en curso), «Ingresadas» del mes, «Última venta» (día
  del mes) y «N de M días con ventas» sobre los días transcurridos; los días
  futuros no cuentan. El filtro «Sin ventas hoy» existe solo en el mes en
  curso y solo para vendedores activos; «Sin producción» pasa a llamarse «Sin
  ventas en el mes». Ningún texto habla de asistencia o ausencia: son ventas
  registradas. Los históricos siguen marcados «· histórico» y quedan fuera de
  ambos filtros.
- **BR-012 · Cercanía al bono (SUP-03).** Orden «Bono: más cerca del siguiente
  tramo»: menos confirmadas faltantes primero; sin siguiente tramo, al final.
  Cuota (entregadas) y bono (confirmadas) siguen separados en la celda.
- **BR-013 · El reparto se explica (SUP-04).** Cada equipo en Cuotas dice
  «Objetivo del equipo: X. Repartido: Y.» y la diferencia con su signo: faltan
  N por repartir / justo el objetivo / N por encima del objetivo («puede ser
  deliberado; no bloquea», SPEC-038 BR-009). Cada cuota se marca «asignada» o
  «por defecto»; con cuota de equipo por defecto se dice «N vendedores ×
  tramo». El acceso «Asignar cuotas» ya vive junto al resumen por equipo.
- **BR-014 · El alcance de la cuota se nombra (SUP-05).** Para un supervisor
  la cabecera de Cuotas es «Equipos a tu cargo · Objetivo de tus equipos» con
  la suma de sus equipos y quién la fija; si administración fijó una cuota de
  organización, se muestra como referencia sin compararla con el reparto
  parcial. Nunca se etiqueta «Organización» un subtotal.
- **BR-015 · Comparar con volúmenes (SUP-06).** La variación se dice con sus
  cifras: «95 frente a 13 en los días 1–5 del mes pasado (+630.8%)»; con base
  cero: «95 este mes; sin ventas en los días 1–5 del mes pasado para
  comparar». En el desglose la celda «Vs. mes pasado» lleva la misma frase en
  su `title`.
- **BR-016 · Cambiar de equipo resuelve al asesor (SUP-06).** El selector de
  equipo vacía `agent=` al cambiar (`resets`). Si la URL trae un asesor que no
  vende en el equipo filtrado, el tablero lo avisa y ofrece «Ver todo el
  equipo»; los indicadores quedan acotados a sus ventas dentro de ese equipo.

### Fase 5 — Asesor (plan «Mi rendimiento orientado a objetivos y acciones» v1.0, 05/09/2026)

Revisado con la sesión de asesor (Jimena Cuya) en producción. El plan ya
validaba: solo filtros personales, 8 pagables = S/ 200 de base, 3 por
recuperar abren 3 órdenes propias.

| Acción | Hallazgo del plan | Contraste |
|---|---|---|
| ASE-01 | La vista personal no muestra cuota ni avance | Real: `quota` solo se calculaba por fila del desglose, vacío en la vista personal. |
| ASE-02 | La segunda ventana aparece como faltante antes de comenzar | Real: «Bono del 25 a fin de mes: te falta 15 cerradas» el día 5. |
| ASE-03 | El mensaje recomienda recuperar activaciones con cero por activar | Real: frase fija en el pulso diario. |
| ASE-04 | Pedidos muestra pendientes anteriores que Rendimiento no ofrece como acción | Real: 5 en Pedidos, nada en Rendimiento. |
| ASE-05 | Objetivo y acciones detrás del análisis | Parcial: la fase 3 ya bajó el análisis; faltaba el objetivo y subir la actividad de hoy. |
| ASE-06 | Conciliación con «Sin asesor responsable» y la identidad repetida | Real. |

- **BR-017 · Cuota personal (ASE-01).** En la vista personal el asesor ve su
  cuota del tramo vigente (o del último cerrado): entregadas/cuota,
  porcentaje, faltante y los días exactos de la cohorte; es la misma cuota
  que ve supervisión (asignada, o la por defecto del tramo) y es de solo
  lectura. La cuota mide portabilidades entregadas; el bono, confirmadas; el
  panel los nombra como conceptos distintos. Las altas nuevas no cuentan.
- **BR-018 · Tramos según el día (ASE-02).** Cada ventana del bono se
  presenta «en curso», «por comenzar» (con su día de inicio) o «cerrada»
  (con su resultado). El «te falta para el siguiente bono» solo habla de la
  ventana en curso; en los días sin tramo (16 al 24) se dice que hoy no hay
  bono y queda el resultado del último cerrado. En un mes cerrado todas las
  ventanas están cerradas. Los faltantes y montos salen de la política
  centralizada.
- **BR-019 · Consejo desde los pendientes reales (ASE-03).** El texto del
  pulso diario se compone con las entregadas por activar, los pedidos por
  recuperar y los casos abiertos; con cero por activar no pide activar; con
  pedidos por recuperar ofrece revisarlos «por si alguno se puede reingresar»,
  sin prometer; sin pendientes, lo dice.
- **BR-020 · Pendientes de meses anteriores (ASE-04).** Bloque aparte dentro
  de «Pendientes de intervención»: pedidos abiertos (`OPEN`, `SENT`,
  `UNKNOWN`) registrados antes del mes en curso, con el alcance del tablero;
  misma definición que «pendientes de meses anteriores» en Pedidos. Su enlace
  abre Pedidos con `period=RANGE` del primer registro al último día del mes
  anterior, `status=ACTIVE` y el alcance, así el contador coincide con la
  lista. No suma a las ventas ni conversiones del mes elegido. Se muestra en
  todas las vistas.
- **BR-021 · Orden de la vista personal (ASE-05).** Controles → indicadores →
  [cuota personal + pendientes] → actividad de hoy → comisión estimada («no
  es tu boleta de pago») → «Análisis detallado» (ritmo del mes, conversión,
  composición).
- **BR-022 · Conciliación personal (ASE-06).** Con rol `AGENT` la conciliación
  no ofrece «Sin asesor responsable» ni repite la columna de asesor; conserva
  resultado, motivo, comisión base y enlace al pedido. El alcance personal
  sigue validado en el servidor.

### Fase 6 — Supervisor que también vende (validación pendiente del plan del supervisor, 05/09/2026)

Revisado con la sesión de Francis Pary (supervisor y vendedor de AYACUCHO -
MAGISTERIAL 02) en producción, en «Mi equipo» y «Mi rendimiento».

| Punto | Hallazgo | Contraste |
|---|---|---|
| Vista «Mi equipo» | Selector «Vista», resumen del equipo con él mismo como vendedor (3/4, «1 sin producción»), desglose con su fila | Correcto: quien vende cuenta como vendedor. |
| Vista «Mi rendimiento» | Cuota personal 0/70, la misma que ve administración; pendientes propios | Correcto. |
| Enlaces personales | «Casos de recupero abiertos 1» abría `/recovery/sales` sin filtro, que para un supervisor es la bandeja de sus equipos (14); «Entregadas por activar 0» abría Pedidos de sus equipos (10); «Revisar cálculo» abría la conciliación de sus equipos (45 órdenes) | **Real**: un asesor no necesita pedir «solo lo mío» porque ya es su alcance; un supervisor sí. |
| «Asignar cuotas» en la vista personal | Aparecía en «Mi rendimiento» | Fuera de lugar: es una herramienta de supervisión. |
| Cuotas | Podía fijar su propia cuota de asesor (70) | Conflicto de interés: el que reparte no debería fijarse la suya. |

- **BR-023 · «Solo lo mío» explícito (SV-01).** En la vista personal de un
  supervisor que vende, los enlaces a Pedidos (del mes y de meses anteriores),
  a Recupero de ventas y a la conciliación llevan su propio id
  (`advisor=` / `agent=`), porque esas pantallas le abren por defecto sus
  equipos. Para un asesor no viaja nada: su alcance ya es el propio. El
  servidor sigue validando el alcance en cada destino.
- **BR-024 · «Asignar cuotas» solo en la vista de equipo.** En «Mi
  rendimiento» no aparece.
- **BR-025 · Un supervisor no fija su propia cuota (SV-02).** La fija
  administración, como la del equipo (SPEC-038 BR-009). La página de Cuotas
  deshabilita su fila y lo dice; la acción lo rechaza con el mismo mensaje.
  Decisión asumida y escrita: evita que quien reparte se rebaje la suya.

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

## 8. Criterios de aceptación de la fase 4

- **AC-017:** con sesión de supervisor, la cabecera de Cuotas dice «Objetivo
  de tus equipos» y nunca «Organización»; el equipo dice objetivo, repartido
  y diferencia con signo.
- **AC-018:** el desglose muestra «Hoy», «Última venta» y «N de M días con
  ventas»; `gestion=SIN_VENTAS_HOY` solo aparece en el mes en curso y excluye
  históricos.
- **AC-019:** `orden=BONO` pone primero a quien menos confirmadas le faltan.
- **AC-020:** la tarjeta «Ventas ingresadas» muestra actual frente a anterior
  con los días equivalentes; con base cero lo dice.
- **AC-021:** cambiar de equipo con un asesor filtrado deja la URL sin
  `agent=`; una URL con asesor ajeno al equipo muestra el aviso.

## 9. Criterios de aceptación de la fase 5

- **AC-022:** con sesión de asesor, «Cuota del tramo» muestra entregadas/cuota,
  porcentaje, faltante y los días de la cohorte; la cuota coincide con la de
  supervisión para la misma persona y ventana.
- **AC-023:** el día 5 la segunda ventana dice «Comienza el día 25» y no
  muestra faltante; el «te falta» solo aparece para la ventana en curso.
- **AC-024:** con cero por activar el consejo no menciona activar; con N por
  recuperar ofrece revisarlos.
- **AC-025:** «Pendientes de meses anteriores» muestra N y su enlace abre
  Pedidos con exactamente N órdenes.
- **AC-026:** la vista personal ordena objetivo y acciones → hoy → comisión →
  análisis.
- **AC-027:** la conciliación del asesor no ofrece «Sin asesor responsable»
  ni columna de asesor.

## 10. Criterios de aceptación de la fase 6

- **AC-028:** en «Mi rendimiento» del supervisor que vende, «Casos de recupero
  abiertos N» abre Recupero con «Casos abiertos N»; «Pedidos por recuperar N»
  y «Entregadas por activar N» abren Pedidos con N; «Revisar cálculo» abre la
  conciliación con su nombre y sus órdenes.
- **AC-029:** «Asignar cuotas» no aparece en «Mi rendimiento» y sí en «Mi
  equipo».
- **AC-030:** en Cuotas, su propia fila está deshabilitada con «Es tu propia
  cuota: la fija administración»; la acción devuelve el mismo mensaje.
