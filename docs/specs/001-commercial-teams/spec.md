# SPEC-001 — Equipos comerciales, visibilidad y reasignación

**Estado:** `APPROVED`
**Versión:** 1.1
**Fecha:** 2026-08-05
**Fecha de aprobación:** 2026-08-05
**Organización inicial:** Distribuidor Online
**Responsable de producto:** José Castilla

## 1. Problema

La plataforma ya identifica agentes mediante vínculos de alias DITO y restringe a un `AGENT` a sus propias órdenes. Falta representar la jerarquía comercial para que:

- Miguel, como `ADMIN`, conserve alcance organizacional;
- Erika, como `SUPERVISOR`, vea y gestione únicamente los equipos que supervisa;
- los agentes pertenezcan a un equipo operativo;
- back office opere logística global sin administrar identidades;
- una venta registrada con el alias o equipo incorrecto pueda reasignarse con auditoría;
- las órdenes sin responsable no generen un cuello de botella exclusivo del administrador;
- el responsable actual de una orden conserve acceso de lectura al contexto comercial vinculado;
- las solicitudes de reasignación sean visibles, persistentes y resolubles;
- ningún cambio elimine la evidencia original recibida desde DITO.

## 2. Objetivos

1. Modelar equipos comerciales dentro de una organización.
2. Relacionar supervisores y agentes con equipos.
3. Aplicar visibilidad server-side por rol, organización, equipo y responsabilidad actual.
4. Crear agentes dentro de un equipo autorizado.
5. Asignar equipo junto con el agente al recibir o corregir una orden.
6. Reasignar órdenes con motivo, actor, fecha y control de concurrencia.
7. Separar captura original, responsabilidad actual y asociación comercial.
8. Definir el alcance operativo de `BACKOFFICE`.
9. Incorporar un pool controlado de órdenes sin asignación.
10. Materializar solicitudes y sugerencias de reasignación como registros auditables.
11. Garantizar acceso contextual de solo lectura al lead o solicitud vinculada cuando la orden y el contexto comercial tengan responsables diferentes.

## 3. Actores

- **ADMIN:** administrador organizacional con alcance global.
- **SUPERVISOR:** responsable de uno o varios equipos.
- **AGENT:** asesor operativo con acceso a sus propios elementos.
- **BACKOFFICE:** operador logístico global sin administración de identidades.
- **SYSTEM:** ingestión o procesos automáticos.

## 4. Terminología

- **Alias original:** nombre recibido desde DITO, almacenado en `agentNameRaw` y `agentNameNormalized` dentro de la orden.
- **Vínculo de alias:** registro `AgentAlias` que relaciona un texto normalizado con un usuario interno. Administrar el vínculo no modifica el alias original de una orden.
- **Responsable actual:** usuario indicado por `agentUserId`.
- **Equipo asignado:** equipo persistido en `assignedTeamId` para la entidad.
- **Equipo supervisado:** equipo con membresía activa de tipo `SUPERVISOR` para el usuario.
- **Reasignación:** cambio explícito del responsable actual, del equipo asignado o de ambos.
- **Transferencia:** reasignación que cruza equipos.
- **Pool de huérfanos:** vista de órdenes DITO con `agentUserId` y `assignedTeamId` vacíos que requieren reclamación o revisión.
- **Reclamar:** asignar una orden del pool de huérfanos a uno de los equipos supervisados por el actor.
- **Acceso contextual derivado:** permiso de lectura sobre contacto, solicitud y servicio vinculados, obtenido por ser responsable actual de la orden o supervisor de su equipo, sin alterar la propiedad del lead.
- **Solicitud de asignación:** registro separado que pide o sugiere una reasignación y que no modifica la propiedad hasta ser aprobado.

## 5. Alcance

### Incluido

- equipos activos y deshabilitados;
- membresías de supervisor y agente;
- equipo primario del agente;
- equipo persistido en `DitoOrder` y `CommercialRequest`;
- filtros de visibilidad;
- creación de agentes por `ADMIN` y por `SUPERVISOR` autorizado;
- resolución automática de usuario y equipo desde alias DITO;
- pool de huérfanos con reclamación controlada;
- reasignación manual de órdenes;
- transferencia entre equipos por `ADMIN`;
- historial de asignaciones;
- solicitudes de reasignación y sugerencias de back office;
- acceso contextual derivado de solo lectura;
- funciones y restricciones de `BACKOFFICE`;
- backfill inicial de equipo para datos existentes.

