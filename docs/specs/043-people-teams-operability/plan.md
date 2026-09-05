# SPEC-043 — Plan

## 1. Arquitectura de la fase 1

- **Estado en la URL, no en el cliente.** El panel abierto (`persona=`) y la
  creación (`nueva=1` / `nuevo=1`) viajan como parámetros: la página sigue
  siendo un componente de servidor, los filtros se conservan solos, el enlace
  se comparte y Atrás cierra el panel. Un componente cliente mínimo
  (`ReturnFocus`) enfoca la fila al volver.
- **Un panel, muchas secciones.** `PersonAdminPanel` (servidor) compone lo
  que ya existía —`PersonLifecycleActions`, `ResetUserPasswordForm`— con
  identidad, relaciones e historial. Las acciones de SPEC-042 no cambian de
  contrato; solo cambian de sitio y de disposición.
- **Estilos en `@repo/ui`** (`admin.css`): `ui-admin-workspace` (lista +
  panel, panel primero en angosto), `ui-admin-panel`, fila actual y nombre
  en dos líneas. Nada de estilos ad hoc en la página.
- **PE-01 en la acción existente.** `promotePersonAction` gana `salesMode`
  (`MOVE` | `KEEP`); `KEEP` conserva la membresía de venta y crea la de
  supervisión sin venta. El modelo ya lo admite (SPEC-001 BR-004) y el
  alcance del supervisor no cambia: supervisa lo que tiene membresía
  `SUPERVISOR`, vende donde tiene `salesEnabled`.

## 2. Fases siguientes

- **Fase 2** trabaja sobre Equipos: métricas con definición, indicadores que
  abren filtros y la vista previa de deshabilitar con conteos, reutilizando
  `getPersonLifecycleOverview` para el trabajo abierto por persona.
- **Fase 3** trae la barra en vivo (una variante de `QueueFilters` sin
  vocabulario de recupero, o una extracción del núcleo de navegación por URL)
  y las acciones de equipo que faltan de SPEC-001.

## 3. Verificación

Pruebas web del panel y de la promoción; recorrido local con sesión de
administrador sobre cuentas de prueba; lectura de producción tras el
despliegue.
