# SPEC-077 — Paleta de noche con jerarquía

**Estado:** `ENTREGADA` — aprobada por José el 25/09/2026 («sí, aplica la paleta de noche propuesta»)

**Versión:** 0.1
**Fecha:** 2026-09-25

## 1. Origen

José pidió analizar la paleta del modo Noche. La legibilidad no era el
problema: todo el texto superaba el mínimo de contraste. Lo que fallaba era
la jerarquía (contrastes WCAG medidos sobre los tokens de `tokens.css`):

| Par | Antes | Después |
|---|---|---|
| Texto principal sobre tarjeta | 16,3:1 (brillo alto en turnos largos) | 14,5:1 |
| Principal contra secundario | 1,5:1 (casi iguales) | 1,75:1 |
| Tarjeta contra fondo | 1,08:1 | 1,12:1 |
| Panel elevado contra tarjeta | 1,09:1 | 1,12:1 |
| Hover contra panel elevado | idénticos (`#1a2230`) | distintos |
| Texto tenue sobre fila elegida en azul | — | 5,0:1 |

En Pedidos, además, «Enviado» se pintaba en ámbar, el color de alerta,
aunque es el paso normal: toda la lista se veía ámbar y la alerta real se
perdía.

## 2. Reglas

- **BR-001 — Tokens de noche:**

  | Token | Valor |
  |---|---|
  | canvas | `#0a0e13` |
  | surface | `#151b24` |
  | raised | `#1d2531` |
  | subtle | `#1a212c` |
  | text | `#e7ebf1` |
  | muted | `#aab4c3` |
  | soft | `#939eb0` |
  | border | `#2e394a` |
  | border-strong | `#42506a` |

  El tenue se subió respecto de la propuesta (`#8792a4`), que daba 4,3:1
  sobre el azul de la fila elegida y no llegaba al mínimo de 4,5:1.
- **BR-002 — El estado va en una sola etiqueta**, por ejemplo «Enviado · No
  entregado».
  - «Enviado» va en gris.
  - El ámbar queda para cuando Máximo reporta un problema (SPEC-075).
  - Rojo para cancelado y «sin avance», verde para cerrado.
- **BR-003 — La fila elegida va en azul** (`accent-soft` más el borde
  izquierdo), distinta del hover.
- El modo Día no cambia, salvo la fila elegida en azul claro.
