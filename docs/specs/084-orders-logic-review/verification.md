# SPEC-084 — Verificación

- **26/09/2026** — Web: tipos, lint y 299 pruebas.

- **26/09/2026, producción (administrador, solo lectura)**, tras 8866ca6:
  - AC-001: «Todos 1421» = Por entregar 59 + Falta activar 35 + Cerrados
    956 + 371 entregas fallidas del mes. Ya no hay pedidos sin vista.
  - AC-002: «12 por entregar →» abre 12, y «6 por activar →» abre 6.
  - AC-003: en Escaladas, «Ventas 1421», la cifra del período.
  - H6: con `plazo=vencido`, solo «Por entregar» y «Todos» lo conservan en
    su enlace, y «Falta activar» no muestra el selector de plazo.
  - AC-004 (pasar al siguiente) solo se comprobó en pruebas: verlo en
    producción exige guardar un paso, y eso no se hace aquí.
