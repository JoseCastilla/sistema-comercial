# SPEC-007 — Plan

1. Registrar el catálogo confirmado de operador DITO y un catálogo UBIGEO
   versionado.
2. Crear un parser XLSX desacoplado, basado en encabezados y cubierto con el
   archivo real anonimizado como fixture.
3. Crear identidad externa `Usuario DITO → usuario comercial` con unicidad por
   organización.
4. Crear lote y filas de importación para vista previa y auditoría.
5. Reutilizar las reglas de normalización, calidad, idempotencia y SLA de DITO.
   Clasificar cada fila como nueva, enriquecible, idéntica, conflictiva o
   excluida.
6. Construir la pantalla ADMIN de carga, resumen, resolución de asesores y
   confirmación.
7. Añadir resultados descargables y enlace desde cada pedido al lote de origen.
8. Validar primero en local con el archivo del 01/08 y después desplegar Web/API
   antes de ejecutar la carga de producción.
9. Leer `Origen Portabilidad` como fuente explícita de prepago/postpago. El plan
   solo aporta el cargo fijo y nunca determina el origen de la portabilidad.
10. Invalidar portabilidades sin origen reconocido y retirar la confirmación de
    vistas previas creadas con una versión anterior del parser.

## Arquitectura de seguridad

- El archivo se procesa en servidor y no se expone a otros usuarios.
- La vista previa queda vinculada a organización y actor.
- La confirmación usa el identificador del lote, no datos editables enviados por
  el navegador.
- Cada fila se confirma dentro de una transacción y vuelve a comprobar el pedido
  contra el estado actual.
- Los pedidos existentes solo reciben campos faltantes previamente mostrados en
  la vista previa. Los conflictos requieren una acción administrativa separada.
- Cada enriquecimiento conserva historial con fuente `DITO_BATCH_IMPORT`.
