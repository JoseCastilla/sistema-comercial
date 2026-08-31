# Verificación — SPEC-036

## Auditoría previa a retirar

Antes de eliminar nada se revisó qué referenciaba la herramienta:

- `portability-frame.tsx` no consultaba: renderizaba un aviso y un enlace a
  `consulta.portabilidad.pe` con `target="_blank"`. El sistema no enviaba el
  número, no recibía el resultado y no guardaba evidencia.
- Sus únicas referencias en código eran su propia página y el enlace de la
  sub-navegación.
- Las tres menciones a `consulta.portabilidad.pe` en `docs/` corresponden al
  **reporte de portabilidad** de SPEC-029 y SPEC-030 —la fuente que alimenta el
  cruce de recuperación—, no a la herramienta. **Se conservan** (BR-004).
- El proxy `tools/portability/embed/route.ts` del commit original ya había sido
  retirado en `34971df`; no quedaba código de integración por limpiar.

## Automatizada — 30/08/2026

- [x] `pnpm run check-types` en `apps/web` sin errores.
- [x] `pnpm run lint` en `apps/web` sin advertencias.

## Visual — sesión real, 30/08/2026

- [x] **AC-002:** `/tools/portability` devuelve 404.
- [x] **AC-003:** la página de líneas ya no renderiza la sub-navegación
      (`nav[aria-label="Herramientas de consulta"]` ausente).
- [x] **AC-001:** la navegación de escritorio muestra "Checa tus líneas ·
      Líneas asociadas a un documento"; la móvil, "Líneas". Ninguna promete
      portabilidad.
- [x] El encabezado de la página quedó en singular: "Consulta externa · Checa
      tus líneas".

## Nota de arquitectura

Esta superficie se había construido sin spec, saltándose el flujo del repo. La
documentación se crea ahora junto con la corrección, y BR-001 deja por escrito
el criterio que evita repetir el caso: una herramienta que solo abre un portal
ajeno no pertenece al sistema.
