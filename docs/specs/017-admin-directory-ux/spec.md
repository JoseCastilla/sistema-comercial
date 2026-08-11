# SPEC-017 — Directorio de personas y equipos

**Estado:** `READY_FOR_VALIDATION`
**Fecha:** 2026-08-11

## Problema

Personas presenta formularios y acciones repetidas antes que el inventario. Los
paneles de alias heredados ocupan gran parte de la pantalla aunque la identidad
operativa actual es el correo corporativo. Equipos muestra tarjetas y formularios
completos para cada registro, dificultando revisar la estructura y detectar la
ausencia de supervisión.

## Objetivo

Convertir ambos módulos en directorios administrativos claros y escalables,
manteniendo intactos permisos, reglas de asignación, auditoría y modelo de datos.

## Reglas

- **BR-001:** el correo corporativo es la identidad operativa visible de un
  asesor; la interfaz deja de crear o mostrar vínculos de alias.
- **BR-002:** la compatibilidad de alias permanece temporalmente en API y base
  para extensiones antiguas y proyecciones heredadas.
- **BR-003:** el nombre original recibido por una orden se conserva como
  evidencia y no se modifica.
- **BR-004:** crear personas o equipos aparece bajo demanda y no desplaza el
  inventario principal.
- **BR-005:** Personas permite buscar y filtrar por rol, equipo y estado.
- **BR-006:** cada persona muestra rol, equipo operativo y estado sin abrir
  paneles secundarios.
- **BR-007:** seguridad es una acción secundaria dentro del contexto personal.
- **BR-008:** Equipos permite escanear supervisión, cantidad de asesores y
  estado antes de abrir el detalle.
- **BR-009:** un equipo activo sin supervisor se identifica como riesgo
  operativo, sin bloquear las operaciones existentes.
- **BR-010:** el selector de integrantes solo muestra candidatos compatibles con
  la función elegida y excluye quienes ya pertenecen al equipo.
- **BR-011:** trasladar un asesor anticipa equipo origen, destino y conservación
  del historial antes de confirmar.
- **BR-012:** permitir que ADMIN sea supervisor operativo queda fuera de este
  incremento porque altera reglas de autorización.

## Criterios de aceptación

- No se consulta ni renderiza `AgentAlias` en Personas.
- No se elimina ninguna tabla, fila o mecanismo heredado de alias.
- Personas conserva creación y restablecimiento de contraseña.
- Equipos conserva creación, asignación y deshabilitación.
- Ninguna asignación cambia sin confirmación explícita del formulario.
- La interfaz funciona desde 360 px y mantiene foco visible.
- No se requiere migración ni operación manual en producción.
