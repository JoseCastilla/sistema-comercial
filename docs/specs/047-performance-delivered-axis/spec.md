# SPEC-047 — Rendimiento medido en ventas entregadas

**Estado:** `ENTREGADA` — fase 1 verificada en producción; fases 2 y 3 entregadas, verificación en producción pendiente (06/09/2026)

> Plan v1.0 de José del 06/09/2026, con criterio confirmado: **el resultado
> comercial se mide por ventas entregadas**. Se apoya en SPEC-027 (tablero),
> SPEC-032 (integridad y comparación pro-rata), SPEC-038 (cuota en
> portabilidades entregadas) y SPEC-044 (enlaces, resumen por equipo, orden y
> filtros de gestión).

## 1. Origen

El tablero encabeza con «Ventas ingresadas» y ordena por pagables. Ninguna
de las dos es el resultado que la operación persigue: lo que se entrega es
lo que se cobra y lo que mide la cuota (SPEC-038 BR-007). El plan pide mover
el eje a entregadas sin cambiar el período (cohorte por fecha de ingreso),
mostrar cumplimiento y brecha de cuota, abrir con un resumen visual, dejar
cada fecha declarada y separar resultado, actividad y gestión.

## 2. Contraste con el proyecto (06/09/2026, lectura del código)

| Acción | Pedido | Contraste |
|---|---|---|
| RD-01 | Eje de resultado a entregadas | Real: la tarjeta «hero» es «Ventas ingresadas» con la única comparación; entregadas va segunda sin comparar; el orden por defecto es `PAGABLES`; equipos y asesores tienen «Ingresadas» y «Tasa de entrega» pero no «Entregadas». Coherente con la invariante de cohorte (SPEC-044 §3) y con la cuota (SPEC-038 BR-007). |
| RD-02 | Cumplimiento y brecha de cuota | **Ya cumplido en numerador y ventana**: `calculateAcceleratorWindow` cuenta solo portabilidades registradas en la ventana y entregadas; las altas nuevas quedan fuera. Falta distinguir cuota **asignada** de **por defecto** en el tablero (la página de Cuotas ya lo dice, SPEC-044 BR-013) y mostrar el porcentaje. |
| RD-03 | Resumen visual inicial | Parcial: hay cuatro tarjetas y un resumen por equipo en tabla; no hay tendencia de entregadas, ni barras de cumplimiento, ni avisos priorizados. |
| RD-04 | Fechas y comparaciones sin ambigüedad | Real: la comparación de ingresadas ya es pro-rata (SPEC-032 BR-005) pero ningún gráfico declara su fecha; comparar entregadas contra el mes pasado completo mezclaría maduración. |
| RD-05 | Separar resultado, actividad y gestión | Parcial: la comisión ya va aparte; los pendientes administrativos se muestran completos; la tabla individual tiene hasta 12 columnas. |

**Incoherencia encontrada y corregida aquí**: «Entregados» en Pedidos se
define como *cerrado o subestado entregado*; «Ventas entregadas» en
Rendimiento como *estado de entrega entregado con fecha*. Para que el
indicador abra exactamente sus órdenes (regla del plan), Pedidos adopta la
definición de Rendimiento, como hizo SPEC-044 BR-002 con «por activar».

**Dato disponible**: `deliveredAt` lo fija la plataforma la primera vez que
registra la entrega (acción de estado o consulta a Máximo); la API nunca lo
escribe. Es la **fecha en que se registró la entrega**, no la del courier, y
así se declara.

## 3. Invariantes (no se tocan)

Cohorte por fecha de ingreso en America/Lima; comparación del mes en curso
contra los mismos días transcurridos del anterior; cuota sobre portabilidades
entregadas y acelerador sobre confirmadas; política centralizada de
comisiones; alcance e importes por rol; cada cifra abre exactamente lo que
cuenta (SPEC-044 BR-001).

## 4. Reglas

### Fase 1 — Eje de resultado y fechas declaradas (RD-01, RD-04)

- **BR-001 · La cifra que encabeza es «Ventas entregadas».** De la cohorte
  del mes (registradas en el mes) con estado de entrega entregado y fecha de
  entrega. La tarjeta distingue portabilidades y altas nuevas en su pie y
  abre Pedidos con `status=DELIVERED`, que pasa a contar lo mismo.
- **BR-002 · «Ventas ingresadas» es actividad.** Sigue en la primera fila
  como tarjeta secundaria, con su comparación pro-rata de siempre.
- **BR-003 · Comparación con maduración equivalente.** En el mes en curso,
  las entregadas se comparan con las de la cohorte del mes pasado
  registradas hasta el mismo día **y entregadas hasta ese mismo día** del
  mes pasado; el pie dice además con cuántas terminó esa cohorte al madurar.
  En un mes cerrado, las dos cohortes completas se comparan a hoy. Con base
  cero se dice, sin porcentaje.
- **BR-004 · Orden y columnas por entregadas.** El orden por defecto del
  desglose es «Más entregadas»; «Más pagables» sigue disponible. El resumen
  por equipo y el desglose por asesor ganan la columna «Entregadas» junto a
  la tasa; «Ingresadas» se conserva.
- **BR-005 · Filtro de resultado.** Nuevo filtro de gestión «Sin entregas en
  el mes»: vendedores activos con cero entregadas en el mes elegido, tengan
  o no ventas ingresadas.
- **BR-006 · Cada bloque declara su fecha.** Los gráficos, matrices y tablas
  dicen «por fecha de ingreso» o «por día de entrega registrada» en su
  cabecera. Una venta ingresada el 31/08 y entregada el 02/09 cuenta en la
  cohorte de agosto (entregada) y en la actividad de entregas de setiembre;
  una prueba lo fija.

