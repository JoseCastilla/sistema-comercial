# SPEC-069 — Plan de implementación

## 1. Datos

`features/team-today/server/get-team-today.ts`:

1. Asesores del alcance: miembros activos con `salesEnabled` de los equipos
   que el supervisor supervisa (misma consulta que Recupero de ventas), sin
   el propio supervisor.
2. Por cada asesor, `getMyDay(organizationId, userId, now)` en paralelo
   (`Promise.all`). No hay reglas nuevas: se resume lo que ya calcula
   «Mi día».
3. Resumen por asesor (función pura en `@repo/validation/team-today.ts`,
   con pruebas):
   - `now` por tipo (`venta_caida`, `cita`, `pedido`) y cuántos vencidos;
   - campaña: `campaign.total`;
   - `progress.enteredToday`, `progress.attemptsToday`,
     `progress.quota.{delivered,target}`;
   - `cold.length`;
   - hora de la última gestión (consulta aparte: el último `attempt` del
     asesor hoy).
4. Orden (BR-004): ventas calientes vencidas, citas vencidas, pedidos,
   campaña; empate por nombre.

**Costo:** `getMyDay` hace cinco lecturas; con 10 asesores son 50
consultas en paralelo. Si AC-005 no se cumple, la fase 1 pasa a lecturas
agrupadas por equipo con las mismas reglas puras; no cambia lo que se ve.

## 2. Pantalla

- Ruta `/team/today` (dentro de «Mi equipo»); el menú del supervisor la
  pone primera y `/` lleva ahí al supervisor (P-01).
- Línea del equipo, tarjetas por asesor con enlaces (BR-005), refresco
  como `MyDayRefresh`.
- Fase 2: `/team/today/[userId]` reutiliza `MyDayList` sin editor
  (`readOnly`).

## 3. Pruebas

- `team-today.test.mjs`: resumen y orden por asesor.
- `hoy-en-mi-equipo.test.tsx`: línea del equipo, tarjetas, enlaces, «Sin
  gestiones hoy» en gris antes de las 11:00 y en ámbar después.
- Producción, con la sesión de supervisora: AC-001 a AC-005.
