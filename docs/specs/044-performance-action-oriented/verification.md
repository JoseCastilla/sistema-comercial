# SPEC-044 — Verificación

## Fase 1 (05/09/2026)

1. **Pruebas** — 148 en verde en `apps/web`, 5 nuevas sobre los enlaces
   (`rendimiento-enlaces.test.ts`): las órdenes llevan cohorte, equipo,
   asesor y `volver`; una fila pide su propio asesor y «sin asignar» no lleva
   asesor; en la vista personal no viaja equipo ni asesor; los casos de
   recupero abren la bandeja del responsable o del equipo; el nombre del
   asesor filtra por él y, si ya lo está, vuelve al conjunto. Tipos y lint
   limpios.
2. **Recorrido local con sesión de administrador**, agosto 2026 (177 ventas
   en la base de desarrollo):
   - «Pendientes de intervención» muestra cuatro accesos: «Entregadas por
     activar = 0», «Pedidos por recuperar = 17», «Casos de recupero abiertos =
     1» y «Sin asesor ni equipo = 0»; todos con `period=RANGE&from=2026-08-01&
     to=2026-08-31` y `volver=/performance?month=2026-08`.
   - **Paridad**: «Pedidos por recuperar = 17» abre Pedidos con **17** órdenes;
     «Entregadas por activar = 0» abre **0** con la definición alineada; «Casos
     de recupero abiertos = 1» coincide con «Casos abiertos = 1» en Recupero de
     ventas (el caso local está sin responsable: por eso cuenta con o sin
     responsable).
   - Desglose: cabeceras «Pedidos por recuperar · Casos de recupero · Por
     activar» con definición en `title`; la fila de Jimena Cuya enlaza «4» a
     `status=RECOVERY&advisor=<id>` y esa lista trae **4** órdenes; los ceros
     no enlazan.
   - Con `?agent=<Jimena>`, los cuatro accesos llevan `advisor=<id>` y
     `volver=/performance?month=2026-08&agent=<id>`; «Casos de recupero» →
     `/recovery/sales?advisor=<id>`.
   - Pedidos muestra «← Volver a Rendimiento → /performance?month=2026-08» en
     la cabecera y lo conserva al cambiar filtros (`ordersHref`).

**Limitación declarada**: la base local no tiene entregadas por activar en
agosto, así que la paridad de esa cifra se comprobó en cero y por lectura de
las dos definiciones; producción la confirma con datos.

3. **Lectura de producción** (solo lectura, sesión de administrador, tras el
   despliegue de `f688248`, septiembre 2026):
   - «Entregadas por activar = 21» abre Pedidos con **21** órdenes: la paridad
     de `AWAITING_ACTIVATION` queda confirmada con datos reales (AC-002).
   - «Pedidos por recuperar = 80» abre Pedidos con «50 en esta página de **80**
     encontradas».
   - «Casos de recupero abiertos = 70» abre Recupero de ventas con «Casos
     abiertos **70**» y «70 caso(s) cumplen el filtro» (AC-004).
   - «Sin asesor ni equipo = 0» enlaza a `team=UNASSIGNED`.
   - Todos los accesos llevan `period=RANGE&from=2026-09-01&to=2026-09-30` y
     `volver=/performance?month=2026-09`; Pedidos muestra «← Volver a
     Rendimiento».
   - Fila individual (Jimena Cuya): «7» → **7** órdenes por recuperar; «8» →
     **8** casos abiertos en su bandeja; «2» → **2** por activar. Los ceros
     del desglose no enlazan (AC-001, BR-005).

La limitación declarada en la fase local (paridad de «por activar» observada
en cero) queda cerrada con la lectura de producción.

## Fase 2 (05/09/2026)

1. **Pruebas** — 157 en verde en `apps/web`, 9 nuevas
   (`rendimiento-gestion.test.ts`): definición de «sin producción» (un
   histórico no cuenta), «cuota pendiente» (entregadas < cuota; sin cuota no
   aplica), por activar / por recuperar; valores desconocidos en la URL
   vuelven al defecto; orden por cuota (más cerca primero, cumplidos después,
   sin cuota al final), orden por defecto y por nombre; los enlaces solo
   llevan `orden`/`gestion` cuando se apartan del defecto y volver a elegir el
   filtro lo quita conservando equipo y orden. Tipos y lint limpios.
