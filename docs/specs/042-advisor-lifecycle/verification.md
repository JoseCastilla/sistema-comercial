# SPEC-042 — Verificación

Pendiente: la spec está en propuesta hasta que José responda las preguntas
de §5. Lo que ya se verificó para escribirla (05/09/2026, lectura del código):

- `UserStatus.DISABLED` existe en `core.prisma` y solo lo lee la interfaz
  (etiqueta y filtro de Personas); ninguna acción lo escribe.
- `requireCommercialAccess` exige `user.status = ACTIVE`: una persona
  deshabilitada llega a «acceso denegado» aunque tenga sesión. El
  restablecimiento de contraseña ya borra sesiones (`session.deleteMany`),
  patrón reutilizable para la baja.
- La resolución automática del asesor por correo
  (`dito-orders.repository.ts`, `canResolveAutomaticDitoAssignment`) exige
  usuario `ACTIVE` y membresía primaria activa con venta: la baja manda las
  ventas nuevas al pool sin código adicional.
- Los selectores de asesor de Pedidos, Recupero, Campañas y cuotas filtran
  `user.status = ACTIVE` y `isActive = true`.
- `assignTeamMemberAction` con modo `SELLING_SUPERVISOR` sube el rol de la
  organización a `SUPERVISOR` como efecto secundario (SPEC-019).
- `CommercialTeamAuditLog.teamId` es obligatorio: no sirve para auditar una
  baja sin equipo.
- `returnStaleBaseCasesToPool` (BR-077) es el mecanismo a reutilizar para
  devolver casos de Campañas al pool con evento `ASSIGNED_TO_TEAM`.
