# SPEC-025 — Navegación colapsable según rol

## Problema

La navegación fija reduce el ancho operativo de la bandeja y muestra a los
asesores módulos administrativos deshabilitados que no pueden utilizar.

## Requisitos

- Permitir contraer y expandir la navegación en escritorio.
- Recordar la preferencia en el navegador del usuario.
- Iniciar contraída para `AGENT` y expandida para los demás roles, salvo que
  exista una preferencia guardada.
- Mostrar a `AGENT`, `SUPERVISOR` y `BACKOFFICE` únicamente módulos disponibles.
- Mantener todos los módulos administrativos para `ADMIN`.
- Conservar navegación móvil adaptada a la cantidad real de opciones.
- No modificar permisos ni rutas del servidor.
