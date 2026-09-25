# SPEC-069 — Verificación

- **25/09/2026** — Validation 410 pruebas (`team-today.test.mjs` 4 de 4);
  web 259 (`hoy-en-mi-equipo.test.tsx` 5 de 5).

- **25/09/2026** — Producción (`335bf2b`), sesión de la supervisora, solo
  lectura. `/` lleva a `/team/today`; el menú abre con «Hoy en mi equipo».
  El equipo: «Calientes sin llamar 21 · Citas vencidas 2 · Pedidos que
  necesitan acción 7 · Gestiones hoy 4 · Cuota del equipo 216 de 285».
  Tarjetas en orden: Francesco (5 calientes sin llamar, 5 vencidas, 1 cita
  vencida, 2 pedidos), Silvia (4, 4 vencidas, 4 pedidos), Christian (6, 3
  vencidas, 1 cita), Steven (4, 3 vencidas) y Sarai (2, 2 vencidas); los
  cinco suman 21, lo mismo que Recupero de ventas por asesor (AC-001,
  AC-002), y las vencidas suman 17, lo mismo que el aviso. Cuatro asesores
  «Sin gestiones hoy» en ámbar (eran más de las 11:00); Steven, «4
  gestiones hoy · la última a las 09:50». La página cargó en 925 ms,
  incluida la redirección (AC-005). En el celular no se desplaza de lado
  (AC-004); «Equipo» se movió después al primer lugar del menú de abajo.
