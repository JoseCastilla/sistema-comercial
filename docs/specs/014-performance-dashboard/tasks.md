# SPEC-014 — Tareas

## Fase 1 — Métricas confiables

- [x] **T-001** Revisar el plan inicial y fijar el glosario canónico.
- [x] **T-010** Definir contratos compartidos de funnel, cohortes y tasas.
- [ ] **T-011** Diseñar exclusiones de pago e incidencia de activación auditada.
- [x] **T-012** Crear pruebas de fechas, cohortes, estados y alcance por rol.
- [x] **T-020** Implementar la consulta server-side de desempeño.
- [x] **T-021** Reconciliar agregados contra el conjunto de órdenes origen.
- [x] **T-022** Crear conciliación administrativa paginada con motivo por orden.
- [x] **T-030** Crear `/performance` con variantes AGENT/SUPERVISOR/ADMIN/BACKOFFICE.
- [x] **T-031** Implementar drill-down hacia `/orders` sin duplicar la bandeja.
- [x] **T-032** Integrar actualización en vivo controlada.
- [x] **T-040** Validar usabilidad, accesibilidad y rendimiento local.

## Fase 2 — Comisión base

- [ ] **T-100** Confirmar permisos de importes por rol.
- [ ] **T-101** Modelar reglas versionadas y liquidaciones mensuales.
- [ ] **T-102** Implementar cálculo idempotente y líneas por orden.
- [ ] **T-103** Crear conciliación administrativa y bloqueo de liquidación.
- [x] **T-104** Mostrar estimación propia al asesor y agregados autorizados.

## Fase 3 — Aceleradores

- [ ] **T-200** Resolver las reglas económicas pendientes de SPEC-014.
- [ ] **T-201** Especificar pruebas tabulares de cada umbral y ventana.
- [ ] **T-202** Implementar progreso, proyección y confirmación.
- [ ] **T-203** Conciliar aceleradores dentro de la liquidación mensual.

## Salida

- [ ] **T-900** Ejecutar matriz completa y builds de contenedores.
- [ ] **T-901** Validar con datos productivos anonimizados o agregados.
- [ ] **T-902** Desplegar por fase solo después de aprobación operativa.
