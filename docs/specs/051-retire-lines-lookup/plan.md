# Plan — SPEC-051

1. Auditar referencias en código, estilos, pruebas y documentación.
2. Borrar `apps/web/src/app/tools/` (página, layout, error, carga y
   redirección) y `apps/web/src/features/external-tools/`.
3. Quitar del menú la sección `tools`: tipo `ActiveSection`, prefijo de ruta,
   icono, entrada de escritorio y entrada móvil; ajustar `data-items`.
4. Quitar de `navegacion.test.ts` las aserciones sobre `/tools`.
5. Borrar la caché de compilación de Next (`apps/web/.next`), que conservaba
   los tipos de las rutas eliminadas.
6. Marcar SPEC-036 como sustituida y anotar SPEC-045 BR-011 y AC-013.
7. Verificar tipos, lint y pruebas; después de entregar, confirmar el 404 en
   producción.
