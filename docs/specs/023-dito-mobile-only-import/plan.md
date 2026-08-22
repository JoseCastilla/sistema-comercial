# Plan — SPEC-023

1. Reconocer las columnas DITO de servicio fijo sin convertirlas en campos obligatorios.
2. Detectar ventas exclusivamente fijas mediante señales positivas de producto fijo y ausencia simultánea de número y operación móvil.
3. Clasificar esas filas como excluidas con un motivo explícito y omitir validaciones propias de móviles.
4. Mantener importables las ventas convergentes que incluyan una operación móvil válida.
5. Incrementar la versión del parser para impedir la confirmación de vistas previas antiguas.
6. Mostrar el motivo en la interfaz administrativa y verificar con pruebas automatizadas.
