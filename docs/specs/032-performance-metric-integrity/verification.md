# Verificación — SPEC-032

## Automatizada — 30/08/2026

- [x] `pnpm run test` en `packages/validation`: 180 pruebas en verde,
      incluidas las 4 nuevas:
      - una portabilidad entregada y cerrada sin asesor no suma pagable ni
        comisión (AC-001);
      - dashboard y conciliación comparten la razón `UNASSIGNED` (AC-002);
      - `getLimaDayOfMonth` resuelve el día en Lima, no en UTC;
      - `filterOrdersRegisteredThroughLimaDay` recorta la cohorte del mes
        anterior hasta el día transcurrido (AC-005).
- [x] `pnpm run check-types` en `apps/web` sin errores.
- [x] `pnpm run lint` en `apps/web`, `packages/ui` y `packages/validation`
      con cero advertencias.

## Revisión de alcance (AC-003, AC-004)

- `getAccessWhere` ahora replica exactamente la traducción de la bandeja
  (`get-order-inbox.ts`): `ORGANIZATION` explícito, rama
  `SUPERVISED_TEAMS_WITH_OWN_AND_ORPHANS` con `OR` de equipos + propias +
  huérfanas, y **denegación por defecto** para cualquier tipo no reconocido
  (antes caía a organización completa).
- La consulta de vendedores primarios agrega `userId = actor` para el rol
  SUPERVISOR, de modo que el supervisor vendedor cuenta en cobertura aunque su
  equipo primario no esté supervisado. El filtro explícito de equipo sigue
  aplicando en la relación `team`, por lo que no amplía el selector de equipo.

## Visual — sesión ADMIN local, 30/08/2026

- Cohorte de agosto: 177 ingresadas, 118 entregadas, 112 portabilidades
  pagables, S/ 2,700.00 de comisión base estimada.
- **AC-002 verificado:** `/performance/reconciliation?month=2026-08` reporta
  112 pagables y S/ 2,700.00 — idéntico al dashboard. El mix también concilia:
  104 postpago × S/ 25.00 + 8 prepago × S/ 12.50 = S/ 2,700.00.
- **Suma de la tabla = KPI:** los 14 asesores del análisis detallado suman 112
  pagables (inspección por DOM), igual al KPI principal.
- **Pro-rata activo (AC-005, parcial):** el encabezado "Vs. anterior" declara
  "Comparado contra los días 1–30 del mes anterior". El KPI muestra
  "Sin base comparable" porque julio no tiene datos (la operación empezó en
  agosto), que es el comportamiento correcto; la etiqueta "vs. días 1–N" y el
  retorno a mes completo en meses cerrados quedan cubiertos por pruebas de
  dominio hasta que exista un mes previo con datos.
- **Fila "Sin asesor" (AC-001, caso negativo):** la cohorte no tiene huérfanas
  (tarjeta "Sin asesor ni equipo" = 0) y la fila no se muestra, como exige
  BR-002. El caso positivo queda cubierto por las pruebas de dominio.

## Pendiente

- **AC-003 visual:** validar con una sesión SUPERVISOR con venta habilitada
  que sus propias ventas aparecen en vista de equipo. El cambio replica el
  patrón ya verificado de la bandeja (`get-order-inbox.ts`).
