# SPEC-051 — Retiro de «Checa tus líneas»

**Estado:** `VERIFICADA` — `/tools/lines` responde 404 en producción y el menú ya no la muestra (24/09/2026)

**Versión:** 1.0
**Fecha:** 2026-09-12

## Problema

«Checa tus líneas» (`/tools/lines`) embebía el portal de OSIPTEL en un marco.
José confirmó el 12/09/2026 que el equipo no la usa. Ya en SPEC-036 BR-001
se había escrito que una herramienta solo pertenece al sistema si el sistema
participa de la consulta; esta no enviaba el documento, no recibía el
resultado y no dejaba rastro. Ocupaba una entrada del menú de escritorio y
una de las seis del menú móvil sin aportar trabajo.

## Objetivo

Que el módulo deje de existir en el producto sin dejar residuos: ni rutas, ni
componentes, ni entradas de menú, ni pruebas que lo nombren.

## Reglas de negocio

- **BR-001:** la superficie `/tools` se retira completa. Al quedar sin
  herramientas, no se conserva una página vacía ni una redirección.
- **BR-002:** retirar la herramienta no toca el conocimiento de dominio sobre
  portabilidad: los filtros de portabilidad del recupero (SPEC-029, SPEC-030)
  son fuentes de datos del proceso y siguen vigentes (misma regla que
  SPEC-036 BR-004).
- **BR-003:** las specs anteriores que la describen no se borran: se marcan
  como sustituidas por esta, según `docs/specs/README.md`.

## Criterios de aceptación

- **AC-001:** la navegación de escritorio ya no ofrece «Checa tus líneas» y la
  móvil ya no ofrece «Líneas».
- **AC-002:** `/tools` y `/tools/lines` responden 404.
- **AC-003:** ningún archivo de `apps/` ni `packages/` menciona la ruta, el
  componente ni el portal (`checatuslineas.osiptel.gob.pe`).
- **AC-004:** el menú móvil ajusta su número de columnas a las entradas que
  quedan (5 asesor y back office, 6 supervisor, 8 administrador).
- **AC-005:** tipos, lint y pruebas de `apps/web` en verde.

## Fuera de alcance

- Unificar la consulta por DNI con otras consultas bajo «Consultas» (decisión
  pendiente de SPEC-036): sin otras herramientas, deja de tener objeto.
