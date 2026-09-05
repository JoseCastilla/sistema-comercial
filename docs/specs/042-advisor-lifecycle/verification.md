# SPEC-042 — Verificación

## 1. Lectura del código previa a la spec (05/09/2026)

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

## 2. Construcción (05/09/2026)

1. **Pruebas puras** — 314 en verde en `@repo/validation`, 5 nuevas: solo
   administración da de baja, nunca a sí misma, solo a asesores y
   supervisores activos; reingresa quien está de baja; se promueve solo a un
   asesor activo con equipo; el motivo es de la lista; el plan de cartera
   manda Campañas al pool, lo interno al destino salvo la Crítica cuyo
   originador es el destino (queda sin responsable y se cuenta).
2. **Pruebas web** — 127 en verde, 6 nuevas: qué acciones ve cada estado y
   rol; nadie se da de baja a sí mismo; la baja anticipa con números, exige
   motivo, ofrece entregar la cartera y pide detalle en «Otro»; promover
   propone su equipo y explica qué pasa con su venta; el reingreso pide
   equipo y contraseña y ofrece cambiar el correo; el historial se ve.
   Tipos y lint limpios. La migración se aplicó en local sin incidentes.
3. **Recorrido local con sesión de administrador** (dev server reiniciado
   para tomar el cliente Prisma nuevo):
   - Personas: 17 filas; 15 personas comerciales con «Dar de baja», 13
     asesores con «Promover a supervisor»; los dos administradores sin
     acciones de ciclo de vida.
   - **Baja real** de Christian Ruiz (Huancayo), que tenía 1 venta abierta y
     el caso crítico 1942469714A cuya venta originó Steven Lizarraga. El
     panel anticipó «1 venta(s) abiertas siguen a su nombre», «1 caso(s) de
     recupero quedan sin responsable» y ofreció como destino a los tres
     asesores activos de Huancayo. Se eligió motivo «Cese» y destino Steven
     a propósito: el resultado fue «quedó de baja. 1 venta(s) abiertas
     siguen a su nombre. 1 caso(s) quedaron sin responsable en su equipo (1
     crítico(s) no podían ir al destino elegido)». La fila pasó a
     «Deshabilitado · Sin equipo» con «Reingresar» e «Historial (1)»; la
     cabecera bajó a «16 de 17 personas activas»; en Recupero el caso quedó
     «Sin responsable» con «Críticas sin asignar = 1» y botón «Asignar».
   - **Reingreso**: el panel muestra rol, equipo, correo opcional con el
     actual como referencia y las dos contraseñas; sin contraseña el
     navegador no deja enviar. No se escribió ninguna contraseña desde esta
     sesión: el reingreso real queda para José (Christian sigue de baja en
     la base local, listo para probarlo).
   - **Promoción real** de Angieska De Los Rios: equipo preseleccionado
     (AYACUCHO - MAGISTERIAL), «sigue vendiendo» marcado; resultado «ahora
     supervisa AYACUCHO - MAGISTERIAL y sigue vendiendo ahí»; la fila pasó a
     «Supervisor · También vende», Supervisores 2 → 3, Asesores 13 → 12,
     «Historial (1)».

**Limitación declarada**: el reingreso solo se verificó hasta la validación
del formulario; la lectura de producción tras el despliegue confirma que la
migración corrió y que Personas carga con las acciones, sin ejecutar ninguna.

