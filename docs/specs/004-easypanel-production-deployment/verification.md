# SPEC-004 — Verificación

## Evidencia previa

- EasyPanel está conectado a `JoseCastilla/sistema-comercial`, rama `main`.
- El servicio web construye desde `/` con `apps/web/Dockerfile`.
- El dominio productivo informado es `https://app.distribuidoronline.com`.
- El repositorio ya incluía `packages/database/Dockerfile.migrate`, pero no se observó un servicio de migración independiente en EasyPanel.

## Controles incorporados

- El API ejecuta `prisma migrate deploy` antes de iniciar NestJS.
- El proceso no continúa si la migración falla.
- Una migración posterior elimina el índice parcial redundante sin reescribir migraciones aplicadas.
- Los logs del servidor web local quedan ignorados por Git.
- El Dockerfile Web acepta `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` en build para mantener consistencia durante reemplazos.
- La imagen API instala OpenSSL antes de instalar dependencias y generar Prisma Client.

## Validación pendiente

- Revisión final del diff.
- Salud y recorrido funcional después del despliegue.

## Resultados locales

- Tipos: aprobados en Contracts, Validation, Database, UI, API y Web.
- Lint: aprobado en todos los paquetes de la entrega.
- Validation: 68 pruebas aprobadas.
- API: 53 pruebas aprobadas y build aprobado.
- Web: imagen Docker Linux construida; endpoint de salud y `/login` respondieron HTTP 200 en un contenedor temporal.
- API: imagen Docker Linux construida sin advertencias de OpenSSL; el arranque ejecutó las 13 migraciones y respondió HTTP 200 en salud.
- La migración correctiva se aplicó a la base local y una segunda ejecución confirmó que no quedaban migraciones pendientes.
- El responsable confirmó que `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` quedó guardada en el servicio Web de EasyPanel.
