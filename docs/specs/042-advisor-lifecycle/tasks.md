# SPEC-042 — Tareas

## Decisión (bloquea la construcción)

- [ ] José responde las cuatro preguntas de §5 de la spec: ventas abiertas,
      cartera de recupero, correo en el reingreso, degradación.

## Datos y reglas

- [ ] Migración `add_person_lifecycle_events` + modelo Prisma.
- [ ] `person-lifecycle.ts` en validation: permisos y plan de liberación,
      con pruebas.

## Servidor

- [ ] Vista previa de consecuencias por persona.
- [ ] Acción de baja (estado, membresías, cartera, sesiones, evento).
- [ ] Acción de reingreso (estado, rol, equipo, contraseña, evento).
- [ ] Acción de promoción (rol, supervisión, venta, evento).
- [ ] `assignTeamMemberAction` deja de promover en silencio.

## Interfaz

- [ ] Acciones por fila en Personas con panel de confirmación y números.
- [ ] Historial de ciclo de vida en la ficha de la persona.

## Verificación

- [ ] Pruebas puras y web.
- [ ] Recorrido local con sesión de administrador.
- [ ] Lectura de solo lectura en producción tras el despliegue.
