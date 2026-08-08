# SPEC-010 — Verificación

**Estado:** `IMPLEMENTED`
**Fecha:** 2026-08-08

## Evidencia automatizada

- `pnpm --filter @repo/validation test`: 82 pruebas aprobadas.
- `pnpm check-types`: 7 tareas aprobadas.
- `pnpm lint`: 7 tareas aprobadas sin advertencias.

## Evidencia funcional local

- Admin mostró `Todos los equipos`, `Sin asignar` y los dos equipos activos de
  la organización.
- Seleccionar `AYACUCHO - MAGISTERIAL` generó `team=<uuid>` y el enlace Hoy
  conservó el mismo equipo.
- `team=UNASSIGNED` seleccionó correctamente el pool sin asignar.
- Un UUID inexistente no se propagó a los siguientes enlaces y volvió al
  alcance predeterminado.

## Escenarios por sesión pendientes

- Supervisor: equipos supervisados, pool limitado y rechazo de equipo ajeno.
- Supervisor sin equipos: bandeja vacía.
- Agente: órdenes propias, sin selector y sin ampliación por URL.
- Backoffice: mismo alcance operativo que Admin.

## Despliegue

Autorizado por el usuario el 2026-08-08. El despliegue se realiza mediante push
a `main`; la comprobación con sesiones Supervisor y Agente permanece como
seguimiento posterior al despliegue.
