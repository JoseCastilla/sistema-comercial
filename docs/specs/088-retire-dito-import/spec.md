# SPEC-088 — Retiro del importador de reportes DITO

**Estado:** `ENTREGADA` — en `main` el 13/11/2026; falta registrar la lectura de producción. La fase 2 (base de datos) la decide José

**Versión:** 1.0
**Fecha:** 2026-11-13

## Problema

«Ventas — carga y revisión DITO» (`/admin/dito-imports`) permitía al
administrador subir el reporte XLSX de la bandeja DITO, ver una vista previa
fila por fila (nuevo, completa datos, igual, conflicto, identidad sin
resolver), resolver identidades y conflictos y confirmar la carga. Lo
describen SPEC-007, SPEC-020, SPEC-021, SPEC-023 y SPEC-045 PL-10.

José confirmó el 13/11/2026 que no se necesita: todas las ventas entran por
la extensión del navegador (`apps/dito-extension` → n8n →
`POST /api/v1/webhooks/dito`). En producción el importador tiene **0 cargas
en toda su historia** (auditoría de uso real del 14/10/2026). Ocupaba una
entrada del menú del administrador, un módulo de la API con su secreto
interno y un esquema de validación sin aportar trabajo.

## Objetivo

Que el importador deje de existir como código de aplicación —ruta, menú,
acciones de servidor, módulo de la API, esquemas y pruebas— sin tocar la
base de datos ni nada de la entrada de ventas por la extensión.

## Reglas de negocio

- **BR-001:** se retira completo: la página `/admin/dito-imports`, sus
  componentes y acciones (`apps/web/src/features/dito-imports`), el módulo
  `apps/api/src/modules/dito-import` (controlador `internal/dito-import`,
  vista previa, confirmación, lector XLSX, firma interna y el catálogo INEI
  de provincias que solo usaba él) y los esquemas de
  `packages/validation/src/dito-import-admin-schema.ts`. No queda página
  vacía ni redirección: la ruta responde 404 (mismo criterio que SPEC-051
  BR-001).
- **BR-002:** la base de datos no se toca en esta spec: ni modelos, ni
  tablas, ni columnas, ni enums, ni migraciones. Lo que queda sin lector se
  lista en «Fase 2».
- **BR-003:** se conserva todo lo que no es el importador: el webhook DITO,
  la extensión, la corrección manual de datos del pedido («Corregir datos
  recibidos de DITO»), `dito-sla`, los alias de asesores y su gestión en
  Personas, y la carga de la base de Campañas (`recovery-base`), que se
  construyó clonando el patrón del importador y sigue leyendo XLSX/CSV.
- **BR-004:** la evidencia es inmutable: si existiera una corrección con
  origen `DITO_BATCH_IMPORT` o un pedido enlazado a un lote, sigue en la base
  tal cual (en producción no hay ninguna, porque no hubo cargas).
- **BR-005:** la variable `DITO_IMPORT_INTERNAL_SECRET` se retira de
  `.env.example` y de `turbo.json`. `DITO_IMPORT_API_URL` **se conserva con
  su nombre**: la usa la carga de la base de Campañas
  (`features/recovery/server/recovery-internal-request.ts`) y renombrarla
  exigiría cambiar la configuración de EasyPanel.
- **BR-006:** las specs que crearon el importador no se reescriben: llevan
  una nota «Retirado por SPEC-088» bajo su estado.

## Criterios de aceptación

- **AC-001:** el menú del administrador ya no ofrece «Ventas» ni en
  escritorio ni en el celular; el menú móvil del administrador declara
  `data-items="8"`, que ahora coincide con sus ocho entradas.
- **AC-002:** `/admin/dito-imports` y `POST /api/v1/internal/dito-import/*`
  responden 404.
- **AC-003:** ningún archivo de `apps/` ni `packages/` (fuera del esquema
  Prisma, sus migraciones y el cliente generado) menciona `dito-import`,
  `DitoImport`, `ditoImport` ni `DITO_IMPORT_INTERNAL_SECRET`.
- **AC-004:** `exceljs` y `@nestjs/platform-express` siguen declarados: los
  usa `recovery-base`.
- **AC-005:** tipos, lint y pruebas de `apps/web`, `apps/api` y
  `packages/validation` en verde; `apps/api` y `apps/web` compilan.

## Fase 2 — pendiente (decide José)

Quedan en la base sin código que los lea ni los escriba:

- Tablas `dito_import_batches` (`DitoImportBatch`) y `dito_import_rows`
  (`DitoImportRow`), con sus enums `DitoImportBatchStatus`,
  `DitoImportRowClassification` y `DitoImportRowApplicationStatus`.
- Tabla `dito_agent_identities` (`DitoAgentIdentity`): solo la usaba el
  importador para mapear el «Usuario DITO» del reporte a un asesor. La
  asignación de ventas por la extensión usa los alias, no esta tabla.
- Valor `DITO_BATCH_IMPORT` del enum `DitoOrderCorrectionSource` y la
  columna `dito_order_corrections.dito_import_batch_id` con su índice.
- Relaciones inversas en `Organization`, `User`, `CommercialTeam` y
  `DitoOrder.importRows`.

Si se decide borrarlas, va en una **migración nueva**: nunca se reescribe ni
se edita una migración ya aplicada en producción. Antes de borrar, confirmar
en producción que las tablas siguen vacías y que ninguna corrección tiene
origen `DITO_BATCH_IMPORT`; quitar un valor de un enum de PostgreSQL exige
recrear el tipo.

## Riesgo abierto (se documenta, no se resuelve aquí)

El importador era la vía prevista para **reponer ventas cuando la API se
cae** (`docs/operacion/incidentes/2026-10-16-api-apagada-ventas-dito.md`,
paso 4). Sin él, la extensión es la única puerta de entrada, y hoy responde
«Venta enviada correctamente» aunque la venta no entre: n8n contesta al
recibir el webhook, antes de llamar a la API. Si la API vuelve a caerse, la
única reposición es pedir a cada asesor que reenvíe sus pedidos desde DITO,
y nadie se entera de que hace falta. Corregir la respuesta de la extensión o
vigilar `/health/ready` queda para otra spec.

## Fuera de alcance

- Borrar tablas, columnas o enums (fase 2).
- Cambiar la extensión, n8n o el webhook.
- Corregir el `data-items` del menú móvil de BACKOFFICE (declara 6 con cinco
  entradas; es anterior a esta spec y no lo causa el retiro).
