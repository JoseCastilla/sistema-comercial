# SPEC-086 — Ventas enviadas que no llegaron a Máximo

**Estado:** `VERIFICADA` — José, 23/10/2026: «las ventas enviadas y que no
llegaron a Máximo deberían levantar una alerta; por ahora debe ser visual
para reportar y escalar este caso con logística».

**Versión:** 0.1
**Fecha:** 2026-10-23

## 1. Origen

Al cruzar 348 pedidos con su estado en DITO (SPEC-029 §13), 2 de 25
enviadas no aparecían en el historial de Máximo: 1977220838 y 1978410063.
Una venta enviada que logística no registró no se entrega nunca, y nadie se
entera porque la sincronización descartaba la respuesta `found: false`.

Máximo no publica al instante. Su historial es un CSV importado cada cierto
tiempo (`freshness.imported_at`). Una venta recién enviada puede no estar
todavía sin que haya un problema.

## 2. Reglas

- **BR-001 — Qué es alerta.** Una venta en estado Enviado, consultada en
  Máximo, que no aparece, cuando:
  - Máximo ya importó datos **al menos 2 horas posteriores** al envío; y
  - se envió **dentro de lo que cubre el historial de Máximo**, que es el mes
    en curso: desde el inicio del mes de su importación, o desde antes si
    alguna toma devuelta en la consulta lo prueba.

  La hora del envío es el último cambio de estado de la venta.
- **BR-002 — Se guarda lo que no aparece.** Cada consulta sin resultado deja
  la venta registrada con la primera vez que faltó, la última consulta y la
  hora de los datos de Máximo. En cuanto Máximo la registra, se borra.
- **BR-003 — La alerta se recalcula en cada consulta.** Si deja de cumplirse,
  se apaga; si sigue, conserva la hora en que empezó.

*Corregido el 23/10/2026 tras la primera corrida en producción.* La primera
versión no miraba la cobertura y conservaba la alerta para siempre: salieron
11, y 10 eran ventas enviadas entre el 29/08 y el 29/09, anteriores al
historial.
- **BR-004 — Se ve en la venta:** insignia «No está en Máximo» en la fila y,
  en el panel, un aviso que dice que hay que reportarla a logística, con la
  hora del envío, desde cuándo falta y de cuándo son los datos de Máximo.
- **BR-005 — Se ve en Pedidos:** una franja con cuántas hay y un enlace que
  lista solo esas (`sinmaximo=1`). La lista se suelta al cambiar de vista.
- **BR-006 — Siempre del mes en curso** (José, 23/10/2026), en Pedidos y en
  Logística, aunque arriba se elija otro período. La primera versión era de
  cualquier fecha.
- **BR-007 — Lista para reportar en Logística:** código de pedido, asesor,
  hora del envío y desde cuándo falta, con la cifra en la cabecera.
- **BR-008 — Solo visual por ahora.** No se escala ni se notifica sola.

## 3. Fuera de alcance

- Escalar o notificar a logística desde el sistema.
- Abiertas y canceladas que no aparecen: no son alerta.

## 4. Criterios de aceptación

- **AC-001:** una enviada ausente con datos de Máximo 2 horas posteriores al
  envío muestra la insignia y el aviso; con datos anteriores, no.
- **AC-002:** la franja cuenta lo mismo que abre su enlace.
- **AC-003:** cuando Máximo registra la venta, la alerta desaparece en la
  siguiente consulta.
