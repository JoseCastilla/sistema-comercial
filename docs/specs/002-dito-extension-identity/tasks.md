# SPEC-002 — Tareas

## Fase 1 — Contrato y reglas

- [x] **T-001** Añadir contrato y validación del envelope 2.0.
- [x] **T-002** Mantener pruebas de compatibilidad con 1.0.
- [x] **T-003** Añadir pruebas de correo corporativo e instalación UUID.

## Fase 2 — Persistencia

- [x] **T-010** Añadir identidad del remitente a `DitoOrder`.
- [x] **T-011** Crear y revisar migración compatible.
- [x] **T-012** Aplicar migración local y regenerar Prisma.

## Fase 3 — Resolución

- [x] **T-020** Resolver destino compuesto por correo corporativo.
- [x] **T-021** Detectar conflicto de instalación y correo.
- [x] **T-022** Persistir agente y equipo de forma conjunta.
- [x] **T-023** Conservar resolución heredada únicamente para 1.0.
- [x] **T-024** Añadir pruebas de servicio y repositorio.

## Fase 4 — Integraciones

- [x] **T-030** Actualizar extensión con nombre, correo e instalación inmutables desde UI.
- [x] **T-031** Verificar respuesta HTTP y bloquear doble envío.
- [x] **T-032** Actualizar normalizador n8n para envelope 2.0.
- [ ] **T-033** Validar piloto con correos corporativos distintos.

## Fase 5 — Cierre

- [x] **T-040** Ejecutar lint, tipos, builds y suites relevantes.
- [x] **T-041** Registrar evidencia técnica y separar la validación operativa pendiente.
- [ ] **T-042** Marcar SPEC como `VERIFIED`.
