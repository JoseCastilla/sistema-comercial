# SPEC-001 — Verificación y trazabilidad

## 1. Matriz inicial

| Criterio | Escenarios             | Evidencia automatizada prevista         | Evidencia operativa prevista                 |
| -------- | ---------------------- | --------------------------------------- | -------------------------------------------- |
| AC-001   | SC-001                 | prueba de acceso ADMIN                  | Miguel consulta toda la organización         |
| AC-002   | SC-005                 | integración de filtro por equipo y pool | Erika ve su equipo, no otro, y pool limitado |
| AC-003   | SC-006                 | integración de filtro por agente        | Jimena ve solo sus órdenes                   |
| AC-004   | SC-002                 | servicio transaccional/compensación     | agente creado dentro del equipo              |
| AC-005   | SC-003                 | autorización supervisor                 | Erika crea agente en su equipo               |
| AC-006   | SC-003, SC-004         | pruebas negativas de rol                | intento rechazado                            |
| AC-007   | SC-004                 | autorización de creación BACKOFFICE     | solo Miguel puede crear                      |
| AC-008   | SC-009                 | servicio de ingestión DITO              | orden nueva visible automáticamente          |
| AC-009   | SC-010, SC-011         | pruebas ausencia/ambigüedad             | orden aparece en pool                        |
| AC-010   | SC-018, SC-031         | reasignación e inmutabilidad            | alias original se conserva                   |
| AC-011   | SC-018, SC-020, SC-021 | historial y validación                  | actor, motivo y cambios visibles             |
| AC-012   | SC-019                 | prueba negativa supervisor              | transferencia rechazada                      |
| AC-013   | SC-020                 | prueba positiva ADMIN                   | transferencia completada                     |
| AC-014   | SC-007, SC-027         | matriz BACKOFFICE                       | operación permitida, identidad denegada      |
| AC-015   | SC-001, SC-008         | pruebas multiempresa                    | acceso cruzado rechazado                     |
| AC-016   | SC-032                 | protección último ADMIN                 | degradación/desactivación rechazada          |
| AC-017   | SC-016, SC-022         | prueba de concurrencia                  | segundo cambio rechazado                     |
| AC-018   | SC-012, SC-013         | backfill idempotente                    | conteos y datos preservados                  |
| AC-019   | SC-014                 | reclamación positiva supervisor         | orden reclamada a equipo propio              |
| AC-020   | SC-015                 | reclamación negativa supervisor         | destino no supervisado rechazado             |
| AC-021   | SC-007, SC-027         | sugerencia back office                  | solicitud creada sin cambio de propiedad     |
| AC-022   | SC-028, SC-030         | acceso contextual derivado              | responsable lee contexto vinculado           |
| AC-023   | SC-029, SC-030         | mutación denegada                       | lead no editable por acceso derivado         |
| AC-024   | SC-023, SC-027         | creación de solicitud                   | pendiente visible en bandeja                 |
| AC-025   | SC-024, SC-025         | revisión de solicitud                   | aprobación reasigna; rechazo conserva        |
| AC-026   | SC-026                 | índice/servicio de unicidad pendiente   | duplicado bloqueado                          |
| AC-027   | SC-031                 | prueba de inmutabilidad                 | campos DITO originales intactos              |
| AC-028   | SC-005, SC-017         | proyección enmascarada                  | PII no visible antes de reclamar             |

## 2. Evidencia requerida por incremento

Cada tarea implementada debe registrar:

- requisito o criterio cubierto;
- archivo o módulo modificado;
- prueba añadida o actualizada;
- comando y resultado;
- commit;
- riesgo residual.

## 3. Validación productiva

### Identidades del piloto

- Miguel: `ADMIN`.
- Erika: `SUPERVISOR`.
- Jimena: `AGENT` de un equipo supervisado por Erika.
- Segundo agente: `AGENT` de otro equipo o del mismo equipo según escenario.
- Usuario back office: creado únicamente por Miguel.

### Checklist

