# SPEC-012 — Verificación

**Estado:** `DEPLOYED`
**Fecha:** 2026-08-09

## Evidencia obtenida

- 94 pruebas de `@repo/validation` aprobadas, incluidas la matriz explícita de
  cierre, la inmutabilidad terminal y el motivo de cancelación.
- Prisma Client generado y migración
  `20260809120000_add_controlled_dito_order_closure` aplicada únicamente en
  PostgreSQL local.
- Auditoría local: 3 órdenes cerradas, 3 cierres atribuidos, 0 sin atribución,
  0 cierres propios históricos y 0 pares de auditoría inconsistentes.
- TypeScript y ESLint aprobados en Validación, Base de Datos, API y Web.
- Compilación Nest aprobada.
- La compilación nativa de Next completó código, tipos y páginas; el empaquetado
  final encontró la restricción de enlaces simbólicos de Windows.
- Imágenes Docker de Web y API construidas correctamente en Linux, incluyendo
  el empaquetado standalone utilizado por EasyPanel.
- Revisión visual local como administrador: `CLOSED` disponible en orden activa,
  cierre histórico visible con autor/fecha, orden terminal en solo lectura y
  motivo obligatorio al seleccionar `CANCELLED`.
- La defensa para `AGENT` se verificó en la regla compartida consumida por la
  acción de servidor; no se alteraron sesiones ni pedidos para probarla.
- API local saludable y Web local disponible después del reinicio.

## Salida

- Implementación publicada mediante el commit `ef92380`.
- API reiniciada después de migraciones con PostgreSQL `up`.
- Web productiva respondió HTTP 200 y las rutas privadas conservaron su control
  de acceso.
