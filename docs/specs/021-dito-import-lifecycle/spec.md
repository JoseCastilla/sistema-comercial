# SPEC-021 — Ciclo de vida de cargas DITO

## Objetivo

Permitir que un administrador retire vistas previas obsoletas sin perder la trazabilidad de ventas ya incorporadas.

## Reglas

- Solo ADMIN puede eliminar una carga.
- Solo se eliminan lotes `PREVIEW`, `READY` o `FAILED` sin fecha de confirmación.
- `CONFIRMING` y `CONFIRMED` nunca se eliminan desde la interfaz.
- La operación valida `updatedAt` para impedir borrar una carga que cambió en otra sesión.
- Al eliminar el lote, sus filas de análisis se eliminan por cascada; las órdenes comerciales no se modifican.
- La lista principal conserva un máximo de ocho cargas recientes para evitar ruido visual.
