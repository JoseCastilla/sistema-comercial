# SPEC-039 — Tareas

- [x] Principios y reglas escritas (v1.1, 01/09/2026).
- [x] Piezas compartidas: `.ui-form-row`, `.ui-label-eyebrow`, `.ui-data`,
      `.ui-file-input`.
- [x] Preparar campaña (01/09/2026).
- [x] Filtros en vivo con el mismo patrón en Campañas, Pedidos, Recupero,
      Personas, Equipos y Rendimiento (SPEC-041, 043, 044).
- [x] BR-005 y la descripción de `.ui-data` alineadas con BR-003 (06/09/2026).
- [ ] Revisión de densidad y jerarquía tipográfica en triage, distribución y
      cola del asesor.
- [ ] Importaciones DITO y Logística.
- [ ] Cuotas y Conciliación: llevar la barra en vivo (siguen con «Aplicar»).
- [ ] Unificar las cuatro barras de filtro en un núcleo compartido y un solo
      idioma en los parámetros de URL (revisión del 05/09/2026, hallazgos 18
      y 19).

## Auditoría del 24/09/2026 (`docs/revisiones/2026-09-24-auditoria-integral.md` §6)

Tanda 1 — defectos visibles de una línea:

- [x] Menú lateral: los ítems con descripción en dos líneas se montaban sobre
      el siguiente en pantallas bajas (`grid-auto-rows: max-content`).
- [x] Mes en Rendimiento: «Setiembre De 2026» → «Setiembre de 2026»
      (mayúscula solo en la primera letra).
- [x] «Mi equipo» con menú, carga y error propios (`app/team/layout.tsx`).
- [x] Esc en la gestión en fila pregunta antes de descartar lo escrito.
- [x] «Cerrar sesión» visible como icono con el menú contraído.
- [x] Verificación en producción tras el despliegue (24/09/2026): menú
      sin ítems montados y «Setiembre de 2026» en Rendimiento.

Tanda 2 — pendientes, en orden de retorno:

- [ ] Aviso flotante de recuperos vencidos: a la cabecera, sin tapar
      contenido, con la cifra del día y sin plurales con paréntesis.
- [ ] Bandeja de pedidos a 1 280–1 440 px: ficha superpuesta, pestañas con
      desbordamiento visible.
- [ ] Contraste en oscuro de los 11 botones con `text-white` → `Button` de
      `@repo/ui` o `text-ui-on-accent`.
- [ ] Consulta DNI con el campo arriba; tarjetas de indicadores con una
      cifra y una comparación.
- [ ] Página de entrada por rol, «Mi cola» para el supervisor que vende,
      `not-found.tsx` y salida en `access-denied`.
- [ ] Glosario de interfaz y pasada de texto (asesor, pedido, operador de
      origen / courier, sin «pool» ni «el cruce»).

## Base de componentes (24/09/2026)

- [x] shadcn/ui adoptado sobre los tokens `--ui-*` (SPEC-063 fase 5):
      `apps/web/src/components/ui` (`Button`, `Badge`), `cn` y
      `components.json`. Las pantallas nuevas usan estos componentes; las
      existentes migran al tocarlas, borrando su CSS propio.
- [ ] Llevar `Button` a los 11 botones con `text-white` sobre acento o
      peligro (contraste en oscuro, auditoría §6).
