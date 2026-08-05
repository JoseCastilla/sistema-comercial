# SPEC-001 — Plan técnico

**Condición:** `spec.md` está `APPROVED` desde 2026-08-05.

## 1. Estrategia

Implementar verticalmente y con compatibilidad productiva:

1. reglas puras y modelos sin cambiar todavía visibilidad;
2. migración compatible y backfill controlado;
3. servicios de asignación, pool y solicitudes;
4. filtros server-side y acceso contextual derivado;
5. interfaz de equipos y creación de agentes;
6. reclamación, reasignación e historial;
7. bandejas de solicitudes y sugerencias;
8. validación productiva gradual.

## 2. Modelo de datos propuesto

### Enums

```prisma
enum CommercialTeamStatus {
  ACTIVE
  DISABLED
}

enum CommercialTeamMemberRole {
  SUPERVISOR
  AGENT
}

enum DitoOrderAssignmentReason {
  REGISTERED_FOR_ANOTHER_AGENT
  INCORRECT_ALIAS
  AGENT_ABSENCE
  WORKLOAD_BALANCING
  TEAM_TRANSFER
  DATA_CORRECTION
  OTHER
}

enum DitoOrderAssignmentSource {
  ALIAS_AUTO
  MANUAL
  BACKFILL
  ORPHAN_CLAIM
  REQUEST_APPROVAL
  SYSTEM
}

enum DitoOrderAssignmentRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum DitoOrderAssignmentRequestSource {
  AGENT_REQUEST
  BACKOFFICE_SUGGESTION
  SUPERVISOR_REVIEW
  SYSTEM_REVIEW
}
```

### `CommercialTeam`

Campos propuestos:

- `id`, `organizationId`;
- `name`, `normalizedName`, `code?`, `status`;
- `createdByUserId`;
- `createdAt`, `updatedAt`.

Restricciones e índices:

- nombre normalizado único por organización mientras el equipo esté activo;
- índice por `organizationId + status`.

### `CommercialTeamMember`

Campos propuestos:

- `teamId`, `userId`;
- `memberRole`;
- `isPrimary`, `isActive`;
- `assignedByUserId`;
- `validFrom`, `validUntil?`;
- `createdAt`, `updatedAt`.

Restricciones:

- relación siempre dentro de la misma organización, validada en servicio;
- una sola membresía primaria activa de tipo `AGENT` por usuario;
- un supervisor puede tener múltiples membresías activas.

Prisma no expresa todas las restricciones parciales; la migración SQL debe incluir índices parciales cuando corresponda.

### Cambios en `DitoOrder`

- `assignedTeamId String? @db.Uuid`;
- relación con `CommercialTeam` usando `onDelete: SetNull`;
- no añadir un subestado para solicitudes de reasignación;
- índices:
  - organización, equipo, estado y fecha;
  - organización, equipo, agente y fecha;
  - organización, `agentUserId`, `assignedTeamId` y fecha para pool de huérfanos.

Una orden pertenece al pool cuando:

```text
organizationId = organización actual
AND agentUserId IS NULL
AND assignedTeamId IS NULL
```

### Cambios en `CommercialRequest`

- `assignedTeamId String? @db.Uuid`;
- relación con `CommercialTeam`;
- índices equivalentes para filtros de supervisor.

La reasignación de `DitoOrder` no modifica automáticamente estos campos.

### `DitoOrderAssignmentHistory`

Campos propuestos:

- `id`, `organizationId`, `ditoOrderId`;
- `previousAgentUserId?`, `newAgentUserId?`;
- `previousTeamId?`, `newTeamId?`;
- snapshot `originalAgentNameRaw`, `originalAgentNameNormalized`;
- `reason`, `observation?`, `source`;
- `performedByUserId?` para acciones de usuario;
- `performedAt`;
- `orderUpdatedAtBefore` para evidencia de concurrencia.

Índices:

- orden + fecha;
- organización + fecha;
- actor + fecha;
- equipo nuevo + fecha.

### `DitoOrderAssignmentRequest`

Campos propuestos:

- `id`, `organizationId`, `ditoOrderId`;
- `status`, `source`;
- `requestedByUserId?`;
- `suggestedAgentUserId?`, `suggestedTeamId?`;
- `comment`;
- `reviewedByUserId?`, `reviewComment?`, `reviewedAt?`;
- `createdAt`, `updatedAt`;
- snapshot opcional de `orderUpdatedAt` al solicitar.

