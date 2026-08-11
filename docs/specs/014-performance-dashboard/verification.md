# SPEC-014 — Verificación

**Estado:** `IN_PROGRESS`
**Fecha:** 2026-08-09

## Extensión diaria local

- La extensión de 2026-08-11 expone el pulso diario también a ADMIN,
  SUPERVISOR y BACKOFFICE, respetando alcance y equipo seleccionado.
- Cada día separa ingresadas por `registeredAt`, cerradas por `closedAt` y
  pagables; el cierre diario no mueve la cohorte mensual de la orden.
- BACKOFFICE recibe conteos operativos sin potencial ni importes de comisión.
- Validación local ADMIN con datos reales: organización 18 cerradas hoy, 16
  pagables; AYACUCHO - MAGISTERIAL 12 cerradas, 11 pagables.
- A 390 px se muestran cuatro indicadores y ambas series de siete días sin
  desborde horizontal.
- 111 pruebas de dominio, tipos y lint del monorepo aprobados localmente.
- El pulso se limita al mes vigente.
- Los ingresos se agrupan por `registeredAt` y la base confirmada por `closedAt`,
  usando los límites diarios de Lima.
- La confirmación vuelve a comprobar entrega, cierre, operación comisionable y
  asesor asignado.
- Una venta puede generar potencial el día de ingreso y confirmar la base otro
  día sin salir de su cohorte mensual original.
- El respaldo del equipo actual se consulta por separado, limitado a la misma
  organización y solo cuando existe una membresía primaria activa inequívoca.
- La imagen Docker de producción compiló, inició como usuario no privilegiado y
  respondió saludable en `/api/health`.
- La validación visual con una sesión AGENT continúa como seguimiento; el
  despliegue de este incremento fue autorizado por el responsable del producto.

## Revisión del plan de origen

- El modelo ya dispone de `CommercialOperation` con portabilidad prepago,
  postpago y alta nueva; no hace falta duplicar esa clasificación.
- `closedByUserId` y `closedAt` ya existen por SPEC-012.
- Los filtros de período, rango, equipo y el alcance por rol ya pueden
  reutilizarse.
- La regla del acelerador 1 quedó confirmada: cohorte ingresada del 1 al 15 y
  confirmación posterior por entrega más cierre; 41 confirmadas pagan S/ 310.
- Comparar un mes sin antecedentes contra sí mismo fue descartado; se mostrará
  ausencia de base comparable.
- “Entregada sin activar” no se considera automáticamente pérdida o incidencia;
  se requiere estado de maduración o exclusión explícita.

## Evidencia pendiente

- Medición de consultas con volumen representativo.
- Validación visual con sesiones SUPERVISOR, AGENT y BACKOFFICE.
- Aprobación de reglas económicas y privacidad de importes.

## Evidencia local obtenida

- 111 pruebas de validación aprobadas, incluidos el potencial diario y 41
  cierres elegibles por
  S/ 310, maduración posterior a la ventana y límites mensuales de Lima.
- TypeScript y ESLint aprobados en el monorepo; Web volvió a aprobar tipos tras
  recompilar el paquete compartido.
- La compilación Next completó código, tipos y generación de páginas. Windows
  impidió únicamente el enlace simbólico del empaquetado standalone; Docker no
  está disponible en la terminal actual para repetir ese empaquetado en Linux.
- Validación visual local con sesión ADMIN y datos reales: navegación,
  selector mensual, filtro de equipo, cuatro KPIs, funnel, comisión provisional,
  desglose por asesor y estado en vivo.
- El enlace “Entregadas por activar” abrió `/orders` con el rango exacto y el
  nuevo filtro `AWAITING_ACTIVATION`.
- La conciliación ADMIN clasificó las 31 órdenes locales con motivos
  deterministas y reprodujo las 2 pagables y S/ 37.50 de comisión base del
  dashboard. El filtro `PAYABLE` devolvió exactamente esas dos filas.
- Cada línea de conciliación abre la orden origen por código y rango; la prueba
  local devolvió una sola coincidencia para la orden seleccionada.
- El detalle se pagina desde PostgreSQL en bloques de 50 y los conteos se
  calculan por condición de negocio, evitando cargar el mes completo en memoria.
- La consulta no admite meses futuros y no muestra comparación cuando el mes
  anterior carece de base.
- BACKOFFICE recibe importes financieros neutralizados; SUPERVISOR conserva el
  total agregado, pero no montos individuales por asesor.
- No se modificó el modelo de datos ni se ejecutaron migraciones.

## Salida productiva

- Commit funcional `3514ee0` publicado en `main`.
- GitHub recibió el cambio y activó el despliegue automático de EasyPanel.
- La salud pública de la Web respondió HTTP 200 con
  `service: sistema-comercial-web`.
- Durante el reemplazo, `/performance` respondió 404 desde el contenedor
  anterior; después del despliegue redirigió correctamente a `/login`, lo que
  confirma que la nueva ruta está disponible y protegida en producción.

## Decisión actual

La primera entrega local de métricas y estimación provisional está lista para
validación de negocio. La conciliación auditable, exclusiones de pago y segundo
acelerador permanecen pendientes; todavía no corresponde desplegar.
