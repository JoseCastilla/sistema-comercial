# Verificación — SPEC-051

## Auditoría previa — 12/09/2026

Referencias encontradas antes de borrar:

- Código: `app/tools/{page,layout,error,loading}.tsx`,
  `app/tools/lines/page.tsx`, `features/external-tools/components/checa-tus-lineas-frame.tsx`.
- Menú: `components/layout/commercial-app-shell.tsx` (sección, prefijo,
  icono, entrada de escritorio y móvil).
- Pruebas: dos aserciones en `__tests__/navegacion.test.ts`.
- Estilos: ninguno propio. `shell.css` define columnas para 2, 4 y 6
  entradas; con 5 entradas aplica la regla base de 5 columnas, así que no
  hizo falta tocarlo.
- Cabeceras: `next.config.js` y `proxy.ts` no fijaban `frame-src` para el
  portal; no había configuración que retirar.
- Documentación: SPEC-036 (la describe), SPEC-045 BR-011/AC-013 (sus textos)
  y SPEC-037 (mención histórica de `/tools/external-preview`). Se conservan
  como historia (BR-003).

## Automatizada — 12/09/2026

- [x] **AC-003:** `git grep -i "checa\|tools/lines\|external-tools\|checatuslineas" -- apps packages`
      sin resultados.
- [x] **AC-005:** `tsc --noEmit` en `apps/web` sin errores tras borrar
      `.next` (antes fallaba solo por `.next/types/validator.ts`, que apuntaba
      a las rutas borradas).
- [x] **AC-005:** `eslint` sobre los dos archivos tocados, sin advertencias.
- [x] **AC-005:** `vitest run` en `apps/web`: 31 archivos, 218 pruebas en verde.

## Producción

- [ ] **AC-001 / AC-002 / AC-004:** pendiente tras la entrega.
