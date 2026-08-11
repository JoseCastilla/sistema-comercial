# SPEC-018 — Modo oscuro escalable

**Estado:** `IMPLEMENTED_LOCAL`
**Fecha:** 2026-08-11

## Problema

Los turnos nocturnos trabajan con una interfaz diseñada únicamente para fondos
claros. Reducir el brillo mediante un tema oscuro mejora el confort, pero una
implementación por página duplicaría estilos y produciría contrastes
inconsistentes.

## Solución

Agregar preferencias Sistema, Claro y Oscuro sobre una única capa de tokens
semánticos. La preferencia se aplica antes de hidratar la aplicación, se guarda
en el dispositivo y controla también componentes nativos mediante
`color-scheme`.

## Reglas

- **BR-001:** Sistema es la preferencia inicial y sigue al sistema operativo.
- **BR-002:** la selección se conserva localmente sin añadir estado a la base.
- **BR-003:** el tema se aplica antes del primer render para evitar destellos.
- **BR-004:** las páginas consumen colores semánticos; no mantienen paletas
  paralelas ni variantes oscuras locales.
- **BR-005:** los estados éxito, advertencia, peligro e información conservan
  contraste y significado en ambos temas.
- **BR-006:** el control vive en el shell y no se repite dentro de cada módulo.

## Criterios de aceptación

- Cambiar de tema actualiza toda la aplicación sin recargar.
- La preferencia sobrevive navegación y recarga.
- Sistema responde a cambios del sistema operativo.
- Login, Rendimiento, Pedidos, Ventas, Personas y Equipos son legibles.
- El control es accesible por teclado en escritorio y móvil.
- Tipos, lint, pruebas y compilación finalizan correctamente.
