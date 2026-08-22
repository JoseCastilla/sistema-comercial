# Verificación — SPEC-023

## Automatizada

- `dito-xlsx-parser.spec.ts`: 8 pruebas aprobadas.
- Suite completa de API: 86 pruebas aprobadas.
- Tipos de todo el monorepo: aprobados.
- Lint de todo el monorepo: aprobado.
- Caso fijo aprobado: excluido con `NON_MOBILE_PRODUCT` y sin errores móviles.
- Caso fijo pendiente: excluido con el motivo de producto y su estado DITO.
- Caso convergente: componente móvil conservado como importable.

## Operativa pendiente

1. Eliminar la vista previa no confirmada de `ventas 0308.xlsx` generada con parser 1.6.
2. Volver a cargar el mismo archivo.
3. Confirmar que las dos ventas Hogar de Erika Lavado aparezcan como excluidas.
4. Confirmar que el lote ya no tenga una fila inválida causada por esos pedidos.
5. Confirmar que ninguna venta Hogar llegue a la bandeja, al mix ni a las comisiones móviles.

No se requiere cambio de esquema ni intervención manual en PostgreSQL.