### Fuera de alcance

- comisiones y metas por equipo;
- turnos laborales del personal;
- múltiples organizaciones por una misma operación;
- asignación automática por balance de carga;
- reasignación masiva;
- aprobación multinivel;
- escritura hacia GHL;
- dashboard avanzado de productividad;
- equipos secundarios activos para un agente en la primera versión;
- reasignación automática del lead cuando cambia una orden;
- edición del texto original recibido desde DITO.

## 6. Reglas de negocio

### Equipos y membresías

- **BR-001:** todo equipo pertenece a una sola organización.
- **BR-002:** el nombre del equipo es obligatorio y único dentro de la organización mientras el equipo esté activo.
- **BR-003:** un `AGENT` operativo debe tener exactamente una membresía activa y primaria de equipo.
- **BR-004:** un `SUPERVISOR` puede supervisar uno o varios equipos activos.
- **BR-005:** un equipo puede tener uno o varios supervisores activos.
- **BR-006:** `ADMIN` y `BACKOFFICE` no requieren equipo para ejercer su alcance global.
- **BR-007:** un agente sin equipo primario se considera incompleto y no puede recibir nuevas asignaciones automáticas.
- **BR-008:** no se activa un vínculo de alias DITO para un agente sin equipo primario activo.
- **BR-009:** deshabilitar un equipo impide nuevas asignaciones, pero conserva historial y referencias existentes.

### Creación y administración de usuarios

- **BR-010:** `ADMIN` puede crear cualquier rol.
- **BR-011:** `SUPERVISOR` solo puede crear usuarios con rol `AGENT`.
- **BR-012:** un supervisor solo puede crear o incorporar agentes en equipos que supervisa activamente.
- **BR-013:** la creación del agente y su membresía de equipo deben completarse de forma consistente; no se deja una cuenta activa huérfana.
- **BR-014:** solo `ADMIN` puede crear o promover usuarios a `BACKOFFICE`, `SUPERVISOR` o `ADMIN`.
- **BR-015:** el último `ADMIN` activo no puede ser degradado ni deshabilitado.

### Visibilidad

- **BR-016:** toda consulta se limita primero por `organizationId`.
- **BR-017:** `ADMIN` ve todos los leads, solicitudes, órdenes y equipos de la organización.
- **BR-018:** `BACKOFFICE` tiene visibilidad operativa total sobre las órdenes y el contexto necesario para logística; esto no equivale a supervisar equipos.
- **BR-019:** `SUPERVISOR` ve entidades cuyo `assignedTeamId` pertenece a sus equipos supervisados activos y una vista limitada del pool de huérfanos.
- **BR-020:** `AGENT` ve órdenes cuyo `agentUserId` coincide con su usuario y obtiene acceso contextual derivado de solo lectura a los datos comerciales vinculados necesarios para atenderlas.
- **BR-021:** la interfaz no concede acceso; los filtros y permisos se aplican en servidor.
- **BR-022:** cambiar posteriormente el equipo del agente no cambia silenciosamente el equipo histórico de una orden o solicitud ya asignada.

### Alias, asignación y captura original

- **BR-023:** `agentNameRaw` y `agentNameNormalized` de una orden nunca se sobrescriben durante una reasignación o al administrar vínculos `AgentAlias`.
- **BR-024:** el alias DITO es evidencia de captura y no propiedad definitiva de la venta.
- **BR-025:** una resolución automática solo asigna cuando existe un único vínculo de alias activo, un agente activo y un equipo primario activo.
- **BR-026:** una asignación automática guarda simultáneamente `agentUserId` y `assignedTeamId`.
- **BR-027:** cero o varias coincidencias dejan la orden sin responsable automático, crean o mantienen su condición de revisión y la incorporan al pool de huérfanos.
- **BR-028:** el backfill histórico solo completa campos vacíos; nunca sobrescribe una asignación existente.

