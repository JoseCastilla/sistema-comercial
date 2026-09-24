# SPEC-063 — Verificación

- **24/09/2026** — Fase 0: `node --test test/my-day.test.mjs`, 11 de 11:
  cita vencida primero; cita a menos de 2 horas en «ahora» y la de más tarde
  plegada; una cita de mañana no es de hoy; el día se corta en Lima (23:30 de
  Lima es hoy); recupero sin primer contacto es venta en riesgo aunque no
  venza; seguimiento solo sube si venció; en verificación no aparece; orden
  por tramo, plazo y orden del módulo (AC-001); plazos «venció hace 25 min»,
  «en 40 min», «a las 15:00», «el 25/09 a las 09:30».
- **24/09/2026** — Fase 1 construida: tipos, lint (`--max-warnings 0`) y 219
  pruebas de web en verde. Línea base en producción con la cuenta de asesor
  (solo lectura): entra a «Seguimiento de órdenes» con el menú contraído
  (íconos sin nombre) y tres avisos separados — 42 entregas fallidas por
  gestionar, 18 pedidos por recuperar, 7 fuera de plazo.

- **24/09/2026** — Recorrido local con sesión de asesor de prueba (copia
  local de datos, solo lectura):
  - AC-007: `/` y el login llevan a `/my-day`; «Mi día» es el primer ítem
    del menú lateral y del móvil (6 ítems en una fila).
  - AC-001/AC-003: «Ahora» muestra 2 pedidos en «Entregas fallidas por
    gestionar» con la acción de la logística («Reingresar la venta…»,
    «Contactar al cliente…») y luego 2 casos de campaña vencidos desde el
    05/09. «Ver pedido» abre Pedidos con ese único pedido en su día.
  - BR-010: «Cómo se calcula tu comisión» lista postpago S/ 25,00, prepago
    S/ 12,50, alta nueva sin comisión, los dos bonos con sus tramos y el
    extra por confirmada, leídos de la política.
  - Hallazgo corregido: del 16 al 24 la franja decía «Te faltan 30 para
    S/ 200» sobre una ventana ya cerrada (SPEC-038 BR-015 muestra la última
    que cerró). Ahora dice «Bono días 1 al 15 · cerrado — solo suman las
    ventas de esos días al confirmarse. El siguiente bono empieza el día 25».
  - AC-011: a 1 338 × 845 en oscuro y a 375 × 812 en claro, sin
    desplazamiento lateral; en móvil la franja pasó a 2 × 2 para que
    «Ahora» quede en la primera pantalla, y «Cerrar sesión» de la cabecera
    móvil quedó solo con icono (36 × 36).

- **24/09/2026** — Producción, tras desplegar `91657b3`, con la cuenta de
  asesor (solo lectura):
  - AC-007: `/` lleva a `/my-day`; «Mi día» es el primer ítem del menú.
  - AC-005: la franja dice S/ 1 387,50 estimados (S/ 1 187,50 por 51
    pagables + S/ 200,00 de bonos), 38 confirmadas en la ventana cerrada, 38
    de 100 de cuota y 1 entregada por activar. `/performance` para la misma
    asesora muestra S/ 1 387,50, S/ 1 187,50 de base, 51 pagables, 38/100 y
    1 por activar: coinciden.
  - «Ahora» abre con 16 ventas caídas con el primer contacto vencido, la más
    antigua desde el 02/09. Es trabajo real que antes no estaba a la vista
    de la asesora en su entrada.

- **24/09/2026** — Fase 1.1 en local con la asesora de prueba: sus 2 pedidos
  de ventas del 10/08 salieron de «Ahora» y quedaron en «Ventas antiguas por
  recuperar» (plegado, sin rojo, «Venta del 10/08 · pedido …»); la tarjeta
  dice «Cuota de setiembre — 0 entregadas · sin cuota asignada». Regla: 16
  de 16 pruebas; web: tipos, lint y 219 pruebas en verde.

