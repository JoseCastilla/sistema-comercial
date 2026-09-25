# SPEC-067 — Verificación

- **25/09/2026** — Validation 406 pruebas (`sales-recovery-work.test.mjs` 4
  de 4). Web: tipos, lint y 252 pruebas (`ficha-caso.test.tsx` 8 de 8:
  tarjeta con plazo, frase, motivo y teléfono; editor abierto con el
  teléfono elegido; guardar dice qué pasó y refresca; cancelar no reabre;
  sin permiso no hay editor; cerrar sin nada elegido, el aviso solo al
  elegir «Recuperado», «Perdido» pide motivo). La sesión local de la
  asesora de prueba expiró: el recorrido visual va en producción.

- **25/09/2026** — Producción (`01e944b`), sesión de asesora, solo lectura.
  Ficha de Campañas desde «Mi día»: «desde el 12/09 · 0 de 3 intentos hoy
  · Ya puede portar: llámalo · Llamar al 917810530», la regla de 7 días en
  una línea y el editor de botones abierto con el teléfono elegido;
  «Volver a Mi día» lleva a `/my-day#mi-dia-…` (AC-003). «Datos del
  cliente» abre DNI, padres, teléfonos, dirección, «Ver en el mapa» y
  líneas («puede portar desde el 12/09», sin hora). «Cerrar el caso» llega
  en «Elige cómo termina…» con el botón deshabilitado y sin aviso (AC-004).
  Ficha de venta caída: «venció hace 20 h · Venta del 24/09 · pedido … ·
  Llamar ya · Acordar otro punto de entrega con el cliente, trabajo o
  casa», exactamente lo que dice su fila en «Mi día» (AC-001). En el
  celular la ficha de Campañas mide 1659 px (antes 2909) y los botones del
  resultado están a 527 px (antes el formulario, a 1875) (AC-002). Se
  corrigió después el formato de fechas que quedaba en la ficha de
  Campañas («8/9, 12:40» → «08/09 12:40»).
