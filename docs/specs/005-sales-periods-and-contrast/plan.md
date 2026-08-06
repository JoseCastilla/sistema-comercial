# SPEC-005 — Plan de implementación

## 1. Capa temporal compartida

- Crear un esquema `orderPeriodSchema` con `today`, `week`, `month` y `history`.
- Implementar una función pura que produzca `{ start, end }` para
  `America/Lima`; convertir los límites a UTC solo al construir la consulta.
- Limitar `week` al inicio del mes cuando la semana cruce un cambio de mes.
- Cubrir medianoche, lunes, primer día del mes y cambio de año con pruebas.

## 2. Consulta y exactitud

- Cambiar `getOrderInbox` para recibir filtros validados desde la URL.
- Aplicar organización, alcance de rol, período, estado y búsqueda en `where`.
- Obtener en una transacción consistente:
  - conteos agregados del período;
  - cantidad de activos anteriores al período;
  - página solicitada de órdenes.
- Sustituir los topes de 200/30 por paginación con tamaño inicial de 50.
- Revisar el plan SQL y añadir índices por `organizationId`, `registeredAt` y
  agente solo si la medición demuestra que son necesarios.

## 3. Estado de URL e interfaz

- Leer `period`, `status`, `q` y `page` desde `searchParams` del servidor.
- Usar enlaces o navegación reemplazable para conservar historial y accesibilidad.
- Mostrar `Hoy`, `Semana` y `Mes actual` en el control principal; ubicar
  `Histórico` como acción secundaria para evitar cargas accidentales.
- Reiniciar página cuando cambie período, estado o búsqueda.
- Explicar siempre el alcance: “Ventas de hoy”, no un número sin contexto.

## 4. Excepciones operativas

- Mantener el período como vista de ventas registradas.
- Calcular aparte órdenes activas anteriores al inicio del mes.
- Mostrar “Pendientes anteriores” con conteo y acceso directo a una vista
  operativa sin límite temporal, evitando que el valor predeterminado oculte trabajo.

## 5. Contraste y arquitectura visual

- Ajustar exclusivamente tokens y patrones compartidos en `packages/ui`.
- Reforzar canvas/surface, bordes, texto secundario, campos y selección.
- Mantener el verde de producto para acción; reservar rojo, ámbar y azul para estado.
- Auditar `/orders`, `/admin/users`, `/admin/teams`, `/login` y estados vacíos.
- Verificar modo normal, foco, hover, disabled y pantallas de 360/1280 px.

## 6. Pruebas y despliegue

- Pruebas unitarias de intervalos y validación de parámetros.
- Pruebas de repositorio con más de 200 órdenes y aislamiento multiempresa.
- Tipos, lint, suites y builds Docker Web/API.
- Prueba de usabilidad por rol y evidencia visual antes/después.
- Despliegue único a `main`, seguido de verificación productiva.

## Riesgos y mitigaciones

- **Ocultar pendientes antiguos:** indicador transversal y acceso explícito.
- **Conteos distintos a la lista:** una sola definición server-side de filtros.
- **Errores de zona horaria:** intervalos puros probados y UTC solo en persistencia.
- **Degradación por agregados:** consulta acotada, paginación y análisis de índices.
- **Contraste agresivo:** validación visual con datos reales, no solo ratios aislados.