### Reasignación

- **BR-029:** `SUPERVISOR` puede reasignar una orden entre agentes activos de equipos que supervisa.
- **BR-030:** una transferencia entre equipos requiere `ADMIN`.
- **BR-031:** `BACKOFFICE` puede crear una sugerencia de equipo o agente y aportar evidencia operativa, pero no confirmar el cambio de propiedad comercial.
- **BR-032:** `AGENT` no reasigna directamente; crea una solicitud persistente con comentario y, opcionalmente, un agente sugerido.
- **BR-033:** toda reasignación confirmada requiere un motivo de catálogo.
- **BR-034:** `OTHER` requiere observación no vacía.
- **BR-035:** el cambio de `agentUserId`, `assignedTeamId` y el historial ocurre en una transacción.
- **BR-036:** la reasignación usa control de concurrencia; si la entidad cambió desde que se cargó, se rechaza y se solicita recargar.
- **BR-037:** reasignar una orden no reasigna automáticamente el lead o solicitud comercial, pero el responsable actual de la orden conserva acceso contextual derivado de solo lectura.
- **BR-038:** una acción explícita futura podrá reasignar orden y caso comercial, mostrando y auditando ambos cambios.

### Back office

- **BR-039:** `BACKOFFICE` puede actualizar estado, subestado, aprobación, programación, entrega, observaciones, fallas y escalaciones.
- **BR-040:** `BACKOFFICE` puede corregir vínculos operativos entre orden, solicitud y servicio con auditoría.
- **BR-041:** `BACKOFFICE` no crea usuarios, equipos, vínculos de alias ni roles.
- **BR-042:** `BACKOFFICE` no administra contraseñas, sesiones, integraciones o secretos.
- **BR-043:** la creación de `BACKOFFICE` corresponde exclusivamente a `ADMIN`.

### Pool de huérfanos

- **BR-044:** `ADMIN` puede asignar cualquier orden del pool de huérfanos a un equipo o agente válido de la organización.
- **BR-045:** `SUPERVISOR` puede reclamar una orden huérfana únicamente hacia uno de sus equipos supervisados activos.
- **BR-046:** reclamar una orden requiere motivo, crea historial y usa control de concurrencia.
- **BR-047:** cuando una orden es reclamada correctamente, desaparece del pool para los demás supervisores.
- **BR-048:** `BACKOFFICE` ve el pool con detalle operativo total y puede sugerir destino, pero no confirmar la reclamación.
- **BR-049:** antes de reclamar, el supervisor ve solo los campos mínimos necesarios para identificar la operación; datos sensibles de contacto se muestran enmascarados.

### Solicitudes y sugerencias de asignación

- **BR-050:** una solicitud de asignación es una entidad separada y no usa ni modifica `DitoOrder.status` o `sentSubstatus`.
- **BR-051:** los estados de solicitud son `PENDING`, `APPROVED`, `REJECTED` y `CANCELLED`.
- **BR-052:** solo puede existir una solicitud `PENDING` por orden; nuevos intentos actualizan o rechazan la duplicación según la política del servicio.
- **BR-053:** las solicitudes de un agente aparecen en la bandeja de sus supervisores y de `ADMIN`; las sugerencias de `BACKOFFICE` aparecen para el equipo sugerido y `ADMIN`.
- **BR-054:** aprobar una solicitud ejecuta la misma transacción y controles que una reasignación manual; rechazarla no cambia propiedad.
- **BR-055:** la solicitud conserva solicitante, origen, comentario, destino sugerido, revisor, decisión y fechas.

### Acceso contextual derivado

- **BR-056:** el responsable actual de una orden puede leer el contacto, solicitud comercial y servicio vinculados aunque la propiedad comercial de esas entidades pertenezca a otro agente o equipo.
- **BR-057:** los supervisores del equipo asignado a la orden reciben el mismo acceso contextual de lectura.
- **BR-058:** el acceso contextual derivado no permite editar, reasignar ni cambiar el estado comercial del lead o solicitud.
- **BR-059:** el acceso contextual derivado se revoca cuando el usuario deja de ser responsable o supervisor, salvo que conserve acceso por otra regla.

