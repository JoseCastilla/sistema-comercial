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
