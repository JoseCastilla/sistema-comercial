# SPEC-066 — Verificación

- **25/09/2026** — Validation: `recovery-agenda-period.test.mjs` y
  `recovery-agenda.test.mjs` 20 de 20 (una vista retirada abre «Próximas»;
  «Próximas» son catorce días y avanza de a catorce). Web: tipos, lint y 244
  pruebas; `agenda-citas.test.tsx` 5 de 5 (tarjeta con hora, plazo,
  teléfono y lo acordado; atender con el editor la deja «Atendida» y quita
  reprogramar; reprogramar, cancelar e historial se abren de a uno; la
  vencida dice su fecha y una cerrada no se gestiona; la venta caída dice
  su venta). En local la página compila; la sesión de la asesora de prueba
  expiró y no se pudo recorrer.

- **25/09/2026** — Producción (`0f8a0c3`), sesión de asesora, solo lectura:
  sin citas en setiembre, la agenda mide 845 px de alto (antes 3839) y dice
  «0 llamadas acordadas en estos 14 días» y, en una línea, cómo agendar; no
  repite la cola (AC-001). «Mes» dibuja setiembre sin cifras. Un enlace viejo
  (`view=semana&tipo=reintentos`) abre «Próximas». En el celular la página
  mide 375 px de ancho y 818 de alto (antes 4456), y la rejilla del mes
  cabe (341 en 341) (AC-002).

Pendiente: ver una tarjeta con una cita real (AC-003 y AC-004 están
cubiertos por `agenda-citas.test.tsx`; la asesora no tiene citas y la sesión
local expiró).
