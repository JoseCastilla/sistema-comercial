# SPEC-012 — Plan

## 1. Dominio y contrato

Separar la capacidad general de actualización de la autorización de cierre.
Centralizar las transiciones terminales en `@repo/validation` y probar la matriz
completa de roles, visibilidad y estados.

## 2. Persistencia

Agregar responsable y fecha de cierre a `DitoOrder`, la relación inversa en
`User` y un índice organizacional por fecha. La migración recuperará el último
cierre presente en `DitoOrderStatusHistory` sin inventar responsables.

## 3. Escritura segura

La acción de servidor aplicará la regla de transición después de resolver la
visibilidad actual. El cierre y su historial se escribirán juntos, conservando
el control de concurrencia existente.

## 4. Experiencia de usuario

El selector existente ocultará acciones no autorizadas. Las órdenes terminales
serán de solo lectura y la auditoría aparecerá como información secundaria en la
tarjeta.

## 5. Verificación

Ejecutar pruebas compartidas, generación Prisma, tipos, lint, builds y una
revisión visual local con perfiles autorizado y asesor. No publicar hasta la
aprobación explícita.
