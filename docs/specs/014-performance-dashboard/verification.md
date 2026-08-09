# SPEC-014 — Verificación

**Estado:** `LOCAL_VERIFIED`
**Fecha:** 2026-08-09

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

- 110 pruebas de validación aprobadas, incluidos 41 cierres elegibles por
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
- No se modificó el modelo de datos, no se ejecutaron migraciones y no hubo
  despliegue.

## Decisión actual

La primera entrega local de métricas y estimación provisional está lista para
validación de negocio. La conciliación auditable, exclusiones de pago y segundo
acelerador permanecen pendientes; todavía no corresponde desplegar.
