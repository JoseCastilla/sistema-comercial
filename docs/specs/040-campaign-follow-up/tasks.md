# SPEC-040 — Tareas

## Definición

- [x] `spec.md` con origen, alcance, reglas BR-001 a BR-009 y criterios.
- [x] `plan.md`: reutilización de la barra en vivo, filtrado en memoria a
      propósito, alcance del tablero, sin migración.

## Construcción (05/09/2026)

- [x] Regla pura `recovery-follow-up.ts` en `@repo/validation`: tramos de
      próxima acción excluyentes en hora de Lima, «sin primer contacto» como
      lo cuenta el tablero, `selectFollowUpCases` (8 pruebas).
- [x] `QueueFilters` con selectores `extras` genéricos —última tipificación,
      próxima acción, primer contacto, gestión de hoy, estado— sin acoplar
      la barra a la pantalla; departamento, plan y antigüedad pasan a ser
      opcionales (4 pruebas nuevas).
- [x] Página `/recovery/follow-up`: cartera asignada dentro del alcance,
      búsqueda unificada, asesor actual, paginación acotada, cabecera con
      cuatro cifras que abren su lista, ficha con vuelta a Seguimiento.
- [x] Tablero: «Asignados», «Trabajados hoy», «Sin primer contacto» y
      «Agenda vencida» enlazan a la lista con su filtro; el nombre de cada
      asesor abre su cartera y su «Sin contacto» abre solo esos.
- [x] Accesos: botón «Seguimiento» junto a «Tablero del día» en triage y en
      Preparar campaña; el shell ya asocia `/recovery` a Campañas.

## Verificación

- [x] Pruebas puras y de componente en verde; tipos y lint limpios.
- [x] Paridad indicador ↔ lista comprobada con sesión de administrador
      (ver `verification.md`), incluida una discrepancia encontrada y
      corregida antes de entregar.
- [ ] Recorrido con sesión de supervisor: `?advisor=` de otro equipo debe
      dar cero filas (la regla está cubierta por el alcance; falta la cuenta
      de prueba).
