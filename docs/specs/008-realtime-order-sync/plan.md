# SPEC-008 — Plan

1. Crear una función y trigger PostgreSQL de notificación para `dito_orders`.
2. Exponer un cliente PostgreSQL de notificaciones desde el paquete de base de
   datos.
3. Implementar un bus Web singleton con reconexión y filtrado por organización.
4. Crear el endpoint SSE autenticado `/api/orders/stream`.
5. Añadir el cliente de sincronización, indicador visual y respaldo periódico.
6. Validar con dos pestañas locales, restaurar el dato de prueba y ejecutar build
   Docker.
7. Desplegar Web y migración antes de probar con usuarios reales.