### Semántica de vínculos de alias

- **BR-060:** “administrar alias” significa crear, activar o desactivar vínculos `AgentAlias`; no significa editar `agentNameRaw` o `agentNameNormalized` en órdenes existentes.
- **BR-061:** un vínculo activo no puede producir asignaciones ambiguas dentro de una organización.

## 7. Invariantes

- **INV-001:** ninguna entidad cruza organizaciones mediante equipo, usuario, solicitud o historial.
- **INV-002:** el alias original de DITO almacenado en la orden permanece inmutable.
- **INV-003:** un agente activo asignado a una entidad y su equipo asignado deben ser coherentes en el momento de la asignación.
- **INV-004:** toda reasignación o reclamación confirmada genera exactamente un registro de historial.
- **INV-005:** una entidad no puede quedar parcialmente actualizada si falla el historial.
- **INV-006:** un supervisor nunca obtiene visibilidad global por ausencia de filtros de equipo; el pool de huérfanos es una excepción explícita y limitada.
- **INV-007:** el último administrador activo permanece protegido.
- **INV-008:** un equipo deshabilitado no recibe nuevas asignaciones.
- **INV-009:** una asignación histórica existente no se sobrescribe por backfill o resolución automática.
- **INV-010:** un supervisor no puede reclamar una orden hacia un equipo que no supervisa.
- **INV-011:** una solicitud pendiente no modifica `agentUserId` ni `assignedTeamId`.
- **INV-012:** no existen dos solicitudes `PENDING` simultáneas para una misma orden.
- **INV-013:** el acceso contextual derivado es de solo lectura y no altera propiedad comercial.
- **INV-014:** administrar un vínculo `AgentAlias` no modifica los campos originales de ninguna orden.
- **INV-015:** una orden reclamada por un actor no puede ser reclamada simultáneamente por otro.

## 8. Requisitos funcionales

- **FR-001:** `ADMIN` puede crear, renombrar y deshabilitar equipos.
- **FR-002:** `ADMIN` puede asignar supervisores y agentes a equipos.
- **FR-003:** `SUPERVISOR` puede listar sus equipos y sus agentes.
- **FR-004:** `SUPERVISOR` puede crear un `AGENT` directamente dentro de uno de sus equipos.
- **FR-005:** la creación de `AGENT` exige seleccionar equipo primario.
- **FR-006:** la ingestión DITO resuelve un destino compuesto `{agentUserId, assignedTeamId}`.
- **FR-007:** la bandeja filtra según la matriz de visibilidad.
- **FR-008:** una orden muestra responsable actual, equipo actual y alias original.
- **FR-009:** supervisor y administrador pueden abrir la acción “Reasignar”.
- **FR-010:** la acción ofrece solo destinos permitidos para el actor.
- **FR-011:** la acción exige motivo y, cuando corresponda, observación.
- **FR-012:** la interfaz muestra el historial de asignación.
- **FR-013:** back office puede crear una sugerencia de revisión sin modificar la propiedad.
- **FR-014:** un agente puede crear una solicitud de reasignación sin ejecutarla.
- **FR-015:** el administrador puede ejecutar un backfill inicial controlado.
- **FR-016:** `/orders` incorpora una vista o pestaña “Sin asignar” para el pool de huérfanos.
- **FR-017:** un supervisor puede reclamar una orden del pool hacia uno de sus equipos.
- **FR-018:** back office puede sugerir un destino desde el pool y dejarlo pendiente de confirmación.
- **FR-019:** la plataforma concede acceso contextual de solo lectura al responsable actual y a los supervisores de la orden.
- **FR-020:** un agente puede crear, consultar y cancelar su solicitud pendiente mientras no haya sido revisada.
- **FR-021:** supervisor y administrador disponen de una bandeja de solicitudes pendientes dentro de su alcance.
- **FR-022:** aprobar o rechazar una solicitud registra revisor, decisión, fecha y comentario.
- **FR-023:** una orden muestra un indicador cuando tiene una solicitud pendiente.
- **FR-024:** la gestión de vínculos `AgentAlias` usa terminología que no sugiera edición del alias original.
- **FR-025:** el pool de supervisores enmascara datos sensibles hasta que la orden sea reclamada.