### Fase 2 — Cumplimiento visible y resumen visual (RD-02, RD-03)

- **BR-007 · Cuota con cumplimiento, brecha y origen.** Toda lectura de cuota
  muestra entregadas/cuota, porcentaje y faltante, y dice si la cuota es
  **asignada** o **por defecto** (el primer tramo de la ventana; para un
  equipo, vendedores × tramo). Aplica a equipos, asesores y vista personal.
- **BR-008 · Cuatro indicadores.** Ventas entregadas (encabeza), Cuota del
  tramo (entregadas/cuota del alcance con porcentaje), Portabilidades
  pagables y Ventas ingresadas. «Asesores con ventas» pasa a los avisos.
- **BR-009 · Tendencia de entregadas.** Barras por día de entrega registrada
  dentro del mes elegido, con acumulado; declara su fecha y dice cuántas de
  esas entregas son de ventas de meses anteriores. No enlaza a Pedidos porque
  Pedidos filtra por fecha de ingreso; la cifra que sí enlaza es la de BR-001.
- **BR-010 · Barras de cumplimiento por equipo.** Una barra por equipo del
  alcance (entregadas/cuota, %), de menor a mayor cumplimiento, que abre el
  tablero del equipo; con un asesor aislado o en la vista personal, la barra
  es la suya.
- **BR-011 · Avisos prioritarios.** Lista corta, en orden fijo, solo con lo
  que no es cero: equipos sin supervisor; asesor fuera del equipo filtrado;
  vendedores sin ventas en el mes; pedidos sin asesor ni equipo; entregadas
  por activar; pendientes de meses anteriores. Cada aviso abre su conjunto.
- **BR-012 · Accesos al detalle.** Desde el resumen: entregadas en Pedidos,
  Cuotas, Conciliación y «Análisis detallado» (ancla en la misma página).

### Fase 3 — Resultado, actividad y gestión separados (RD-05)

- **BR-013 · Tres bloques nombrados.** «Resultado» (indicadores, cumplimiento,
  tendencia de entregadas, avisos), «Gestión» (equipos, pendientes, desglose
  individual), «Económico» (comisión) y «Actividad» (ingresadas por día,
  matriz por asesor y día, conversión y composición) al final.
- **BR-014 · Pendientes administrativos bajo demanda.** El resumen de
  administración (SPEC-045 PL-01) se muestra contraído con su total y se abre
  a pedido.
- **BR-015 · Tabla individual compacta.** Por defecto: asesor, entregadas,
  cuota, pagables, pendientes (por activar · por recuperar · casos) y
  estimado. `columnas=todas` en la URL añade hoy, ingresadas, variación,
  última venta y tasa; el enlace conserva el resto de la lectura.

## 5. Decisiones asumidas (escritas, 06/09/2026)

- El período principal sigue siendo la cohorte por fecha de ingreso; la
  lectura por fecha de entrega es una actividad aparte (BR-009). Cambiar el
  período exige otra decisión, como dice el plan.
- Una «entregada» es la de `performance-metrics`: estado de entrega
  entregado con fecha de entrega. Incluye las cerradas: cerrar deriva
  entregado (`deriveDeliveryStatus`).
- La comparación de entregadas usa `deliveredAt` como marca de maduración
  (BR-003) porque es la única fecha de entrega que el sistema conserva.

## 6. Criterios de aceptación

### Fase 1

- **AC-001:** «Ventas entregadas N» abre Pedidos con exactamente N órdenes;
  su pie dice portabilidades y altas nuevas y las dos suman N.
- **AC-002:** en el mes en curso el pie de entregadas dice «frente a M
  entregadas hasta el día D del mes pasado» y «esa cohorte terminó con K»;
  con M = 0 lo dice sin porcentaje.
- **AC-003:** sin `orden=` el desglose va por entregadas; `orden=PAGABLES`
  vuelve al orden anterior.
- **AC-004:** equipos y asesores muestran «Entregadas»; la suma por equipo
  (más residuales) es igual a la tarjeta.
- **AC-005:** `gestion=SIN_ENTREGAS` acota a vendedores activos con cero
  entregadas y muestra su definición.
- **AC-006:** una venta registrada el último día de un mes y entregada el
  primero del siguiente cuenta en la cohorte del primero y en las entregas
  del segundo (prueba).
- **AC-007:** Pedidos con `status=DELIVERED` cuenta lo mismo que la tarjeta.
- **AC-008:** tipos, lint y pruebas en verde.

### Fase 2

- **AC-009:** cada celda de cuota dice porcentaje, faltante y «asignada» o
  «por defecto».
- **AC-010:** la tarjeta «Cuota del tramo» del alcance coincide con la suma de
  las cuotas de los equipos (o con la personal).
- **AC-011:** la tendencia de entregadas suma las entregas registradas en el
  mes y dice cuántas son de ventas anteriores.
- **AC-012:** las barras por equipo van de menor a mayor cumplimiento y abren
  el equipo.
- **AC-013:** los avisos aparecen solo con valor mayor que cero y abren su
  conjunto.

### Fase 3

- **AC-014:** los cuatro bloques se leen en el orden Resultado → Gestión →
  Económico → Actividad.
- **AC-015:** «Pendientes por resolver o cubrir» arranca contraído con su
  total.
- **AC-016:** sin `columnas=` la tabla individual tiene seis columnas de
  datos; con `columnas=todas`, las once.
