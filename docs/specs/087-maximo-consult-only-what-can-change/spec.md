# SPEC-087 — Consultar en Máximo solo lo que todavía puede cambiar

**Estado:** `IMPLEMENTADA` — José, 23/10/2026: «si una venta está
cancelada, no debería volver a consultarse mañana. Si una venta está
entregada, no debería volver a consultarse».

**Versión:** 0.1
**Fecha:** 2026-10-23

## 1. Origen

Cada corrida consulta como máximo 250 ventas, empezando por las más
antiguas. La regla anterior dejaba de consultar las cerradas, las entregadas
y las canceladas con motivo, pero seguía consultando para siempre:

- las canceladas que Máximo no tiene;
- las que Máximo ya rechazó o canceló mientras DITO siguiera en enviada;
- las abiertas que Máximo no tiene.

Con los 348 pedidos de SPEC-029 §13, la regla anterior volvía a consultar
50 cada día, sin fin. La nueva consulta las mismas 50 durante tres días y
después solo las 25 enviadas.

| Estado DITO | Anterior, cualquier día | Nueva, al quinto día |
|---|---|---|
| Cancelado | 22 | 0 |
| Enviado | 25 | 25 |
| Abierto | 3 | 0 |

**El estado lo pone el asesor a mano.** DITO crea la venta abierta y nada la
pasa sola a enviada. Una venta que salió a logística puede seguir abierta
porque nadie la marcó, y una cancelada puede no estar todavía en Máximo
porque Máximo publica por importaciones. Por eso ninguna respuesta vacía
basta para dejar de consultar: se da un plazo.

## 2. Reglas

- **BR-001 — Nunca más:** cerrada o entregada en DITO; entregada,
  rechazada o cancelada en Máximo, sin importar el estado de DITO. En los
  322 pedidos estudiados, ninguno tuvo eventos después de esos estados.
- **BR-002 — Abierta se consulta,** porque el asesor pudo olvidar marcarla
  enviada. Si Máximo la tiene, se sigue como cualquier enviada. Si Máximo
  nunca la tuvo y lleva más de 3 días registrada, se deja: quedó sin enviar.
- **BR-003 — Cancelada en DITO, solo hasta saber el motivo:** se deja de
  consultar cuando Máximo da motivo o a los 3 días de cancelada. Que Máximo
  no la tenga no basta.

*Corregido el 23/10/2026 tras las preguntas de José.* La primera versión
dejaba de consultar las abiertas y las canceladas ausentes en la primera
respuesta vacía.
- **BR-004 — Enviada se sigue consultando,** también si Máximo no la tiene:
  de eso depende la alerta de SPEC-086.
- **BR-005 — Orden:** primero lo nunca consultado, después lo que lleva más
  tiempo sin consultarse. Lo atascado ya no tapa a lo nuevo.

## 3. Criterios de aceptación

- **AC-001:** una venta entregada, rechazada o cancelada no aparece en la
  corrida siguiente.
- **AC-002:** con más de 250 elegibles, las nunca consultadas entran
  primero.
