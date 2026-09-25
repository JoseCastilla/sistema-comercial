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

- **25/09/2026** — Fase 2 en producción (`3e50115`), sesión de la
  supervisora, solo lectura. Cada tarjeta tiene «Ver su día». El de
  Francesco abre «El día de FRANCESCO ANDREE GALA ZACARIAS» con su franja
  (hoy 1 venta, comisión, cuota 43 de 60), «Citas que ya pasaron 1»,
  «Ventas caídas por salvar 5», «Pedidos que te necesitan 2» y «Campaña
  37»: lo mismo que su tarjeta en «Hoy en mi equipo». Ningún botón
  «Registrar gestión»; los casos abren su ficha sin `from=mi-dia`. Un
  identificador fuera del equipo responde 404.

Observaciones corregidas el mismo día: en «Ver su día» la franja y los
títulos hablan del asesor («Su comisión», «le faltan», «Pedidos que lo
necesitan»; `voice="su"`), y «no encontrado» es una página propia en
español con «Ir al inicio» (`app/not-found.tsx`).