2. **Recorrido local con sesión de administrador**, agosto 2026:
   - Resumen por equipo: AYACUCHO - MAGISTERIAL 142 · EXTERNOS 18 («Sin
     supervisor») · Huancayo 14 · MAGISTERIAL 02 2 · Sin equipo asignado 1 →
     pie **177 = «Ventas ingresadas» 177**; por recuperar 9+6+1+1 = **17 =
     «Pedidos por recuperar»**; casos 1 = 1 (AC-007). Plantilla «7/7 todos
     con ventas»; cuota de equipo 97/210 (30 × 7 por defecto).
   - Enlaces del equipo: nombre → `team=<id>`; «Por recuperar» → Pedidos con
     `status=RECOVERY&team=<id>&volver=`; «Casos» → `/recovery/sales?team=`.
   - Desglose abierto, cabecera «Cuota: Portabilidades entregadas registradas
     del 1 al 15 de agosto de 2026. Tramo en curso.»; celda «22/30 · faltan 8
     · 22 confirmadas» (AC-009).
   - `orden=CUOTA`: 22/30, 19/30, 17/30, 14/30, 11/30… (AC-010).
   - `gestion=SIN_PRODUCCION`: «0 de 14 asesores», fila «Ningún asesor cumple
     el filtro elegido», matriz oculta. `team=<EXTERNOS>&gestion=POR_RECUPERAR`:
     «2 de 2 asesores», matriz con 2 filas.
   - Con `orden=CUOTA` los accesos de Pendientes llevan
     `volver=/performance?month=2026-08&orden=CUOTA` (AC-011).
   - El orden de pantalla queda: controles → indicadores → tendencia y
     pendientes → resumen por equipo → desglose → matriz → conversión y
     composición → comisión.

**Limitación declarada**: la base local no tiene equipos con vendedores sin
producción en agosto, así que «N sin producción» del resumen por equipo se
comprobó por construcción (mismo enlace que la tarjeta) y se contrasta en
producción.

3. **Lectura de producción** (solo lectura, sesión de administrador, tras el
   despliegue de `7b457e2`, setiembre 2026, día 5):
   - Resumen por equipo: MAGISTERIAL 01 138 («Sin supervisor», 8/8) ·
     HUANCAYO - EL TAMBO 95 (Erika Lavado, 6/6) · MAGISTERIAL 02 45 (Francis
     Pary, 3/4, «1 sin producción») · EXTERNOS 0 («Sin supervisor», 0/2, «2
     sin producción»). Pie **278 = «Ventas ingresadas» 278**; por activar
     13+6+5 = **24**; por recuperar 31+27+25 = **83**; casos 35+21+14 = **70**:
     los cuatro coinciden con «Pendientes de intervención» (AC-007).
   - Cuotas de equipo fijadas (700, 300, 250) y de asesor (100, 80, 90)
     aparecen con su brecha; la celda individual añade el siguiente tramo del
     bono porque difiere de la cuota («20/100 · faltan 80 · 16 confirmadas ·
     14 confirmadas para el bono de 30») (AC-009).
   - Cabecera del desglose: «Portabilidades entregadas registradas del 1 al 15
     de setiembre de 2026. Tramo en curso.»
   - «Asesores con ventas 17/20 · 3 sin producción · ver quiénes» abre
     `gestion=SIN_PRODUCCION`: «3 de 20 asesores», desglose y matriz con las
     mismas tres personas; `team=<MAGISTERIAL 02>&gestion=SIN_PRODUCCION`:
     «1 de 4 asesores» (AC-008, AC-010).
   - `orden=CUOTA&gestion=SIN_PRODUCCION`: 0/30, 0/30, 0/70 (menor brecha
     primero); «Todos» conserva `orden=CUOTA`; los accesos de Pendientes
     llevan `volver=/performance?month=2026-09&orden=CUOTA&gestion=SIN_PRODUCCION`
     (AC-010, AC-011).
   - Enlaces del equipo con `team=<id>` a Rendimiento, Pedidos (`volver=`) y
     Recupero de ventas.

