# SPEC-083 — Verificación

- **26/09/2026** — La migración se aplicó en la base local sin errores. Web: tipos, lint y 298 pruebas.

- **26/09/2026, producción (administrador, sin guardar)**:
  - Pedidos carga bien (HTTP 200 en las 29 páginas del mes).
  - AC-001: de los 1414 pedidos de septiembre, 98 quedaron con origen Base y
    78 con Campaña. Ningún pedido cuya nota empieza con BASE o CAMPAÑA
    quedó sin origen.
  - El panel muestra «Origen · Base · Campaña · Otro», sin nada marcado en
    un pedido sin origen.
  - En todo el mes, `canSetSaleOrigin` es verdadero para administración.
