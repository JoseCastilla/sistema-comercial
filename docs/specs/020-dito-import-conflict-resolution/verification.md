# Verificación

## Automatizada

- Pruebas del lector XLSX.
- Pruebas de clasificación y confirmación.
- Pruebas de validación compartida.
- Lint y comprobación de tipos de API y web.
- 85 pruebas de API aprobadas, incluidas confirmación vigente y resolución obsoleta.

## Funcional

1. Generar una vista previa de `ventas 0108.xlsx`.
2. Comprobar que `1941795020A` no tenga conflicto de DNI.
3. Resolver los conflictos restantes seleccionando una fuente por campo.
4. Recargar y confirmar que las decisiones se conservan.
5. Confirmar que el lote no modifica órdenes antes de la confirmación final.

Resultado local: `1941795020A` quedó sin conflicto; la comparación visible conserva el sistema por defecto y presenta valores comerciales legibles. La confirmación reaplica una decisión solo cuando los valores actual y entrante coinciden con los que revisó el administrador; una modificación posterior vuelve a bloquear la fila.
