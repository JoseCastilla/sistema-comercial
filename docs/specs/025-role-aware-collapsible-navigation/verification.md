# Verificación — SPEC-025

## Automatizada

- TypeScript web: aprobado.
- Lint web y UI: aprobado.
- Formato de diferencias: aprobado.

## Navegador local

- El control cambia de “Contraer menú” a “Expandir menú”.
- Al contraer, la tabla gana ancho y mantiene visibles todas sus columnas.
- La preferencia queda almacenada en el navegador.
- La vista administrativa mantiene sus cinco módulos.
- No se registran errores ni advertencias en consola.

## Pendiente de validación por rol

- Confirmar con una sesión `AGENT` que solo aparecen Rendimiento y Pedidos y
  que la navegación inicia contraída cuando no existe preferencia previa.
