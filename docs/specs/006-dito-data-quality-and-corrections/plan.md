# SPEC-006 — Plan

1. Endurecer la extensión: comprobar que `.detalle_sub` ya fue desplegado manualmente, detectar secuencias `N/A` y validar campos.
2. Detectar placeholders en el API sin rechazar capturas de extensiones antiguas.
3. Conservar esas capturas como `PARTIAL`/`NEEDS_REVIEW` para corrección manual.
4. Crear historial de corrección con fuente `MANUAL_ADMIN`.
5. Añadir formulario administrativo en el detalle de `/orders`.
6. Mostrar estado de calidad separado del estado de asociación.
7. Probar extensión, API, concurrencia, autorización y auditoría.
8. Desplegar después de validar SPEC-005 y SPEC-006 como un solo paquete.

## Seguridad y evidencia

- Las acciones manuales requieren `requireAdminAccess`.
- La orden se busca siempre por `organizationId` e `id`.
- `updatedAt` actúa como versión para evitar sobrescrituras concurrentes.
- El historial usa JSON para conservar el conjunto exacto de campos afectados.
- El resumen original y `additionalDetails` de ingreso no se editan manualmente.
