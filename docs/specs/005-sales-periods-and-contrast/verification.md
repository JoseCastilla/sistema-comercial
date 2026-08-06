# SPEC-005 — Verificación

**Estado:** `IMPLEMENTED_PENDING_PRODUCTION`

## Evidencia local

- `/orders` abre en `MONTH` cuando la URL no incluye período.
- `TODAY` y `WEEK` usan límites de `America/Lima`; la semana nunca cruza al mes anterior.
- Período, estado, búsqueda y página se aplican en PostgreSQL y permanecen en la URL.
- Los conteos describen el período completo y la lista pagina 50 ventas por vez.
- Los pendientes anteriores aparecen separados y el histórico requiere una acción explícita.
- Se añadió el índice `dito_orders_org_registered_idx` para organización y fecha.
- 73 pruebas de validación aprobadas, incluyendo cuatro escenarios temporales.
- Tipos y lint de Database, Validation, UI y Web aprobados.
- Imágenes Docker Linux de API y Web construidas correctamente.
- Revisión visual de `/orders` aprobada en móvil y escritorio a 1280 px.

## Pendiente

- Validar producción con el volumen real del mes.
- Confirmar contraste en Personas, Equipos y Login con datos productivos.
- Probar más de 200 ventas y roles SUPERVISOR/AGENT con fixtures dedicados.
