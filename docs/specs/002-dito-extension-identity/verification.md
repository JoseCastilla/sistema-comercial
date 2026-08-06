# SPEC-002 — Verificación

**Estado:** `IN_PROGRESS`

| Criterio | Evidencia prevista |
| --- | --- |
| AC-001 | pruebas con dos usuarios y el mismo alias |
| AC-002 | prueba de correo desconocido |
| AC-003 | prueba de agente sin equipo activo |
| AC-004 | prueba de instalación reutilizada |
| AC-005 | consulta de orden persistida |
| AC-006 | suite de regresión 1.0 |
| AC-007 | validación Zod de dominio corporativo |
| AC-008 | prueba de ausencia de aprovisionamiento |

## Evidencia por incremento

### INC-001 — Contrato compatible e identidad validada

- **Estado:** `COMPLETED`
- **Tareas:** `T-001`, `T-002`, `T-003`.
- **Fecha:** 2026-08-05.
- **Archivos:**
  - `packages/contracts/src/index.ts`
  - `packages/validation/src/dito-order-schemas.ts`
  - `packages/validation/test/dito-extension-identity.test.mjs`
- **Evidencia automatizada:**
  - build, lint y tipos de `@repo/contracts`: aprobados;
  - build, lint y tipos de `@repo/validation`: aprobados;
  - suite de `@repo/validation`: 63 pruebas aprobadas;
  - envelope 2.0 con correo corporativo e instalación UUID: aceptado;
  - correos externos e instalaciones inválidas: rechazados;
  - envelope heredado 1.0: continúa aceptado.
- **Criterios parcialmente cubiertos:** `AC-001`, `AC-006`, `AC-007`.
- **Riesgo al cierre del incremento:** la API aún invocaba explícitamente el parser heredado y la identidad 2.0 todavía no se persistía ni resolvía. Este riesgo quedó atendido en `INC-002`.

### INC-002 — Persistencia y resolución server-side

- **Estado:** `COMPLETED`
- **Tareas:** `T-010`, `T-011`, `T-012`, `T-020`, `T-021`, `T-022`, `T-023`.
- **Fecha:** 2026-08-05.
- **Archivos:**
  - `packages/database/prisma/schema/dito.prisma`
  - `packages/database/prisma/migrations/20260805190000_add_dito_submitter_identity/migration.sql`
  - `apps/api/src/modules/webhooks/dito-webhook-validation.service.ts`
  - `apps/api/src/modules/webhooks/dito-webhook.service.ts`
  - `apps/api/src/modules/webhooks/dito-orders.repository.ts`
  - `apps/api/src/modules/webhooks/dito-webhook.service.spec.ts`
  - `apps/api/src/modules/webhooks/dito-orders.repository.spec.ts`
- **Evidencia automatizada:**
  - migración aplicada correctamente a PostgreSQL local;
  - `prisma migrate status`: 8 migraciones y esquema actualizado;
  - Prisma validado, generado, compilado y con lint aprobado;
  - tipos y lint de la API: aprobados;
  - suite unitaria completa de la API: 47 pruebas aprobadas;
  - suite específica DITO de servicio: 9 pruebas aprobadas;
  - suite directa del repositorio DITO: 6 pruebas aprobadas;
  - lint y tipos de la API aprobados después de incorporar la suite del repositorio.
- **Comportamiento verificado:**
  - envelope 2.0 resuelve agente y equipo por correo corporativo;
  - envelope 2.0 no consulta alias;
  - conflicto de instalación deja agente y equipo vacíos y marca revisión;
  - envelope 1.0 conserva su resolución heredada y exactamente la canonicalización anterior de fingerprint;
  - correo e instalación se guardan separados de la responsabilidad actual.
- **Criterios cubiertos por servicio:** `AC-001`, `AC-002`, `AC-003`, `AC-004`, `AC-005`, `AC-006`, `AC-007`, `AC-008`.
- **Riesgo residual:** la lógica del repositorio está cubierta con dobles tipados, pero la validación operativa extremo a extremo contra PostgreSQL y una venta real continúa pendiente. El workflow 2.0 está preparado, pero no desplegado en n8n por decisión operativa.

### INC-003 — Extensión DITO 2.0

- **Estado:** `COMPLETED_WITH_PENDING_INTEGRATION`
- **Tareas:** `T-030`, `T-031`.
- **Fecha:** 2026-08-05.
- **Ubicación:** `apps/dito-extension`.
- **Cambios:**
  - registra una sola vez nombre, correo corporativo e `installation_id`;
  - migra instalaciones existentes que solo conservaban `asesor`;
  - envía la identidad junto con `venta` y `fecha`;
  - comprueba `response.ok` antes de confirmar el envío;
  - bloquea envíos simultáneos y dobles clics;
  - restringe extracción a `https://ventas.movistar.com.pe/`;
  - limita permisos de host a DITO y al webhook de automatización;
  - elimina el content script global sin uso.
- **Evidencia automatizada:**
  - `manifest.json` parseado correctamente;
  - `node --check apps/dito-extension/popup.js`: aprobado;
  - búsqueda de `<all_urls>` y content scripts globales: sin resultados;
  - `git diff --check`: aprobado.
- **Riesgo residual:** falta cargar la extensión 2.1.2 sin empaquetar y validar el flujo contra una venta real. El workflow preparado debe desplegarse en n8n antes de distribuir esta versión a los asesores.

### INC-004 — Workflow n8n 2.0 preparado

- **Estado:** `READY_FOR_IMPORT`
- **Tarea relacionada:** `T-032` completada como artefacto; su importación y activación se mantienen como despliegue operativo independiente.
- **Fecha:** 2026-08-05.
- **Artefacto:** `infra/n8n/workflows/MOVISTAR-03-seguimiento-ventas-dito-v2.json`.
- **Comportamiento:**
  - conserva las ramas independientes de Google Sheets y API;
  - genera envelope 1.0 cuando la extensión no envía identidad;
  - genera envelope 2.0 con `submitted_by` cuando correo, nombre e instalación son válidos;
  - no degrada una identidad presente pero inválida a resolución por alias;
  - registra advertencias de instalación, correo o nombre inválidos;
  - mantiene el workflow importable en estado inactivo para evitar colisión de webhooks.
- **Evidencia automatizada:**
  - JSON y código JavaScript embebido válidos;
  - rótulos `OPERACIÓN` y `TELÉFONO` preservados en UTF-8;
  - caso heredado ejecutado: envelope 1.0;
  - caso corporativo ejecutado: envelope 2.0 con correo esperado;
  - caso inválido ejecutado: `api_ready=false`, envelope nulo y advertencias esperadas.
- **Riesgo residual:** la importación debe volver a vincular o confirmar credenciales de n8n. La sustitución requiere desactivar el workflow anterior antes de activar el nuevo porque ambos usan `ventas-televentas`.
