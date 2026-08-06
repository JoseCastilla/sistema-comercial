# SPEC-008 — Verificación

**Estado:** `IMPLEMENTED`
**Fecha:** 2026-08-06

## Evidencia local

- La migración `20260806170000_add_dito_order_notifications` se aplicó a
  PostgreSQL local correctamente.
- Una prueba de integración ejecutó un `UPDATE` sin modificar el valor visible y
  recibió `organizationId`, `orderId` y operación `UPDATE` mediante
  `LISTEN/NOTIFY`.
- `/api/orders/stream` respondió HTTP 401 sin sesión autenticada.
- Database y Web aprobaron lint, generación de Prisma y comprobación de tipos.
- Las imágenes Docker Web y API compilaron correctamente. La imagen Web incluye
  la ruta dinámica `/api/orders/stream`; la imagen API incluye la migración que
  se ejecuta antes de aceptar tráfico.

## Validación pendiente

- La prueba visual automatizada entre dos pestañas fue interrumpida por la
  política del navegador después de reiniciar el servidor local; no se intentó
  eludirla.
- Falta verificar en producción con dos sesiones autenticadas que una muestre el
  cambio realizado por la otra en menos de dos segundos.
- Hasta completar esa prueba, SPEC-008 permanece `IMPLEMENTED` y no `VERIFIED`.
