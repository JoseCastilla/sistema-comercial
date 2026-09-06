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

## Fase 4 · Supervisor (05/09/2026)

0. **Origen**: lectura en producción con la sesión de supervisor de HUANCAYO -
   EL TAMBO antes de tocar nada. SUP-01 ya resuelto: con `agent=` los cuatro
   accesos llevan `advisor=` y `volver=…&agent=`; «Pedidos por recuperar 7» →
   Pedidos con 7 órdenes y «← Volver a Rendimiento». Cuotas mostraba
   «Organización · Repartida entre los equipos: 300 de 300» (era la suma del
   único equipo) y el equipo «Faltan 30 por repartir de los 300».
1. **Pruebas** — 170 en verde en `apps/web`, 6 nuevas
   (`rendimiento-supervisor.test.tsx`): resumen de actividad sin días futuros;
   «Sin ventas hoy» exige mes en curso y vendedor activo; ninguna definición
   habla de ausencia; orden por bono; reparto de menos / justo / de más;
   cambiar de equipo vacía `agent`. Tipos y lint limpios.
2. **Recorrido local con sesión de administrador**, setiembre 2026:
   - Cabecera: «Ventas ingresadas 0 · 0 frente a 135 en los días 1–5 del mes
     pasado (-100%)».
   - Desglose: columnas «Asesor · Hoy · Ingresadas · Vs. mes pasado · Última
     venta · Tasa de entrega · Cuota · Pagables · …»; fila «Sin ventas en el
     mes · 0 de 5 días con ventas»; fichas «Sin ventas hoy · Sin ventas en el
     mes · …» y «Bono: más cerca del siguiente tramo»; `gestion=SIN_VENTAS_HOY`
     → «13 de 14 asesores» con la definición «Es un dato de ventas, no de
     presencia»; `orden=BONO` activo.
   - Cuotas (ADMIN): «Objetivo de la organización: 390. Repartido: 390, justo
     el objetivo. Sin cuota fijada…»; equipo «Objetivo del equipo: 60.
     Repartido: 60, justo el objetivo. Cuota de equipo por defecto: 2
     vendedores × tramo.» con `data-tone="EXACT"`.
   - `team=<EXTERNOS>&agent=<Alexandra>`: aviso «… no está entre los vendedores
     activos del equipo filtrado … Ver todo el equipo» y fichas de equipo y
     asesor.

3. **Lectura de producción con la sesión de supervisor** (solo lectura,
   HUANCAYO - EL TAMBO, tras el despliegue de `7f5176c`, setiembre 2026, día 5):
   - Tarjeta principal: «Ventas ingresadas 95 · 95 frente a 13 en los días
     1–5 del mes pasado (+630.8%)» (AC-020).
   - Desglose: «Asesor · Hoy · Ingresadas · Vs. mes pasado · Última venta ·
     Tasa de entrega · Cuota · …»; Christian Ruiz «Hoy 2 · Día 5 · 5 de 5
     días con ventas», Silvia Sinchi «Hoy 5 · Día 5 · 4 de 5 días con
     ventas»; `gestion=SIN_VENTAS_HOY` → «0 de 6 asesores» con la definición
     «Es un dato de ventas, no de presencia» (AC-018).
   - `orden=BONO`: Christian 19 → Silvia 20 → Sarai 22 → Steven 22 → Francesco 24 → Jhesel 29 confirmadas faltantes para el bono de 30 (AC-019).
   - Cuotas: cabecera «Equipos a tu cargo · Objetivo de tus equipos · La cuota
     de tu equipo para el tramo es 300. La fija administración; tú la repartes
     entre tus asesores. No es la cuota de la organización.» Equipo: «Objetivo
     del equipo: 300. Repartido: 270. Faltan 30 por repartir.» con
     `data-tone="UNDER"` (AC-017). El «330 frente a 300» del plan ya no estaba
     en producción: el reparto vigente es 270.
   - Fichas de gestión: «Sin ventas hoy · Sin ventas en el mes · Con entregas
     por activar · Con pedidos por recuperar · Cuota pendiente»; orden con
     «Bono: más cerca del siguiente tramo».

**Pendiente** (validaciones del plan): vista de asesor con su propia sesión,
supervisor habilitado también para vender y supervisor con varios equipos.

## Fase 5 · Asesor (05/09/2026)

0. **Origen**: lectura en producción con la sesión de asesor antes de tocar
   nada. Filtros: solo «Mes de la venta». Pendientes: 2 por activar, 7 por
   recuperar, 8 casos. Comisión: «Bono del 25 a fin de mes: te falta 15
   cerradas» el día 5 (ASE-02 real); pulso «Sigue cuidando la entrega…» fijo
   (ASE-03); Pedidos «5 pendientes de meses anteriores» sin eco en Rendimiento
   (ASE-04); conciliación con «Sin asesor responsable» y columna Asesor
   repitiendo «Jimena Cuya» (ASE-06); sin ninguna mención a la cuota (ASE-01).
