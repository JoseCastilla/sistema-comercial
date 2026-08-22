# Verificación

## Automatizada

- `pnpm --filter @repo/validation test`
- `pnpm check-types`
- `pnpm lint`

Resultado: 121 pruebas aprobadas; tipos y lint sin errores.

## Manual

- Una vista previa muestra `Eliminar vista previa`.
- La acción solicita confirmación.
- Una carga confirmada no muestra acción de eliminación.
- Una versión obsoleta recibe un conflicto y no se elimina.
- Al eliminar, la página vuelve al historial vigente.

La interfaz se verificó con el lote local sin ejecutar la eliminación. La carga
confirmada no presentó el control destructivo.
