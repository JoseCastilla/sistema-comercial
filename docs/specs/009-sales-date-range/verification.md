# SPEC-009 — Verificación

**Estado:** `VERIFIED`
**Fecha:** 2026-08-08

## Evidencia automatizada

- `pnpm --filter @repo/validation test`: 113 pruebas aprobadas.
- `pnpm check-types`: 7 tareas aprobadas.
- `pnpm lint`: 7 tareas aprobadas sin advertencias.

## Validación funcional

- `/orders?period=YESTERDAY` mostró Ayer como período activo.
- El rango 01/08/2026–02/08/2026 produjo la URL RANGE esperada y la etiqueta
  `Del 01/08/2026 al 02/08/2026`.
- La recarga conservó `from` y `to`.
- El enlace del filtro Activos conservó período, fechas y añadió `status=ACTIVE`.
- Un rango invertido volvió a Mes actual de forma segura.

## Corrección 2026-08-11

- Desde y Hasta exponen `2026-08-11`, día actual de Lima, como fecha máxima.
- El rango 01/08/2026–05/08/2026 actualizó resultados y cerró el formulario.
- La URL conservó período, fechas y el filtro operativo activo.
- Una URL manipulada con fecha 12/08/2026 volvió de forma segura a Mes actual.
- Se añadió defensa de servidor para rechazar rangos futuros manipulados por URL.

## Despliegue

Autorizado por el usuario el 2026-08-08 después de la verificación local.
