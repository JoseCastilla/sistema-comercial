# Tasks — SPEC-088

- [x] Inventariar referencias en `apps/`, `packages/`, `docs/specs/`,
      `.env.example` y `turbo.json`.
- [x] Confirmar que `exceljs`, `@nestjs/platform-express` y
      `DITO_IMPORT_API_URL` siguen en uso por `recovery-base`.
- [x] Borrar `apps/web/src/app/admin/dito-imports/` y
      `apps/web/src/features/dito-imports/`.
- [x] Borrar `apps/api/src/modules/dito-import/` y quitarlo de
      `app.module.ts`.
- [x] Borrar `packages/validation/src/dito-import-admin-schema.ts`, su
      prueba y su reexportación.
- [x] Quitar la sección `imports` de `commercial-app-shell.tsx` (tipo,
      prefijo, icono, entrada de escritorio y móvil); `data-items="8"` del
      administrador ahora coincide.
- [x] Quitar la aserción de `/admin/dito-imports` de `navegacion.test.ts`.
- [x] Retirar `DITO_IMPORT_INTERNAL_SECRET` de `.env.example` y `turbo.json`.
- [x] Anotar SPEC-007, 020, 021, 023 y SPEC-045 PL-10.
- [x] Tipos, lint y pruebas de `apps/web`, `apps/api` y
      `packages/validation`; compilación de `apps/api` y `apps/web`.
- [ ] Commit, entrega y comprobar en producción que `/admin/dito-imports`
      responde 404 y que el menú ya no muestra «Ventas».
- [ ] Quitar `DITO_IMPORT_INTERNAL_SECRET` de las variables de `web` y `api`
      en EasyPanel (lo hace José; no rompe nada si se queda).
- [ ] Fase 2: decidir el destino de las tablas y enums listados en la spec.
