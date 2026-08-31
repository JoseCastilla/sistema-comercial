# Tareas — SPEC-026

**Estado:** `IMPLEMENTED_BY_SPEC_030` — reconciliado el 31/08/2026.

Esta spec definió el caso de recuperación comercial; su motor se construyó
dentro de la **fase 5 de SPEC-030**, que unificó ambas puertas de entrada
sobre `recovery_cases`. Las tareas de implementación de abajo quedan cerradas
con la referencia a dónde vive cada una, para que el inventario deje de
contarlas dos veces. Lo que siga pendiente se sigue en SPEC-030.

## Definición

- [x] Auditar el filtro actual de recuperos.
- [x] Definir propiedad, permisos y regla antifraude.
- [x] Definir el caso comercial de referencia.
- [x] Definir entrada automática, prioridad y cadencia inicial.
- [x] Definir resultados recuperado y perdido.

## Implementación — realizada en SPEC-030 fase 5

- [x] Modelo y migración → `20260830100000_add_internal_recovery_gate`
      (orden origen, asesor y equipo originales, motivo, observación y
      prioridad sobre `recovery_cases`).
- [x] Creación automática idempotente → `openInternalRecoveryCase`, enganchada
      en las dos transacciones que mutan estado; un índice parcial único
      garantiza un solo caso abierto por orden origen.
- [x] Validación compartida → `@repo/validation/recovery-internal-gate`
      (elegibilidad, motivo por estado × motivo × submotivo, prioridad, veto
      del originador, cadencia).
- [x] Acciones de servidor → envío manual, reasignación, registro de intentos
      y resolución, todas dentro de transacción y con alcance por rol.
- [x] Envío, reasignación y resolución en UI → panel en la tarjeta del pedido,
      bandeja `/recovery/sales` y ficha `/recovery/sales/[caseId]`.
- [x] Agenda e historial de intentos → tabla `recovery_case_attempts`
      inmutable, con agenda que suspende la cadencia y pausa por rechazo.
- [x] Vincular nueva orden al recuperar → resolución `RECOVERED` con
      sugerencia por documento y confirmación humana.
- [x] Verificado con sesiones reales AGENT y SUPERVISOR el 30/08/2026.

## Pendiente — se sigue en SPEC-030

- [ ] Métricas de tiempo en recupero y tasa de salvado por asesor y equipo
      (SPEC-030 BR-070).
- [ ] Verificación con `BACKOFFICE` y con un supervisor **vendedor**, que la
      organización aún no tiene (SPEC-030 BR-050b).
