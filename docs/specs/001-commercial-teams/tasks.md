# SPEC-001 — Tareas

La especificación está `APPROVED`. Ejecutar las tareas en orden y mantener trazabilidad con `BR-*`, `FR-*`, `INV-*`, `SC-*` y `AC-*`.

## Fase 0 — Aprobación

- [x] **T-001** Revisar reglas `BR-*` e invariantes `INV-*`.
- [x] **T-002** Resolver decisiones de la sección 14.
- [x] **T-003** Aprobar escenarios y criterios `AC-*`.
- [x] **T-004** Cambiar estado a `APPROVED`.

## Fase 1 — Reglas y esquema

- [x] **T-010** Crear enums compartidos y validaciones de equipo/asignación.
- [x] **T-011** Añadir pruebas de reglas puras de visibilidad, reclamación, contexto y reasignación.
- [ ] **T-012** Crear modelos `CommercialTeam` y `CommercialTeamMember`.
- [ ] **T-013** Añadir `assignedTeamId` a `DitoOrder` y `CommercialRequest`.
- [ ] **T-014** Crear `DitoOrderAssignmentHistory`.
- [ ] **T-015** Crear `DitoOrderAssignmentRequest` y sus enums.
- [ ] **T-016** Generar migración y revisar SQL e índices parciales.
- [ ] **T-017** Aplicar migración local y regenerar Prisma.
- [ ] **T-018** Añadir índice parcial para una sola solicitud `PENDING` por orden.

## Fase 2 — Administración de equipos

- [ ] **T-020** Implementar servicio de creación y deshabilitación de equipos.
- [ ] **T-021** Implementar asignación de supervisor.
- [ ] **T-022** Implementar asignación primaria de agente.
- [ ] **T-023** Crear `/admin/teams` para `ADMIN`.
- [ ] **T-024** Añadir auditoría de cambios de equipo.
- [ ] **T-025** Probar protección multiempresa.

## Fase 3 — Creación de agentes y vínculos de alias

- [ ] **T-030** Extender creación de usuario para exigir equipo al rol `AGENT`.
- [ ] **T-031** Crear autorización limitada para supervisor.
- [ ] **T-032** Permitir al supervisor crear solo `AGENT` en sus equipos.
- [ ] **T-033** Añadir compensación ante fallo de aprovisionamiento.
- [ ] **T-034** Probar que supervisor no crea roles elevados.
- [ ] **T-035** Renombrar UI a “Vínculos de alias DITO”.
- [ ] **T-036** Probar que activar/desactivar vínculos no modifica campos originales de órdenes.

## Fase 4 — Asignación automática y backfill

- [ ] **T-040** Reemplazar resolución de alias por destino compuesto usuario/equipo.
- [ ] **T-041** Crear historial `ALIAS_AUTO` en nuevas órdenes.
- [ ] **T-042** Impedir asignación si no existe equipo primario activo.
- [ ] **T-043** Crear script idempotente de equipo y membresías iniciales.
- [ ] **T-044** Crear backfill no destructivo con reporte.
- [ ] **T-045** Validar cantidades y órdenes ambiguas antes de producción.
- [ ] **T-046** Clasificar órdenes ambiguas como pool de huérfanos sin crear solicitudes artificiales.

## Fase 5 — Visibilidad jerárquica y contexto

- [ ] **T-050** Extender contexto de acceso con equipos supervisados.
- [ ] **T-051** Filtrar bandeja DITO para supervisor.
- [ ] **T-052** Filtrar leads/solicitudes para supervisor.
- [ ] **T-053** Mantener visibilidad operativa total de back office sin representarlo como supervisor.
- [ ] **T-054** Añadir pruebas de acceso denegado entre equipos.
- [ ] **T-055** Añadir pruebas entre organizaciones.
- [ ] **T-056** Implementar acceso contextual derivado de solo lectura desde orden hacia contacto/solicitud/servicio.
- [ ] **T-057** Probar mutaciones denegadas cuando el acceso es únicamente contextual.
- [ ] **T-058** Revocar acceso derivado cuando cambia responsable o equipo.

## Fase 6 — Pool de huérfanos y reclamación

- [ ] **T-060** Implementar consulta del pool para `ADMIN` y `BACKOFFICE`.
- [ ] **T-061** Implementar proyección limitada y enmascarada para `SUPERVISOR`.
- [ ] **T-062** Implementar `claimOrphanDitoOrder` con concurrencia e historial.
- [ ] **T-063** Autorizar supervisor solo hacia sus equipos.
- [ ] **T-064** Añadir pestaña “Sin asignar” en `/orders`.
- [ ] **T-065** Hacer que la orden desaparezca del pool tras reclamación exitosa.
- [ ] **T-066** Probar dos reclamaciones concurrentes.

## Fase 7 — Reasignación

- [ ] **T-070** Implementar esquema de entrada y catálogo de motivos.
- [ ] **T-071** Implementar servicio transaccional con concurrencia.
- [ ] **T-072** Crear historial completo anterior/nuevo.
- [ ] **T-073** Añadir UI de reasignación dentro del equipo.
- [ ] **T-074** Añadir transferencia entre equipos exclusiva de `ADMIN`.
- [ ] **T-075** Mostrar alias original, responsable y equipo.
- [ ] **T-076** Mostrar historial de asignación.

## Fase 8 — Solicitudes y sugerencias

- [ ] **T-080** Implementar creación de solicitud `AGENT_REQUEST`.
- [ ] **T-081** Implementar sugerencia `BACKOFFICE_SUGGESTION`.
- [ ] **T-082** Impedir más de una solicitud `PENDING` por orden.
- [ ] **T-083** Crear bandeja de pendientes para supervisor y `ADMIN`.
- [ ] **T-084** Añadir indicador pendiente en la orden.
- [ ] **T-085** Implementar aprobación usando el servicio de reclamación/reasignación.
- [ ] **T-086** Implementar rechazo y cancelación sin cambio de propiedad.
- [ ] **T-087** Confirmar que back office no aprueba ni modifica propiedad directamente.

## Fase 9 — Validación y despliegue

- [ ] **T-090** Ejecutar lint, tipos, builds y suites relevantes.
- [ ] **T-091** Validar migración en copia o entorno local equivalente.
- [ ] **T-092** Desplegar Etapa A y verificar salud.
- [ ] **T-093** Ejecutar backfill y conservar reporte.
- [ ] **T-094** Activar pool y validar conteos.
- [ ] **T-095** Activar filtros jerárquicos y acceso contextual.
- [ ] **T-096** Validar con Miguel, Erika, Jimena, otro agente y back office.
- [ ] **T-097** Completar `verification.md` con evidencia.
- [ ] **T-098** Marcar especificación `VERIFIED` y actualizar contexto maestro.