- **24/09/2026** — Fase 1.1 en producción (`39d42c7`), cuenta de asesor, solo
  lectura: «Cuota de setiembre — 52 de 100, te faltan 48»; «Ahora» con 2
  ventas caídas calientes (la del 23/09 primero, «venció hace 10 min»), 7
  pedidos y la campaña; «Ventas antiguas por recuperar» con 20, plegado,
  ninguna en rojo, de la venta del 16/09 a la del 10/08.

- **24/09/2026** — Fase 2:
  - `mi-dia-gestion-en-fila.test.tsx` (2 pruebas): un pedido no ofrece
    editor y lleva a Pedidos; guardar desde la fila marca «Gestionado: No
    contesta · Próxima acción: 25/09, 10:00» y «Guardar y siguiente» abre el
    editor del caso siguiente saltando el pedido, sin el aviso de «gestión
    sin guardar».
  - **Defecto encontrado y corregido:** esa misma prueba falló primero. El
    borrador compartido (`campaign-draft-context.tsx`) leía `dirty` del
    estado: el editor lo marca limpio y en el mismo efecto pide el siguiente
    caso, y `startEditing` todavía lo veía sucio, así que dejaba el cambio en
    espera. Afecta igual a la cola de Campañas (SPEC-049 BR-016), cuya
    prueba simulaba `onNext` y no lo detectaba. Ahora se lee de una
    referencia al día.
  - Local, asesora de prueba, sin guardar (copia con datos reales): el
    editor se abre dentro de la fila con la última gestión, atajos N/I/R/A,
    teléfono sugerido y «Guardar y siguiente»; Esc lo cierra.
  - Web: tipos, lint y 221 pruebas en verde.

- **24/09/2026** — Fase 2 en producción (`aec7032`), cuenta de asesor, sin
  guardar: 20 casos con «Registrar gestión»; el editor abre en la fila con
  atajos N/I/R/A, la lista completa de resultados y «Guardar gestión»,
  «Guardar y siguiente» y «Cancelar»; Esc lo cierra.
- **24/09/2026** — BR-019 pasa a la cuota mensual definitiva de SPEC-064
  (`MONTH`, 45 por defecto rotulada «Cuota por defecto»).

- **24/09/2026** — Fase 4 construida: `my-day-sales.test.mjs` 6 de 6 (cada
  grupo, alta nueva sin comisión aunque esté activada, y «Ya pagan» igual a
  `calculatePerformanceMetrics(...).baseCommissionCents`);
  `mi-dia-ventas-del-mes.test.tsx` 3 de 3 (resumen por grupo, «S/ 12.50 al
  activarse», «S/ 25.00 si la recuperas», sin ventas no se muestra). Web:
  tipos, lint y 224 pruebas en verde. La asesora de prueba local no tiene
  ventas este mes: la lectura visual queda para producción.

- **24/09/2026** — Fase 4 en producción (`f5dc745`), cuenta de asesor, solo
  lectura: «Tus 81 ventas de setiembre de 2026» con Ya pagan 52 · S/ 1 212,50;
  Esperan activación 3 · S/ 75,00; En camino 4 · S/ 87,50; Caídas 19 ·
  S/ 400,00; No pagan comisión 3 (altas nuevas). Suman 81. «Ya pagan» es
  igual a la franja: «S/ 1 212,50 por 52 ventas pagables». Cada venta dice
  su monto y qué falta («S/ 25,00 al activarse», «si la recuperas»).

- **24/09/2026** — Fase 3 construida: tipos, lint y 224 pruebas de web en
  verde. Local, asesora de prueba: `/api/order-escalations/notifications`
  devuelve ahora `recoveryOverdue` también al asesor (0 en la copia local) y
  Mi agenda carga sin error. Los datos reales se leen en producción.

- **24/09/2026** — Fase 5, supervisor vendedor: `menu-mi-dia.test.tsx` 4 de
  4 (asesor y supervisor vendedor ven «Mi día» en el menú lateral y en el
  móvil; supervisor que no vende y administrador, no). En producción, con
  sesión de administrador, el menú no ofrece «Mi día».

Pendiente: AC-010 (lista vacía) con un asesor sin pendientes; fase 3 con
sesión de asesor; piezas shadcn/ui.