- [ ] Miguel ve todos los equipos, leads y órdenes.
- [ ] Erika solo ve equipos supervisados y el pool limitado.
- [ ] El pool de Erika enmascara datos sensibles.
- [ ] Jimena solo ve órdenes propias.
- [ ] Erika crea un agente en su equipo.
- [ ] Erika no crea roles elevados.
- [ ] Alias nuevo asigna usuario y equipo a una orden DITO nueva.
- [ ] Alias ambiguo incorpora la orden al pool.
- [ ] Erika reclama un huérfano hacia su equipo.
- [ ] Erika no reclama hacia un equipo ajeno.
- [ ] Dos reclamaciones concurrentes no duplican historial.
- [ ] Supervisor reasigna dentro del equipo.
- [ ] Supervisor no transfiere entre equipos.
- [ ] Miguel transfiere entre equipos.
- [ ] Alias original permanece intacto.
- [ ] Gestionar vínculos de alias no cambia órdenes históricas.
- [ ] Historial muestra valores anterior/nuevo, actor, motivo y fecha.
- [ ] Jimena crea una solicitud pendiente sin cambiar propiedad.
- [ ] Erika aprueba o rechaza la solicitud.
- [ ] No existen dos solicitudes pendientes para una orden.
- [ ] Back office sugiere destino y no puede confirmarlo.
- [ ] Jimena lee el contexto comercial de su orden aun con propietario distinto.
- [ ] Jimena no edita ni reasigna el lead mediante acceso contextual.
- [ ] Back office actualiza logística y no administra identidades.
- [ ] Acceso de otra organización es rechazado.
- [ ] Conflicto de concurrencia es visible y no sobrescribe.
- [ ] Backfill es idempotente y no destructivo.

## 4. Resultado

**Estado de verificación:** `IN_PROGRESS`

### Resumen final

- Pruebas automatizadas:
- Criterios aprobados:
- Criterios pendientes:
- Hallazgos productivos:
- Riesgos residuales:
- Decisión de despliegue:

## 5. Cierre

La especificación cambia a `VERIFIED` únicamente cuando todos los criterios obligatorios tienen evidencia suficiente o una excepción explícitamente aceptada y documentada por el responsable de producto.

## 6. Evidencia por incremento

### INC-001 — Reglas puras de equipos y asignación

- **Estado:** `COMPLETED`
- **Tareas:** `T-010`, `T-011`
- **Fecha:** 2026-08-05
- **Alcance:** catálogos compartidos y reglas puras para visibilidad, pool de huérfanos, reclamación, acceso contextual, reasignación y asignación automática.
- **Archivos:**
  - `packages/validation/src/commercial-team-rules.ts`
  - `packages/validation/test/commercial-team-rules.test.mjs`
  - `packages/validation/src/index.ts`
- **Evidencia automatizada:**
  - `pnpm --filter @repo/validation run test`
  - `pnpm --filter @repo/validation run lint`
  - `pnpm --filter @repo/validation run check-types`
  - `pnpm --filter @repo/validation run build`
- **Cobertura parcial:** `AC-002`, `AC-003`, `AC-009`, `AC-012`, `AC-014`, `AC-019`, `AC-020`, `AC-022` y `AC-023`.
- **Nota:** los criterios anteriores no se consideran satisfechos todavía; requieren persistencia, autorización server-side, consultas de acceso y pruebas de integración.
- **Riesgo residual:** aún no existen los modelos Prisma, las migraciones ni los servicios transaccionales.

### INC-002 — Persistencia base de equipos y asignaciones

- **Estado:** `COMPLETED`
- **Tareas completadas:** `T-012`, `T-013`, `T-014`, `T-015`, `T-016`, `T-017`, `T-018`.
- **Fecha:** 2026-08-05
- **Alcance:** modelos de equipos y membresías, equipo asignado en órdenes y solicitudes comerciales, historial de asignación, solicitudes de asignación e índices parciales de invariantes.
- **Archivos:**
  - `packages/database/prisma/schema/teams.prisma`
  - `packages/database/prisma/schema/dito.prisma`
  - `packages/database/prisma/schema/commercial.prisma`
  - `packages/database/prisma/schema/core.prisma`
  - `packages/database/prisma/migrations/20260805152848_add_commercial_teams_assignment_core/migration.sql`