Restricciones e índices:

- índice por organización, estado y fecha;
- índice por orden y estado;
- índice por equipo sugerido y estado;
- índice parcial único para una sola solicitud `PENDING` por orden;
- todas las relaciones deben pertenecer a la misma organización.

## 3. Servicios de dominio

### `resolveAgentAssignmentByAlias`

Entrada:

```ts
{
  organizationId: string;
  normalizedAlias: string;
}
```

Salida:

```ts
{
  agentUserId: string;
  assignedTeamId: string;
} | null
```

Valida:

- vínculo de alias activo único;
- usuario activo con rol organizacional `AGENT`;
- membresía primaria activa en equipo activo;
- coherencia organizacional.

### `createAgentInTeam`

- autoriza `ADMIN` o supervisor del equipo;
- fija rol `AGENT` para supervisor;
- crea cuenta, membresía organizacional y membresía de equipo;
- compensa o revierte si falla una etapa externa de Better Auth.

### `claimOrphanDitoOrder`

Entrada:

- orden, equipo destino, agente opcional, motivo, observación y `expectedUpdatedAt`.

Valida:

- la orden sigue sin agente y sin equipo;
- `ADMIN` puede elegir cualquier equipo activo de la organización;
- `SUPERVISOR` solo puede elegir un equipo supervisado;
- agente destino, si existe, pertenece al equipo;
- motivo, observación y concurrencia.

Transacción:

1. `updateMany` condicionado por orden huérfana y `updatedAt`;
2. insertar historial `ORPHAN_CLAIM`;
3. resolver solicitud pendiente compatible, si existe.

### `reassignDitoOrder`

Entrada:

- orden, nuevo agente, motivo, observación, `expectedUpdatedAt`.

Valida:

- organización;
- actor y alcance;
- nuevo agente activo y equipo primario;
- transferencia entre equipos solo `ADMIN`;
- motivo y observación;
- concurrencia.

Transacción:

1. `updateMany` condicionado por `updatedAt`;
2. insertar historial;
3. opcionalmente resolver la solicitud pendiente asociada.

### `createDitoOrderAssignmentRequest`

- permite `AGENT` sobre una orden propia;
- permite `BACKOFFICE` como sugerencia operativa;
- valida destino sugerido dentro de la organización;
- impide una segunda solicitud `PENDING`;
- no modifica la orden;
- revalida bandejas de revisión.

### `reviewDitoOrderAssignmentRequest`

- autoriza `ADMIN` o supervisor con alcance sobre la orden/equipo sugerido;
- `APPROVE` delega en `claimOrphanDitoOrder` o `reassignDitoOrder`;
- `REJECT` conserva propiedad;
- actualiza solicitud, revisor, comentario y fecha en la misma unidad lógica.

### `resolveDerivedCommercialContextAccess`

Entrada:

```ts
{
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  ditoOrderId: string;
}
```

Concede lectura cuando:

- el usuario es `ADMIN` o `BACKOFFICE`;
- el usuario es el `agentUserId` actual de la orden;
- el usuario supervisa el `assignedTeamId` actual;
- o dispone de acceso normal sobre la solicitud comercial.

No concede mutación de `CommercialRequest`, `Contact` o `CommercialService`.

## 4. Resolución de acceso

Extender el contexto de acceso para obtener:

```ts
{
  userId;
  role;
  organization;
  supervisedTeamIds;
  primaryAgentTeamId;
}
```

Filtros normales:

- `ADMIN`: organización;
- `BACKOFFICE`: organización y alcance operativo;
- `SUPERVISOR`: `assignedTeamId in supervisedTeamIds`;
- `AGENT`: `agentUserId = userId`.

Consultas adicionales explícitas:

- pool de supervisores: orden huérfana y proyección limitada/enmascarada;
- pool de back office: orden huérfana con detalle operativo;
- solicitudes pendientes: por alcance de equipo, destino sugerido o rol `ADMIN`;
- contexto derivado: unión controlada desde una orden accesible hacia sus entidades vinculadas.

Nunca usar el equipo actual del agente como sustituto de `assignedTeamId` en entidades históricas.

## 5. Interfaz

### `/admin/teams`

