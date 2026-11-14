# Verificación — SPEC-088

## Auditoría previa — 13/11/2026

Referencias encontradas antes de borrar:

- Web: `app/admin/dito-imports/page.tsx` (sin `loading`/`error` propios; los
  de `app/admin/` son compartidos y se conservan),
  `features/dito-imports/components/*` (7) y `features/dito-imports/server/*`
  (9, incluido `read-api-error.ts`, que solo usaba el importador; Campañas
  tiene su propia copia en `recovery-internal-request.ts`).
- API: `modules/dito-import/*` (13 archivos con el catálogo INEI). Ningún
  otro módulo importaba de él; él usaba `dito/dito-sla` y
  `database/*`, que se quedan.
- Validación: `dito-import-admin-schema.ts` y su prueba; ningún otro
  consumidor.
- Menú: `components/layout/commercial-app-shell.tsx` (sección `imports`,
  prefijo, icono `sales`, entrada de escritorio y móvil) y una aserción en
  `__tests__/navegacion.test.ts`.
- Otras pantallas (Pedidos, Rendimiento, «Pendientes por resolver o
  cubrir», Logística): ningún enlace ni texto que remitiera al importador.
  Las «importaciones» de `features/agr-delivery` son las de Máximo, no esta.
- Configuración: `DITO_IMPORT_INTERNAL_SECRET` en `.env.example` y
  `turbo.json`; `DITO_IMPORT_API_URL` también la usa
  `features/recovery/server/recovery-internal-request.ts` (se conserva).
- Dependencias: `exceljs` y `@nestjs/platform-express` los usa
  `recovery-base` (se conservan). En la web el importador no traía
  dependencias propias.
- Lectores de evidencia histórica: ningún código lee
  `DITO_BATCH_IMPORT`, `ditoImportBatchId` ni `DitoAgentIdentity` fuera del
  importador; no había nada que conservar en ese sentido.
- Menú móvil del administrador: declaraba `data-items="8"` con nueve
  entradas; tras el retiro tiene ocho y coincide.

## Automatizada — 13/11/2026 (local)

- [x] **AC-003:** `git grep -i "dito-import\|DitoImport\|ditoImport\|DITO_IMPORT_INTERNAL_SECRET" -- apps packages turbo.json .env.example`
      (excluidos esquema Prisma, cliente generado y `apps/crm`) sin
      resultados.
- [x] **AC-004:** `exceljs` y `@nestjs/platform-express` siguen en
      `apps/api/package.json` e importados por `recovery-base`.
- [x] Reconstruidos `@repo/database` y `@repo/validation`; se borraron de
      `packages/validation/dist` los cuatro archivos compilados del esquema
      retirado.
- [x] **AC-005:** `pnpm --filter @repo/validation test`: 406 pruebas, 0
      fallos. `lint` y `check-types` sin errores.
- [x] **AC-005:** `pnpm --filter api check-types`, `lint` y `test`
      (10 suites, 54 pruebas) en verde; `pnpm --filter api build` correcto,
      `dist/modules` ya no tiene `dito-import`.
- [x] **AC-005:** `pnpm --filter web check-types`, `lint` y `test`
      (51 archivos, 327 pruebas) en verde.
- [~] **AC-005:** `pnpm --filter web build`: compila, pasa TypeScript y
      genera las 27 páginas; falla al final al copiar la salida `standalone`
      con `EPERM: operation not permitted, symlink` (permiso de enlaces
      simbólicos de Windows, ajeno a este cambio). El manifiesto de rutas
      ya no contiene `/admin/dito-imports`.

## Producción

- [ ] **AC-001 / AC-002:** tras desplegar, `/admin/dito-imports` responde
      404 y el menú del administrador (lateral y móvil) no muestra «Ventas».