## 9. Catálogos

### Estado de equipo

```text
ACTIVE
DISABLED
```

### Participación en equipo

```text
SUPERVISOR
AGENT
```

### Motivo de reasignación

```text
REGISTERED_FOR_ANOTHER_AGENT
INCORRECT_ALIAS
AGENT_ABSENCE
WORKLOAD_BALANCING
TEAM_TRANSFER
DATA_CORRECTION
OTHER
```

### Origen del historial

```text
ALIAS_AUTO
MANUAL
BACKFILL
ORPHAN_CLAIM
REQUEST_APPROVAL
SYSTEM
```

### Estado de solicitud

```text
PENDING
APPROVED
REJECTED
CANCELLED
```

### Origen de solicitud

```text
AGENT_REQUEST
BACKOFFICE_SUGGESTION
SUPERVISOR_REVIEW
SYSTEM_REVIEW
```

## 10. Matriz de permisos

| Capacidad | ADMIN | SUPERVISOR | BACKOFFICE | AGENT |
|---|---:|---:|---:|---:|
| Ver organización completa | Sí | No | Visibilidad operativa total | No |
| Ver equipos supervisados | Sí | Sí | N/A | No |
| Ver órdenes de equipos asignados | Sí | Sí, sus equipos | Sí, operación global | Solo propias |
| Ver pool de huérfanos | Sí | Sí, vista limitada | Sí, detalle operativo | No |
| Reclamar huérfano | Sí | Sí, hacia sus equipos | No; solo sugerir | No |
| Ver contexto comercial vinculado | Sí | Sí, lectura por equipo/orden | Sí, lectura operativa | Sí, lectura de sus órdenes |
| Crear equipo | Sí | No | No | No |
| Crear ADMIN/SUPERVISOR/BACKOFFICE | Sí | No | No | No |
| Crear AGENT | Sí | Sí, en sus equipos | No | No |
| Gestionar vínculos de alias | Sí | Sí, en sus equipos | No | No |
| Reasignar dentro de equipo autorizado | Sí | Sí | No | No |
| Transferir entre equipos | Sí | No | No | No |
| Crear solicitud/sugerencia | Sí | Sí | Sí, sugerencia | Sí, solicitud propia |
| Aprobar/rechazar solicitud | Sí | Sí, en sus equipos | No | No |
| Actualizar logística DITO | Sí | Sí | Sí | Solo propias |
| Editar lead por acceso contextual derivado | Según permiso normal | Según permiso normal | Según permiso operativo | No |

## 11. Requisitos no funcionales

- **NFR-001:** autorización siempre server-side.
- **NFR-002:** índices para consultas por organización, equipo, usuario, solicitud pendiente y fecha.
- **NFR-003:** transacciones para membresías, asignaciones, reclamaciones e historiales.
- **NFR-004:** control de concurrencia en reasignaciones, reclamaciones y revisión de solicitudes.
- **NFR-005:** migraciones compatibles con datos productivos existentes.
- **NFR-006:** despliegue sin interrumpir ingestión DITO.
- **NFR-007:** logs sin contraseñas, secretos ni datos personales innecesarios.
- **NFR-008:** pruebas automatizadas para permisos positivos y denegados.
- **NFR-009:** rollback documentado antes del despliegue.
- **NFR-010:** el pool de huérfanos debe evitar exposición innecesaria de datos personales a supervisores.
- **NFR-011:** las solicitudes pendientes deben ser consultables e indexadas para evitar elementos invisibles.

## 12. Datos existentes y migración

1. Crear un equipo inicial para la operación vigente.
2. Asignar a Erika como supervisora cuando su cuenta exista.
3. Asignar agentes activos al equipo correspondiente.
4. Completar `assignedTeamId` en órdenes con `agentUserId` y equipo primario inequívoco.
5. Incorporar al pool de huérfanos las órdenes sin usuario o equipo inequívoco.
6. Registrar el backfill con origen `BACKFILL`.
7. No sobrescribir asignaciones manuales existentes.
8. No crear solicitudes pendientes artificiales durante el backfill; el pool será la representación inicial de revisión.

