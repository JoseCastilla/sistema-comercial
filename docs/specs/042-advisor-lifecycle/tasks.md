# SPEC-042 — Tareas

## Decisión (bloquea la construcción)

- [x] Las cuatro preguntas de §5 se resolvieron con la opción recomendada
      (José pidió avanzar); quedan escritas como supuestos revisables.

## Datos y reglas

- [x] Migración `add_person_lifecycle_events` + modelo Prisma.
- [x] `person-lifecycle.ts` en validation: permisos y plan de liberación,
      con pruebas (5).

## Servidor

- [x] Vista previa de consecuencias por persona (`getPersonLifecycleOverview`).
- [x] Acción de baja (estado, membresías, cartera, sesiones, evento).
- [x] Acción de reingreso (estado, rol, equipo, correo opcional, contraseña,
      evento).
- [x] Acción de promoción (rol, supervisión, venta, evento).
- [x] `assignTeamMemberAction` deja de promover en silencio; el formulario de
      Equipos ofrece solo supervisores para «también vende».

## Interfaz

- [x] Acciones por fila en Personas con panel de confirmación y números.
- [x] Historial de ciclo de vida en la fila de la persona.

## Verificación

- [x] Pruebas puras (5) y web (6).
- [x] Recorrido local con sesión de administrador: baja y promoción reales;
      reingreso hasta la validación del formulario (no se escribe una
      contraseña desde aquí).
- [x] Lectura de solo lectura en producción tras el despliegue: la migración
      corrió y Personas carga con las acciones (25 personas; 22 con baja, 19
      con promoción; administradores y back office sin acciones).
