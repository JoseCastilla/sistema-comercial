# Tasks — SPEC-051

- [x] Auditar referencias (`checa`, `tools/lines`, `external-tools`, portal
      de OSIPTEL) en `apps/`, `packages/` y `docs/`.
- [x] Borrar `apps/web/src/app/tools/` y `apps/web/src/features/external-tools/`.
- [x] Quitar la sección `tools` de `commercial-app-shell.tsx` (tipo, prefijo,
      icono, entrada de escritorio, entrada móvil) y ajustar `data-items`.
- [x] Quitar las aserciones de `/tools` de `navegacion.test.ts`.
- [x] Borrar `apps/web/.next` con los tipos generados de las rutas retiradas.
- [x] Marcar SPEC-036 `SUSTITUIDA` y anotar SPEC-045 BR-011 y AC-013.
- [x] Tipos, lint y pruebas de `apps/web`.
- [ ] Confirmar en producción que `/tools/lines` responde 404 y que el menú
      no muestra la entrada.
