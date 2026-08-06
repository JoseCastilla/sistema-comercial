# SPEC-005 — Tareas

## Fase 0 — Validación

- [x] **T-001** Aprobar definiciones de venta, períodos y comportamiento de pendientes anteriores.
- [x] **T-002** Capturar evidencia visual productiva de los problemas de contraste.
- [x] **T-003** Confirmar mes actual como alcance predeterminado y excluir meses anteriores de la carga inicial.

## Fase 1 — Fechas y consulta

- [x] **T-010** Crear esquema compartido para filtros de período.
- [x] **T-011** Implementar límites `America/Lima` y pruebas de cambio de fecha.
- [x] **T-012** Aplicar período y alcance de rol en PostgreSQL.
- [x] **T-013** Crear agregados exactos del período.
- [x] **T-014** Calcular pendientes activos anteriores al período.
- [x] **T-015** Incorporar paginación server-side.
- [x] **T-016** Medir consulta y añadir índices justificados.
- [ ] **T-017** Probar más de 200 ventas y aislamiento multiempresa.

## Fase 2 — Experiencia temporal

- [x] **T-020** Persistir período, estado, búsqueda y página en URL.
- [x] **T-021** Crear selector responsive Hoy/Semana/Mes actual con Histórico secundario.
- [x] **T-022** Contextualizar métricas con el período activo.
- [x] **T-023** Añadir acceso a “Pendientes anteriores”.
- [x] **T-024** Diseñar carga, vacío y error por período.

## Fase 3 — Contraste

- [x] **T-030** Ajustar tokens globales de fondo, superficie, borde y texto.
- [x] **T-031** Reforzar controles, foco, navegación y selección.
- [ ] **T-032** Revisar badges y severidades con texto/icono además de color.
- [ ] **T-033** Verificar `/orders`, Personas, Equipos y Login en 360/1280 px.
- [ ] **T-034** Medir contraste y registrar evidencia antes/después.

## Fase 4 — Validación y producción

- [x] **T-040** Ejecutar tipos, lint, pruebas y builds Docker.
- [ ] **T-041** Probar las tareas principales con ADMIN, SUPERVISOR y AGENT.
- [ ] **T-042** Desplegar a producción y comprobar Web/API/base de datos.
- [ ] **T-043** Marcar SPEC como `VERIFIED` y actualizar contexto maestro.
