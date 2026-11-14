# Plan — SPEC-088

1. Inventariar referencias (`dito-import`, `ditoImport`, `DitoImport`,
   `dito_import`, `dito-imports`, `internal/dito-import`,
   `DITO_IMPORT_*`) y cada símbolo exportado por lo que se borra; decidir
   archivo por archivo borrar, editar o conservar.
2. Comprobar lo compartido antes de borrar: `exceljs`,
   `@nestjs/platform-express` y `DITO_IMPORT_API_URL` los usa
   `recovery-base`; `dito-sla` y `DatabaseService` los usa el webhook; el
   módulo de la API no exportaba nada que otro módulo importara.
3. Borrar `apps/web/src/app/admin/dito-imports/`,
   `apps/web/src/features/dito-imports/`,
   `apps/api/src/modules/dito-import/` y
   `packages/validation/src/dito-import-admin-schema.ts` con su prueba.
4. Quitar `DitoImportModule` de `app.module.ts` y la reexportación de
   `packages/validation/src/index.ts`.
5. Quitar del menú la sección `imports`: tipo `ActiveSection`, prefijo de
   ruta, icono `sales`, entrada de escritorio y entrada móvil; revisar
   `data-items`.
6. Quitar de `navegacion.test.ts` la aserción sobre `/admin/dito-imports`.
7. Retirar `DITO_IMPORT_INTERNAL_SECRET` de `.env.example` y `turbo.json`;
   conservar `DITO_IMPORT_API_URL` con una nota de que la usa Campañas.
8. Anotar SPEC-007, 020, 021, 023 y SPEC-045 PL-10.
9. Reconstruir `@repo/database` y `@repo/validation`; tipos, lint, pruebas
   y compilación de `apps/web`, `apps/api` y `packages/validation`.
10. Fase 2 (fuera de esta entrega): decisión de José sobre las tablas.