La limitación declarada en local («N sin producción» por equipo) queda cerrada
con la lectura de producción. **Hallazgo operativo**, ya conocido: dos equipos
siguen sin supervisor (MAGISTERIAL 01, EXTERNOS); ahora el tablero lo dice en
la cabecera del resumen.

## Fase 3 (05/09/2026)

1. **Pruebas** — 164 en verde en `apps/web`, 7 nuevas
   (`rendimiento-filtros-vivos.test.tsx`): el mes aplica al cambiar y
   conserva `orden`, `gestion` y el equipo; «Limpiar filtros» conserva el
   mes; sin búsqueda declarada no hay caja ni `q`; la búsqueda ignora tildes y
   mayúsculas y exige dos caracteres; el nombre del asesor siempre filtra y
   «Ver todo el equipo» quita asesor y búsqueda; `q` y `matriz` viajan; la
   ventana por defecto es 7 días en el mes en curso y mes completo en uno
   cerrado; «últimos 7 días» excluye los futuros. `rendimiento-enlaces`
   ajustado (el nombre ya no alterna). Los tres tests de
   `directorio-filtros` siguen en verde. Tipos y lint limpios.
2. **Recorrido local con sesión de administrador**, agosto 2026:
   - Barra: «Mes de la venta · Buscar asesor · Equipo · Asesor», sin botón
     «Aplicar»; «14 de 14 asesores».
   - Escribir «cuya» (clic real y teclado): la URL pasa a `?q=cuya&month=…`
     sin botón, ficha «Busca «cuya» ✕», desglose y matriz con solo Jimena
     Cuya, «1 de 14 asesores»; «Ventas ingresadas 177» no cambia (AC-012).
   - Clic en «Últimos 7 días»: `matriz=7D`, columnas 25–31 y «7 días»,
     cabecera «Últimos 7 días transcurridos (del 25 al 31). Los indicadores
     siguen contando el mes completo.»; la búsqueda se conserva (AC-015).
   - Clic en el nombre de Jimena en el desglose: `agent=<id>` se añade a la
     URL conservando `q` y `matriz`; fichas «Busca «cuya»» y «Asesor: Jimena
     Cuya»; aparece «Ver todo el equipo» → `/performance?month=2026-08&
     matriz=7D`; los accesos de Pendientes llevan `advisor=` y `volver=` con
     `agent`, `q` y `matriz` (AC-014).
   - Hallazgo corregido en el recorrido: con un asesor aislado el resumen por
     equipo mostraba una fila «Otros equipos» huérfana; sin equipos que
     resumir ya no hay resumen.
   - Orden de pantalla: cabecera → controles → indicadores → [resumen por
     equipo + pendientes] → desglose → comisión → «Análisis detallado» →
     tendencia → matriz → conversión y composición (AC-016).

**Limitación declarada**: las vistas de supervisor y de asesor se revisaron
por lectura del código, no con sesión real (no hay cuenta de prueba con esos
roles y las contraseñas no se escriben). Queda en tareas.

3. **Lectura de producción** (solo lectura, sesión de administrador, tras el
   despliegue de `6456c46`, setiembre 2026, día 5):
   - Barra en vivo «Mes de la venta · Buscar asesor · Equipo · Asesor», sin
     «Aplicar»; «19 de 19 asesores».
   - Escribir «cuya» (clic y teclado reales): URL `?q=cuya&month=2026-09`,
     ficha «Busca «cuya» ✕», desglose y matriz con solo Jimena Cuya («1 de 19
     asesores»); «Ventas ingresadas 278» y el resumen por equipo (4 filas) no
     cambian (AC-012).
   - Orden de pantalla igual al local: controles → indicadores → resumen por
     equipo + pendientes → desglose → comisión → «Análisis detallado» →
     tendencia → matriz → conversión y composición (AC-016).
   - Matriz por defecto en 7 días con solo cinco días transcurridos: columnas
     1–5 y «7 días». La cabecera decía «Últimos 7 días transcurridos (del 1 al
     5)»; se ajustó a «Días transcurridos del mes (del 1 al 5)» cuando hay
     menos de siete (AC-015).
