# SPEC-037 — Plan

La auditoría tiene dos mitades que se pueden hacer por separado.

## Documentación (hecha el 06/09/2026)

Punto 6 del método: specs que describen comportamiento que ya no existe. Se
resolvió con la revisión de integridad del 05/09/2026 como inventario y una
sola pasada de edición sobre `docs/specs`: vocabulario cerrado de estados en
`docs/specs/README.md`, estado único en la tercera línea de cada `spec.md`,
correcciones anotadas junto a la regla original (nunca borradas) y
artefactos faltantes de SPEC-037 y SPEC-039.

## Código y base de datos (pendiente)

1. **Exportaciones sin consumidor** en `packages/validation`: 36 detectadas
   el 05/09/2026 (`domain-schemas.ts` completo, tres reglas con 51 pruebas
   que nadie ejecuta: `resolveCommercialContextAccess`, `canReassignDitoOrder`,
   `canResolveAutomaticDitoAssignment`). Cada retiro con búsqueda de
   referencias en los cuatro apps (BR-001) y contraste con las specs que las
   nombran (BR-003).
2. **Helpers duplicados** (`readText` en 8 archivos, `firstValue` en 6 con dos
   firmas, 25 `Intl.DateTimeFormat` locales, regex de UUID divergente): mover
   a `@repo/ui/format` y a un módulo de lectura de formularios.
3. **Prototipo `prospecting`**: comprobar que no queda código en `main`.
4. **Columnas y enums sin uso**: `DitoOrder.legacyMatchStatus` (`@ignore`),
   `DitoMatchStatus` duplicado de `DitoCommercialLinkStatus`, alias heredados
   (SPEC-015/017); ninguna migración aplicada se reescribe (BR-002).
5. **Validar las diez restricciones `NOT VALID`** de agosto tras revisar el
   histórico (migración `VALIDATE CONSTRAINT`).

## Verificación

Tipos, lint y pruebas en verde tras cada retiro; lista de lo conservado a
propósito con su motivo (AC-004).
