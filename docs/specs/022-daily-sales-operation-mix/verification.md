# Verificación

## Automatizada

- `pnpm check-types`
- `pnpm lint`

Resultado: tipos y lint sin errores.

## Manual

- `/performance` del mes vigente muestra el mix de hoy, semana y mes.
- Cada columna suma el total de ventas ingresadas en su período.
- Un asesor ve solo sus cantidades.
- ADMIN y SUPERVISOR respetan el filtro de equipo.
- La vista de equipo permite desplegar el detalle por asesor.
- Las operaciones no clasificadas aparecen como advertencia cuantificada.
- La interfaz funciona en tema claro, oscuro y pantallas estrechas.

La vista de administrador se verificó en navegador local con tema oscuro. La
matriz mostró 31 ventas del mes distribuidas en 4 altas nuevas, 1 portabilidad
de origen prepago y 26 de origen postpago; cada período comunica también sus
totales en cero sin ocultarlos.
