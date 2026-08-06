# SPEC-004 — Plan

1. Confirmar la relación GitHub → EasyPanel y la configuración de construcción.
2. Auditar Dockerfiles, migraciones y archivos que entrarían al repositorio.
3. Incorporar el paso previo de migración al arranque del API.
4. Corregir redundancias del esquema sin reescribir migraciones ya aplicadas.
5. Ejecutar la validación integral local.
6. Revisar el conjunto exacto de cambios que llegará a producción.
7. Enviar a `main` únicamente con autorización explícita.
8. Verificar salud y experiencia en el dominio productivo.

## Estrategia de recuperación

- EasyPanel conserva el contenedor anterior si el nuevo no alcanza estado saludable.
- Las migraciones de esta entrega son aditivas; el código anterior puede seguir operando durante el reemplazo.
- Una reversión de aplicación no elimina columnas ni datos incorporados por las migraciones.