1. **Pruebas** — 177 en verde en `apps/web`, 7 nuevas
   (`rendimiento-asesor.test.ts`): estados de ventana el día 5, el 20 y en
   mes cerrado; consejo con cero por activar y sin pendientes; enlace de
   anteriores con rango, `status=ACTIVE`, alcance y `volver`; en vista
   personal sin asesor ni equipo. Tipos y lint limpios.
2. **Recorrido local con sesión de administrador** (la vista personal exige
   sesión de asesor; se contrasta en producción):
   - «Pendientes de meses anteriores a setiembre de 2026 · 42» con enlace
     `period=RANGE&from=2026-08-03&to=2026-08-31&status=ACTIVE&volver=…`;
     paridad con Pedidos: 42 = 42 órdenes, con «← Volver a Rendimiento». (Un primer intento usaba `filter=` y abría
     143: Pedidos llama `status` a ese parámetro; corregido antes de entregar.)
   - Comisión (setiembre, día 5): «Bono días 1 al 15 · en curso» y «Bono del
     25 a fin de mes · por comenzar · Comienza el día 25 · Entran las ventas
     registradas del 25 al 30…»; agosto: ambas «· cerrado» con su resultado.
   - Conciliación de ADMIN intacta: columna Asesor y opción «Sin asesor
     responsable» siguen.

3. **Lectura de producción con la sesión de asesor** (solo lectura, Jimena
   Cuya, tras el despliegue de `78774f7`, setiembre 2026, día 5):
   - Orden de pantalla: cabecera → controles → indicadores → [cuota personal +
     pendientes] → «Tu día de hoy» → comisión → «Análisis detallado» → ritmo
     del mes → conversión y composición (AC-026).
   - «Cuota del tramo · días 1 al 15 · La fija tu supervisor · solo lectura»:
     «Portabilidades entregadas 15/100 · 15% de la cuota · faltan 85
     entregadas», cohorte «registradas del 1 al 15 de setiembre de 2026. Tramo
     en curso.», «Las altas nuevas no cuentan», «Bono del tramo (otra cosa): 13
     confirmadas · faltan 17 para el tramo de 30». La cuota **15/100 coincide**
     con la fila de Jimena que veía administración (AC-022).
   - Comisión: «Bono días 1 al 15 · en curso · 13 cerradas de 21 registradas
     del 1 al 15 · 2 entregadas por activar»; «Bono del 25 a fin de mes · por
     comenzar · Comienza el día 25 · Entran las ventas registradas del 25 al
     30…»; el «te falta 17 cerradas para llegar a 30 y sumar S/ 200.00» solo
     aparece para la ventana en curso (AC-023).
   - Pulso: «4 ventas ingresadas hoy y 5 cierres registrados. 2 ventas
     entregadas esperan activarse: todavía no pagan. 7 pedidos del mes no se
     entregaron o se cancelaron: revísalos por si alguno se puede reingresar.
     8 casos abiertos en Recupero de ventas con cadencia por cumplir.»
     (AC-024).
   - «Pendientes de meses anteriores a setiembre de 2026 · 5» →
     `period=RANGE&from=2026-08-10&to=2026-08-31&status=ACTIVE` → Pedidos con
     **5** órdenes (AC-025); coincide con «5 pendientes de meses anteriores»
     de Pedidos.
   - Conciliación: columnas «Orden · Cliente · Operación · Resultado ·
     Comisión fija», sin «Sin asesor responsable» (AC-027).

**Pendiente** (validaciones del plan del supervisor): supervisor habilitado
también para vender y supervisor con varios equipos.

## Fase 6 · Supervisor que vende (05/09/2026)

0. **Origen**: lectura en producción con la sesión de Francis Pary
   (supervisor y vendedor de AYACUCHO - MAGISTERIAL 02). «Mi equipo»: filtros
   «Mes · Buscar asesor · Vista · Equipo · Asesor»; resumen «3/4 · 1 sin
   producción · 15/250»; desglose con su propia fila (0, 0). «Mi rendimiento»:
   cuota 0/70 (la misma que ve administración), pendientes 0 / 0 / 1 caso;
   pero «Casos de recupero abiertos 1» → `/recovery/sales` (bandeja de sus
   equipos: 14), «Entregadas por activar 0» → Pedidos de sus equipos (10) y
   «Revisar cálculo» → conciliación «Mis equipos» (45 órdenes). «Asignar
   cuotas» visible en la vista personal. En Cuotas podía fijar su propia
   cuota.
1. **Pruebas** — 180 en verde en `apps/web`, 3 nuevas
   (`rendimiento-supervisor-vendedor.test.ts`): Pedidos, anteriores y Recupero
   llevan su id; la conciliación se abre por él; un asesor sigue sin asesor ni
   equipo. Tipos y lint limpios.
2. **Destinos comprobados en producción con su sesión antes de entregar**
   (solo lectura): Pedidos con advisor=<él> devuelve 0 (= 0 por recuperar); Recupero con advisor=<él> «Casos abiertos 1» (= 1); conciliación con agent=<él> muestra su nombre y 0 órdenes (= 0 ingresadas).