## 13. Criterios de aceptación

- **AC-001:** Miguel ve toda la organización.
- **AC-002:** Erika ve únicamente leads y órdenes de sus equipos, además del pool limitado de huérfanos.
- **AC-003:** un agente ve únicamente sus propias órdenes.
- **AC-004:** Miguel puede crear un agente dentro del equipo de Erika en una operación consistente.
- **AC-005:** Erika puede crear agentes solo dentro de sus equipos.
- **AC-006:** Erika no puede crear `BACKOFFICE`, `SUPERVISOR` ni `ADMIN`.
- **AC-007:** solo `ADMIN` puede crear `BACKOFFICE`.
- **AC-008:** una orden nueva con alias inequívoco obtiene usuario y equipo automáticamente.
- **AC-009:** una orden ambigua queda sin asignación automática y aparece en el pool de huérfanos.
- **AC-010:** una venta registrada con alias incorrecto puede reasignarse sin alterar el alias original.
- **AC-011:** toda reasignación registra motivo, actor, fecha y valores anterior/nuevo.
- **AC-012:** un supervisor no transfiere entre equipos.
- **AC-013:** un administrador sí puede transferir entre equipos.
- **AC-014:** back office opera logística global sin administrar identidades.
- **AC-015:** ningún usuario ve datos de otra organización.
- **AC-016:** el último administrador activo queda protegido.
- **AC-017:** una reasignación concurrente no sobrescribe cambios recientes.
- **AC-018:** el backfill no modifica órdenes ya asignadas.
- **AC-019:** Erika puede reclamar una orden huérfana hacia un equipo que supervisa.
- **AC-020:** Erika no puede reclamar una orden hacia un equipo que no supervisa.
- **AC-021:** back office puede sugerir equipo o agente para una orden huérfana, pero no confirmar la propiedad.
- **AC-022:** el responsable actual de una orden puede leer el lead o solicitud vinculada aunque su asignación comercial sea diferente.
- **AC-023:** el acceso contextual derivado no permite editar ni reasignar el lead.
- **AC-024:** una solicitud de agente queda visible como `PENDING` para supervisor y administrador sin cambiar propiedad.
- **AC-025:** aprobar una solicitud ejecuta la reasignación auditada; rechazarla conserva la propiedad.
- **AC-026:** no se crean dos solicitudes `PENDING` para la misma orden.
- **AC-027:** gestionar vínculos de alias no modifica `agentNameRaw` ni `agentNameNormalized` de órdenes existentes.
- **AC-028:** el pool de supervisores enmascara datos sensibles hasta que la orden es reclamada.

## 14. Decisiones aprobadas

1. En la primera versión, un agente tendrá una sola membresía activa de equipo; los equipos secundarios quedan fuera de alcance.
2. Un supervisor no será simultáneamente agente mediante el mismo rol organizacional.
3. Las órdenes DITO sin equipo o responsable formarán un pool de huérfanos. `ADMIN` puede asignarlas; `SUPERVISOR` puede reclamarlas únicamente hacia sus equipos; `BACKOFFICE` puede sugerir destino, pero no confirmar.
4. El equipo se persiste en la entidad para conservar visibilidad histórica.
5. El historial de órdenes será un modelo específico; no se reutiliza historial de estado o asociación comercial.
6. Reasignar una orden no cambia automáticamente la propiedad del lead, pero concede acceso contextual derivado de solo lectura al responsable de la orden y a sus supervisores.
7. Las solicitudes de agente y sugerencias de back office se materializan en un modelo separado con estados y bandeja de pendientes; no se usan subestados DITO.
8. “Gestionar vínculos de alias” significa administrar `AgentAlias`; los campos originales recibidos desde DITO son inmutables.
9. El pool de huérfanos muestra datos sensibles enmascarados a supervisores antes de la reclamación.

## 15. Aprobación

`SPEC-001` queda `APPROVED` por el responsable de producto el 2026-08-05. La implementación puede iniciar siguiendo `plan.md` y `tasks.md`. Cualquier cambio posterior que altere estas reglas requiere incrementar la versión de la especificación y registrar la decisión antes de modificar dominio o autorización.
