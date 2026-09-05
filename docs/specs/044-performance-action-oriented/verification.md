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
