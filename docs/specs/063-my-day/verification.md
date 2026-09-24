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

Pendiente: AC-005 (comparar con `/performance` en producción, donde el mes
tiene ventas), AC-010 (lista vacía) y lectura en producción.
