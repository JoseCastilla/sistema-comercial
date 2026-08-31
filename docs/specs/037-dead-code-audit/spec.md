# SPEC-037 — Auditoría de residuos del sistema

**Estado:** `PLANNED`
**Versión:** 0.1
**Fecha:** 2026-08-31

## Problema

El sistema creció rápido y por incrementos, y cada iteración deja residuo:
rutas que solo redirigen, componentes sin referencias, columnas que ya nadie
lee, enumeraciones cuyos valores nunca se escriben, dependencias huérfanas y
prototipos descartados. El residuo no rompe nada hoy, pero cobra intereses:
confunde a quien lee el código, ensucia las búsquedas, infla el bundle y hace
que una lectura del sistema no coincida con lo que el sistema hace.

El caso que originó esta spec: la consulta de portabilidad se retiró en
SPEC-036 y, al auditarla, aparecieron dos residuos vecinos —una ruta que solo
redirige y un proxy ya eliminado en un commit posterior— que nadie había
registrado.

## Objetivo

Recorrer el sistema completo y retirar lo que ya no forma parte de la
funcionalidad, con evidencia de que cada eliminación es segura.

## Reglas

- **BR-001:** nada se elimina sin demostrar antes que no tiene referencias.
  La búsqueda cubre código, rutas, documentación y migraciones.
- **BR-002:** una migración aplicada **nunca** se reescribe ni se borra. El
  esquema muerto se retira con una migración nueva y solo cuando se confirma
  que ninguna fila depende de él.
- **BR-003:** un valor de enumeración declarado y jamás escrito no es residuo
  automáticamente: puede ser una puerta reservada de una fase futura. Se
  distingue caso por caso contra las specs vigentes.
- **BR-004:** el residuo con valor histórico —evidencia, auditoría, snapshots
  externos— se conserva aunque no se lea. Lo inmutable es del negocio, no del
  código.
- **BR-005:** cada eliminación entra como un cambio propio y reversible, no
  como una limpieza masiva en un solo commit.

## Inventario inicial

Hallazgos ya registrados, pendientes de confirmar y resolver:

| Residuo | Ubicación | Estado |
|---|---|---|
| Ruta que solo redirige, sin referencias | `apps/web/src/app/tools/external-preview/` | Confirmado sin referencias |
| Prototipo `prospecting` descartado | rama `codex/prospecting-ux-backup-20260821` | Sus tablas ya se eliminaron de la base local; verificar si quedó código |

## Método propuesto

1. **Rutas**: cada `page.tsx` cuyo cuerpo sea solo un `redirect`, contrastado
   con quién la enlaza.
2. **Componentes y módulos**: exportaciones sin importadores.
3. **Esquema**: columnas y tablas sin lectura ni escritura en el código,
   cruzadas con las specs que las justificaron.
4. **Enumeraciones**: valores declarados que ningún camino escribe (BR-003).
5. **Dependencias**: paquetes declarados y no importados.
6. **Documentación**: specs que describen comportamiento que ya no existe.

## Criterios de aceptación

- **AC-001:** cada eliminación cita la búsqueda que prueba la ausencia de
  referencias.
- **AC-002:** tipos, lint y pruebas siguen en verde tras cada retiro.
- **AC-003:** ninguna migración previa se modifica.
- **AC-004:** lo conservado por BR-003 y BR-004 queda listado con su motivo,
  para que la próxima auditoría no vuelva a evaluarlo desde cero.

## Fuera de alcance

- Refactorizaciones de estilo o reorganización de carpetas: esto retira lo que
  sobra, no reordena lo que queda.
