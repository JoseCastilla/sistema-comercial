# SPEC-064 — Verificación

- **24/09/2026** — Origen comprobado en producción con la cuenta de asesor
  (solo lectura): del 1 al 15, 40 pedidos entregados (38 portabilidades); del
  16 al 24, 15 entregados (14 portabilidades); 52 portabilidades entregadas
  en el mes y 51 pagables. Rendimiento mostraba «38/100» porque medía la
  cuota contra la ventana del 1 al 15.

- **24/09/2026** — Construcción:
  - Migraciones en local: agosto tenía solo cuota de la segunda ventana y se
    copió a `MONTH`; repetir el relleno dentro de una transacción inserta 0
    filas (idempotente).
  - Reglas: 9 de 9 en `performance-quota.test.mjs` (mensual por defecto 45).
  - Web: tipos, lint y 221 pruebas en verde.
  - Local, asesora de prueba sin cuota asignada: Rendimiento dice «Cuota del
    mes 0/45 · cuota por defecto» y «Cuota de setiembre de 2026 — ventas
    registradas del 1 al 30, mes en curso».
  - El servidor de desarrollo tuvo que reiniciarse tras regenerar el
    cliente de Prisma: con el cliente viejo en memoria rechazaba `MONTH`.

Pendiente: pantalla de Cuotas con sesión de administrador o líder, y lectura
en producción (la misma cifra en «Mi día», Rendimiento y Cuotas).
