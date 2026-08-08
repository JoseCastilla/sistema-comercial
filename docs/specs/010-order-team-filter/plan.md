# SPEC-010 — Plan

1. Cargar equipos visibles según rol y membresías activas.
2. Construir el filtro Prisma de autorización antes del filtro solicitado.
3. Resolver `team` contra el catálogo permitido y aplicar equipo o pool
   huérfano.
4. Reutilizar `resolveDitoOrderVisibility` para permisos por fila y mutaciones.
5. Enmascarar datos personales del pool para Supervisor.
6. Añadir selector compartido y conservarlo en todos los enlaces y formularios.
7. Validar por rol, URL manipulada, tipos, lint y navegador local.
