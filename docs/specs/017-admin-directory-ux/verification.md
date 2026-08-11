# SPEC-017 — Verificación

**Estado:** `READY_FOR_VALIDATION`
**Fecha:** 2026-08-11

## Casos

- Buscar una persona por nombre y correo.
- Combinar rol, equipo y estado; limpiar todos los filtros.
- Identificar un asesor sin equipo sin abrir su detalle.
- Crear una persona y restablecer una contraseña.
- Identificar un equipo sin supervisor desde la lista cerrada.
- Expandir un equipo y revisar nombres y correos de integrantes.
- Cambiar la función de asignación y comprobar que cambia el catálogo.
- Seleccionar un asesor de otro equipo y ver la consecuencia del traslado.
- Confirmar que personas ya asignadas al equipo no aparecen como candidatas.
- Deshabilitar un equipo conservando la confirmación existente.

## Seguridad del despliegue

- Sin migraciones.
- Sin eliminación o modificación masiva de datos.
- Sin cambios en autorización.
- Sin cambios en las acciones servidor existentes.
- Alias permanece disponible como compatibilidad no visible.

## Evidencia local obtenida

- Personas y Equipos cargan con el cliente Prisma anterior y el nuevo mediante
  aislamiento por `team.organizationId`; se eliminó la dependencia de despliegue
  simultáneo del campo `CommercialTeamMember.organizationId`.
- Búsqueda y filtro por rol comprobados con sesión ADMIN en el navegador.
- Resumen y detalle expandible de Equipos comprobados con datos locales.
- `pnpm check-types`: aprobado en los nueve paquetes.
- `pnpm lint`: aprobado sin advertencias.
- 112 pruebas del dominio compartido aprobadas.
- Imagen Docker Web compilada correctamente con el flujo de EasyPanel antes de
  separar la hoja administrativa reutilizable.
- La compilación posterior integró la hoja administrativa y generó correctamente
  las doce páginas; el empaquetado `standalone` local se detuvo únicamente al
  crear enlaces simbólicos por permisos de Windows (`EPERM`).
- Las rutas `/admin/users` y `/admin/teams` compilaron como páginas dinámicas.
- La revisión visual autenticada continúa pendiente; el navegador controlado
  llegó correctamente al acceso local y no se utilizaron credenciales guardadas.
