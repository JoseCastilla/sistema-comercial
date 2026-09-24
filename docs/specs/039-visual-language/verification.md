# SPEC-039 — Verificación

- **01/09/2026** — Preparar campaña: siete paneles en cuatro, formularios de
  una línea, cifras en tira compacta, tablas con números alineados a la
  derecha y fecha de 24 horas (registrado en §6 de la spec).
- **05/09/2026** — Filtros en vivo verificados en producción por SPEC-041
  (Pedidos y Recupero de ventas), SPEC-043 (Personas y Equipos) y SPEC-044
  fase 3 (Rendimiento): estado en la URL, 300 ms, Enter, fichas quitables.
- **06/09/2026** — Higiene documental: BR-005 y `.ui-data` ya no contradicen
  a BR-003; el código usa solo `font-variant-numeric: tabular-nums`.

Pendiente: lectura visual de triage, distribución, cola del asesor,
importaciones y logística con los criterios de §7.

- **24/09/2026** — Tanda 1 de la auditoría, en local a 1 316 × 760 con
  sesión de administrador: ningún ítem del menú desborda (antes «Personas»
  medía 48 px con 62 px de contenido; ahora 69 px), el mes se lee
  «Setiembre de 2026», con el menú contraído «Cerrar sesión» queda como icono
  de 36 × 36 px bajo el avatar con nombre accesible. Prueba nueva en
  `campanas-guardar-y-siguiente.test.tsx`: Esc con observación escrita
  pregunta y, si el asesor se arrepiente, conserva lo escrito. Web 219
  pruebas, lint y tipos en verde. «Mi equipo» no se pudo recorrer con sesión
  de supervisor (el administrador se redirige a Equipos). Pendiente: lectura
  en producción.
