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

**Estado de verificación:** `NOT_STARTED`

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