Para `ADMIN`:

- crear/renombrar/deshabilitar equipos;
- asignar supervisores;
- incorporar agentes existentes;
- ver estado incompleto o conflictos.

### `/admin/users`

- creación de agente exige equipo;
- `ADMIN` ve todos los equipos;
- supervisor usa una variante limitada con solo sus equipos y rol fijo `AGENT`;
- los vínculos `AgentAlias` solo se activan si el agente tiene equipo primario;
- la interfaz usará “Vínculos de alias DITO”, no “Editar alias original”.

### `/orders`

Mostrar:

- alias original;
- responsable actual;
- equipo actual;
- acción “Reasignar” según permiso;
- historial de asignación;
- indicador de solicitud pendiente;
- acceso al contexto comercial vinculado en modo lectura cuando sea derivado.

Añadir vistas o pestañas:

- `Mis órdenes` para agente;
- `Equipo` para supervisor;
- `Sin asignar` para pool de huérfanos;
- `Solicitudes pendientes` para supervisor y administrador;
- `Sugerencias operativas` para back office.

El pool de supervisores muestra datos personales enmascarados hasta la reclamación.

## 6. Pruebas

### Reglas puras

- selección de destinos permitidos;
- motivo `OTHER`;
- decisión de transferencia;
- visibilidad por rol;
- permiso de reclamación;
- enmascaramiento de pool;
- acceso contextual derivado;
- deduplicación de solicitudes pendientes;
- normalización y resolución compuesta.

### Repositorios y servicios

- asignación automática única;
- ausencia/ambigüedad y entrada al pool;
- equipo deshabilitado;
- reclamación e historial;
- transacción e historial de reasignación;
- creación, aprobación, rechazo y cancelación de solicitudes;
- concurrencia;
- backfill no destructivo;
- campos originales de alias inmutables.

### Autorización y E2E

- Miguel, Erika, Jimena, otro agente y back office;
- acceso denegado a otro equipo y otra organización;
- creación de usuarios por rol;
- reclamación hacia equipo supervisado y rechazo hacia otro equipo;
- reasignación dentro y entre equipos;
- acceso contextual de lectura y mutación denegada;
- back office sugiere pero no confirma;
- agente solicita y supervisor resuelve.

## 7. Migración y backfill

1. Migrar tablas y columnas nulas.
2. Crear equipo inicial por script explícito e idempotente.
3. Asignar membresías conocidas.
4. Calcular `assignedTeamId` cuando `agentUserId` tiene equipo inequívoco.
5. Registrar historial `BACKFILL` para cada asignación completada.
6. Generar reporte de órdenes ambiguas o incompletas, que pasarán al pool.
7. No crear solicitudes artificiales durante el backfill.
8. Activar filtros de supervisor solo cuando backfill, membresías y pool estén validados.

## 8. Despliegue

### Etapa A

- migración compatible;
- equipos y membresías administrables solo por `ADMIN`;
- sin cambiar visibilidad actual.

### Etapa B

- resolución automática de equipo;
- backfill;
- pool de huérfanos visible para `ADMIN` y `BACKOFFICE`;
- métricas y revisión.

### Etapa C

- filtros de supervisor;
- pool limitado y reclamación por supervisor;
- creación de agentes por supervisor;
- reasignación e historial.

### Etapa D

- solicitudes y sugerencias;
- acceso contextual derivado;
- piloto con Miguel, Erika, Jimena, otro agente y back office.

## 9. Rollback

- no eliminar columnas o datos preexistentes;
- mantener `agentUserId` y alias originales;
- desactivar filtros jerárquicos y reclamaciones mediante feature flag si existe un incidente;
- conservar tablas, solicitudes e historiales aun si se revierte la interfaz;
- rollback de migración solo antes de producir historiales; después, preferir una migración correctiva.

## 10. Observabilidad

Registrar sin datos sensibles:

- asignaciones automáticas exitosas;
- entradas y salidas del pool de huérfanos;
- reclamaciones por equipo y actor;
- alias sin equipo o ambiguos;
- reasignaciones por motivo y actor;
- solicitudes creadas, aprobadas, rechazadas y canceladas;
- accesos contextuales concedidos y mutaciones denegadas;
- rechazos de autorización;
- conflictos de concurrencia;
- resultados del backfill.
