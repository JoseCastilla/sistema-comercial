# SPEC-047 — Verificación

## Fase 1 (06/09/2026)

**Pruebas**: `@repo/validation` 318 en verde; web 202 (6 nuevas en
`rendimiento-entregadas`: entregadas por operación, entregada sin fecha no
cuenta, venta ingresada el 31/08 y entregada el 02/09 es entregada de la
cohorte de agosto, corte de maduración al día 6, orden por defecto
`ENTREGADAS`, filtro `SIN_ENTREGAS`, `orden=PAGABLES` viaja y `ENTREGADAS`
no). Tipos y lint limpios.

**Local, agosto de 2026 (mes cerrado), sesión de administrador**:

- AC-001 / AC-007: «Ventas entregadas 118» (112 portabilidades y 6 altas
  nuevas) abre Pedidos con `status=DELIVERED` y **118 encontradas**.
- AC-002: en setiembre (mes en curso, sin ventas en local) el pie dice «0
  frente a 1 entregadas hasta el día 6 del mes pasado (-100%) · esa cohorte
  terminó con 87»; en agosto, «118 este mes; sin entregas el mes pasado para
  comparar».
- AC-003: sin `orden=` el desglose va 23 → 21 → 17 → 14 entregadas.
- AC-004: equipos 101 + 9 + 6 + 1 + «Sin equipo asignado» 1 = 118 = tarjeta;
  la columna «Entregadas» está en equipos y asesores.
- AC-005: `gestion=SIN_ENTREGAS` muestra su definición y «1 de 14 asesores».
- AC-006: prueba del cruce de meses en verde.
- BR-006: cinco bloques declaran su fecha (resumen por equipo, desglose,
  actividad diaria, matriz, conversión).

**Producción (06/09/2026, commit 52c99f3, setiembre en curso, sesión de
administrador en solo lectura)**:

- AC-001 / AC-007: «Ventas entregadas 182» (168 portabilidades y 14 altas
  nuevas) abre Pedidos con `status=DELIVERED`: «50 órdenes en esta página de
  **182 encontradas**» y el indicador «Entregados 182» de Pedidos.
- AC-002: el pie dice «182 frente a 79 entregadas hasta el día 6 del mes
  pasado (+130.4%) · esa cohorte terminó con 100»; la de ingresadas, «281
  frente a 155 en los días 1–6 del mes pasado (+81.3%)».
- AC-003: el desglose va 21 → 17 → 15 → 15 → 14 entregadas sin `orden=`.
- AC-004: equipos 105 + 61 + 16 + 0 = 182 = tarjeta; pie «Total del alcance»
  281 / 182.
- AC-005: `gestion=SIN_ENTREGAS` muestra la definición y «2 de 19 asesores».

## Fase 2 (06/09/2026)

**Pruebas**: web 207 (5 nuevas en `rendimiento-resumen-visual`: tendencia por
día de entrega con la venta del 31/08 entregada el 02/09 contada en el día 2
de setiembre y marcada de mes anterior, entregas de agosto y sin fecha
excluidas; avisos vacíos sin valor, en orden fijo y con su destino; sin
enlace a administración para un supervisor y sin «sin asesor» en la vista
personal; etiqueta del origen de la cuota). Tipos y lint limpios.

**Local, agosto de 2026 (mes cerrado), sesión de administrador**:

- AC-009: celdas «22/30 · 73.3% · faltan 8 · 22 confirmadas · cuota por
  defecto» en asesores y «97/210 · 46.2% · faltan 113 · 97 confirmadas · cuota
  por defecto» en equipos.
- AC-010: tarjeta «Cuota del tramo 111/390 · 28.5% · faltan 279 entregadas ·
  4 equipos · 0 con cuota asignada»; barras 1 + 6 + 7 + 97 = 111.
- AC-011: «Entregas registradas por día»: 118 en el mes, 6 de 31 días con
  entregas, mejor día 56 · día 23; «Todas son ventas de este mes».
- AC-012: barras de menor a mayor cumplimiento (3.3% → 6.7% → 11.7% → 46.2%),
  cada una abre el tablero del equipo.
- AC-013: dos avisos, «Equipo sin supervisor 1» → Equipos sin supervisor y
  «Pendientes de meses anteriores 42» → Pedidos con el rango exacto.
- BR-012: accesos «Entregadas en Pedidos», «Cuotas», «Conciliación» y
  «Análisis detallado» (ancla).
- La cabecera de cumplimiento dice «Cuota del último tramo · Tramo cerrado»
  en agosto.

**Producción (06/09/2026, commit 42e12f5, setiembre en curso, sesión de
administrador en solo lectura)**:

- AC-009: celda «20/100 · 20% · faltan 80 · 20 confirmadas · 10 confirmadas
  para el bono de 30 · cuota asignada»; los equipos sin cuota fijada dicen
  «cuota por defecto».
- AC-010: tarjeta «Cuota del tramo 168/1280 · 13.1% · faltan 1112 entregadas
  · 4 equipos · 3 con cuota asignada»; barras 0 + 15 + 99 + 54 = 168.
- AC-011: «Entregas registradas por día»: 188 en el mes, 6 de 6 días con
  entregas, promedio 31.3, mejor día 47 · día 2; «6 de estas entregas son de
  ventas de meses anteriores» (la cohorte de setiembre tiene 182 entregadas:
  la diferencia son las entregas de ventas de agosto registradas este mes).
- AC-012: barras de menor a mayor cumplimiento (0% → 6% → 14.1% → 18%).
- AC-013: tres avisos: «Equipos sin supervisor 2», «Vendedores sin ventas en
  el mes 2» y «Pendientes de meses anteriores 52», cada uno con su destino.

## Fase 3 (06/09/2026)

**Pruebas**: web 208 (1 nueva: `columnas=todas` viaja en la URL, la compacta
es el defecto y `performanceHref` la conserva al cambiar de mes). Tipos y
lint limpios.

**Local, agosto de 2026, sesión de administrador**:

- AC-014: las cabeceras de bloque se leen «Resultado» (tarjetas, entregas por
  día, cumplimiento, avisos) → «Gestión · Equipos, pendientes y avance
  individual» → «Económico · monto estimado» → «Actividad · análisis
  detallado · Ingresos por día, ritmo, conversión y composición».
- AC-015: «Pendientes por resolver o cubrir · 6 indicadores con pendientes»
  es un `<details>` cerrado al cargar.
- AC-016: sin `columnas=` la tabla tiene Asesor, Entregadas, Cuota,
  Pagables, Pendientes («0 por activar · 0 por recuperar · 0 casos») y
  Estimado; con `columnas=todas` y `orden=CUOTA`, doce columnas (trece en el
  mes en curso, con «Hoy»), y el enlace del asesor y la flecha de mes
  conservan `orden=CUOTA&columnas=todas`.

**Producción (06/09/2026, commit 42e12f5)**:

- AC-014: bloques en el orden Resultado → Cumplimiento → Avisos → Gestión →
  Administración → Avance individual → Económico → Actividad.
- AC-015: «Pendientes por resolver o cubrir · 9 indicadores con pendientes»
  contraído al cargar.
- AC-016: tabla compacta con Asesor, Entregadas, Cuota, Pagables, Pendientes
  y Estimado.