- **Evidencia automatizada ejecutada:**
  - `prisma validate`: esquema válido.
  - `prisma migrate status`: 7 migraciones encontradas y esquema local actualizado.
  - `prisma migrate deploy`: ninguna migración pendiente después de la comprobación.
  - `prisma generate`: cliente Prisma 7.9.1 generado.
  - compilación TypeScript de `@repo/database`: aprobada.
  - suite de `@repo/validation`: 55 pruebas aprobadas.
  - lint y verificación de tipos de `@repo/validation`: aprobados.
- **Cobertura estructural:** `BR-001`, `BR-002`, `BR-003`, `BR-035`, `BR-050`, `BR-051`, `BR-052`, `INV-004`, `INV-005` e `INV-012`.
- **Nota:** la existencia del esquema no satisface por sí sola las reglas transaccionales ni multiempresa; esas garantías requieren los servicios y pruebas de las fases siguientes.
- **Riesgo residual:** las claves foráneas simples no impiden por sí solas referencias cruzadas entre organizaciones. Los servicios deben validar coherencia organizacional en cada escritura y las pruebas de integración deben demostrar `INV-001`.

### INC-003 — Semántica segura de vínculos de alias DITO

- **Estado:** `PARTIAL`
- **Tarea completada:** `T-035`.
- **Tarea relacionada pendiente:** `T-036`; requiere una prueba de integración con persistencia que demuestre que las órdenes existentes permanecen intactas.
- **Fecha:** 2026-08-05
- **Alcance:** la interfaz y la acción usan “Vínculos de alias DITO”; activar un vínculo deja de reasignar órdenes históricas y exige que el destino sea un agente activo con equipo primario activo.
- **Archivos:**
  - `apps/web/src/features/users/server/assign-agent-alias-action.ts`
  - `apps/web/src/features/users/components/assign-agent-alias-form.tsx`
  - `apps/web/src/features/users/server/user-action.types.ts`
  - `packages/validation/src/commercial-team-rules.ts`
  - `packages/validation/test/commercial-team-rules.test.mjs`
- **Evidencia automatizada:**
  - suite de `@repo/validation`: 58 pruebas aprobadas;
  - lint y tipos de `@repo/validation`: aprobados;
  - lint de los archivos web modificados: aprobado;
  - generación de tipos Next.js y TypeScript de `apps/web`: aprobados.
- **Cobertura parcial:** `BR-008`, `BR-023`, `BR-060`, `INV-009`, `INV-014` y `AC-027`.
- **Riesgo residual:** la resolución automática de nuevas órdenes aún debe persistir simultáneamente agente y equipo con historial `ALIAS_AUTO`; corresponde a `T-040`, `T-041` y `T-042`.

### INC-004 — Administración de equipos

- **Estado:** `COMPLETED_WITH_PENDING_OPERATIONAL_VALIDATION`
- **Tareas completadas:** `T-020`, `T-021`, `T-022`, `T-023`, `T-024`, `T-025`.
- **Fecha:** 2026-08-05.
- **Alcance:** creación y deshabilitación de equipos, asignación de supervisores,
  asignación primaria exclusiva de asesores, pantalla administrativa, auditoría
  persistente y aislamiento multiempresa.
- **Archivos principales:**
  - `apps/web/src/app/admin/teams/page.tsx`
  - `apps/web/src/features/teams/server/team-actions.ts`
  - `apps/web/src/features/teams/components/create-team-form.tsx`
  - `apps/web/src/features/teams/components/assign-team-member-form.tsx`
  - `packages/database/prisma/schema/teams.prisma`
  - `packages/database/prisma/migrations/20260805230000_add_commercial_team_audit/migration.sql`
  - `packages/database/prisma/migrations/20260805231500_unique_active_commercial_team_name/migration.sql`
  - `packages/validation/src/commercial-team-rules.ts`
  - `packages/validation/test/commercial-team-rules.test.mjs`
- **Comportamiento verificado:**
  - todas las consultas y mutaciones se limitan por `organizationId`;
  - solo `ADMIN` puede entrar y ejecutar las acciones de `/admin/teams`;
  - un equipo deshabilitado deja de aceptar miembros y sus membresías activas se cierran;
  - mover un asesor desactiva su equipo primario anterior dentro de la misma transacción;
  - supervisores pueden participar en varios equipos sin marcarse como miembros primarios;
  - creación, deshabilitación y asignación generan registros de auditoría con actor y valores;
  - equipos, usuarios o roles de otra organización son rechazados por consulta y política.
