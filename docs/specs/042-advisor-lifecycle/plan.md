# SPEC-042 — Plan (borrador, a la espera de las decisiones de §5 de la spec)

## 1. Datos

- **Migración `add_person_lifecycle_events`**: tabla
  `person_lifecycle_events` (`id`, `organization_id`, `user_id`, `action`
  enum `PersonLifecycleAction { DISABLED, REENTERED, PROMOTED }`,
  `actor_user_id`, `reason` texto corto, `previous_values` / `new_values`
  JSONB, `released_summary` JSONB con los conteos de cartera liberada,
  `created_at`). Índices por organización+fecha y por usuario+fecha.
- Sin cambios en `User`, `OrganizationMember` ni `CommercialTeamMember`:
  `DISABLED`, `isActive/validUntil` y `role` ya expresan todo lo necesario.

## 2. Reglas puras (`@repo/validation`, `person-lifecycle.ts`)

- `canDisablePerson({ actorRole, actorUserId, targetUserId, targetRole,
  targetStatus, activeAdminCount })`: solo `ADMIN`; nunca uno mismo; solo
  `AGENT`/`SUPERVISOR` activos; nunca el último administrador.
- `canReenterPerson(...)`: solo `ADMIN`; objetivo `DISABLED` con rol
  comercial.
- `canPromotePerson(...)`: solo `ADMIN`; objetivo `AGENT` activo con equipo
  primario.
- `planPortfolioRelease(cases, destination)`: qué casos pasan a sin
  responsable, cuáles al pool de Campañas y cuáles al asesor destino, con la
  regla de Crítica (BR-065) aplicada; devuelve el resumen que el formulario
  anticipa y que el evento guarda.
- Pruebas de cada una.

## 3. Servidor (`apps/web/src/features/users/server/`)

- `get-person-lifecycle-preview.ts`: para una persona, cuenta ventas
  abiertas, casos internos abiertos, casos de Campañas asignados, equipos
  que quedarían sin supervisor, y candidatos a destino (asesores activos
  del mismo equipo).
- `disable-person-action.ts`: transacción — valida con la regla pura;
  `user.status=DISABLED`; cierra membresías; libera/entrega casos con sus
  eventos; borra sesiones (`session.deleteMany`, como el restablecimiento
  de contraseña); escribe `person_lifecycle_events`.
- `reenter-person-action.ts`: transacción — `status=ACTIVE`, rol elegido,
  membresía primaria (reutiliza la lógica de `assignTeamMemberAction`),
  contraseña nueva vía `provisioningAuth` (mismo camino que el
  restablecimiento), evento `REENTERED`.
- `promote-person-action.ts`: transacción — rol `SUPERVISOR`, membresía de
  supervisión, `salesEnabled` según elección, evento `PROMOTED`.
- `assignTeamMemberAction` deja de cambiar el rol de la organización
  (BR-012): el modo `SELLING_SUPERVISOR` solo aplica a quien ya es
  supervisor.

## 4. Interfaz (Personas, SPEC-017 como base)

- En cada fila, acciones secundarias según estado y rol: «Dar de baja»,
  «Promover a supervisor» (asesor activo), «Reingresar» (deshabilitado).
- Cada acción abre un panel de confirmación con las consecuencias en
  lenguaje directo y con números (BR-006), motivo obligatorio, y en su caso
  selector de asesor destino / equipo / «sigue vendiendo» / contraseña.
- La ficha de la persona (expandible en la fila) muestra el historial de
  ciclo de vida.

## 5. Verificación

- Puras: reglas de permiso y plan de liberación.
- Web: los tres paneles anticipan y exigen lo que la spec dice.
- Local con sesión de administrador: baja de un asesor con cartera de
  prueba, reingreso y promoción; comprobar selectores, pool de huérfanos y
  eventos. Producción: solo lectura del directorio tras el despliegue.