- **Evidencia automatizada:**
  - esquema Prisma validado y cliente generado;
  - migración de auditoría aplicada en PostgreSQL local;
  - `prisma migrate status`: 12 migraciones y esquema actualizado;
  - suite de validación: 68 pruebas aprobadas, incluidas 4 de aislamiento administrativo;
  - generación de tipos Next.js, TypeScript y lint completo de `apps/web`: aprobados.
- **Cobertura parcial:** `BR-001`–`BR-009`, `BR-016`, `BR-021`, `INV-001`,
  `INV-003`, `INV-008`, `FR-001`, `FR-002`, `AC-001`, `AC-002` y `AC-003`.
- **Riesgo residual:** falta la validación manual con cuentas reales y la fase de creación
  de agentes debe exigir el equipo desde el alta (`T-030`–`T-034`).

### INC-005 — Fundamentos del sistema visual

- **Estado:** `COMPLETED`
- **Tareas completadas:** `T-UX-001`, `T-UX-002`, `T-UX-003`, `T-UX-004`, `T-UX-005`, `T-UX-006`, `T-UX-007`.
- **Fecha:** 2026-08-05.
- **Alcance:** arquitectura visual por capas, tokens semánticos, estilos base,
  primitivas reutilizables y primera migración de `/orders`.
- **Archivos principales:**
  - `docs/specs/001-commercial-teams/ux.md`
  - `packages/ui/README.md`
  - `packages/ui/src/styles/index.css`
  - `packages/ui/src/styles/tokens.css`
  - `packages/ui/src/styles/foundations.css`
  - `packages/ui/src/styles/patterns.css`
  - `packages/ui/src/page-header.tsx`
  - `packages/ui/src/surface.tsx`
  - `packages/ui/src/metric.tsx`
  - `packages/ui/src/empty-state.tsx`
- **Comportamiento verificado:**
  - una sola entrada pública de estilos desde `@repo/ui/styles.css`;
  - páginas desacopladas de colores, radios y sombras compartidos;
  - métricas adaptables en dos columnas para móvil/tablet y cinco en escritorio;
  - selector de categoría móvil y control segmentado en escritorio;
  - estado vacío distingue ausencia total de pedidos de un filtro sin resultados;
  - filtro “Entregados” probado sobre una orden existente.
  - navegación global separada en `Personas` y `Equipos`;
  - iconografía SVG propia sustituye las iniciales ambiguas;
  - cambio real entre `/admin/users` y `/admin/teams` verificado.
  - formularios, botones, feedback, paneles y badges centralizados en `@repo/ui`;
  - estados reutilizables de carga, vacío, error, éxito, conflicto y permisos;
  - deshabilitación de equipos protegida por diálogo con impacto explícito;
  - `/admin/users` y `/admin/teams` migradas a encabezados, paneles y controles compartidos.
  - `/orders`, `/admin/users` y `/admin/teams` verificadas a 360 px;
  - `/admin/teams` verificada a 1280 px con dos equipos y membresías reales;
  - diálogo destructivo cabe en móvil, mueve el foco a Cancelar y no ejecuta sin confirmación;
  - navegación móvil mantiene cinco destinos y objetivos táctiles de al menos 52 px;
  - controles tienen nombres accesibles, foco visible y orden semántico;
  - movimiento decorativo desactivado mediante `prefers-reduced-motion`;
  - contraste medido: texto principal 15.23:1, secundario 5.30:1,
    acento 6.58:1, peligro 5.02:1 y advertencia 5.31:1;
  - texto tenue corregido de 3.30:1 a 4.67:1 sobre blanco.
- **Evidencia automatizada y visual:**
  - tipos y lint de `packages/ui`: aprobados;
  - generación de rutas, tipos y lint de `apps/web`: aprobados;
  - inspección renderizada de `/orders` en el navegador móvil embebido;
  - navegación sin desplazamiento horizontal y controles con nombres accesibles.
- **Riesgo residual:** algunos patrones internos de vínculos DITO y restablecimiento
  de contraseña aún son específicos de la feature. Falta la prueba de usabilidad
  con usuarios de los tres roles (`T-UX-008`) y evidencia visual final (`T-UX-009`).
