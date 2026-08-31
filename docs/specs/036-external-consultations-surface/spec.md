# SPEC-036 — Superficie de consultas externas

**Estado:** `IMPLEMENTED_LOCAL`
**Versión:** 1.0
**Fecha:** 2026-08-30

## Problema

La superficie de consultas externas se construyó sin especificación (commits
`efc4863` y `34971df`), de modo que no existía documentación de qué herramientas
la componen ni con qué criterio entra una nueva. Esta spec cierra ese vacío y
registra la primera corrección de alcance.

Además, la entrada **Consulta portabilidad** no realizaba ninguna consulta: era
una página cuyo único contenido era un botón que abría `consulta.portabilidad.pe`
en otra pestaña. El sistema no enviaba el número, no recibía el resultado y no
guardaba rastro. Costaba una entrada de navegación, una página y un clic
adicional para entregar lo mismo que un marcador del navegador.

## Objetivo

Que la superficie contenga únicamente herramientas que aporten trabajo real
dentro del sistema, y dejar por escrito el criterio que decide si algo merece
estar aquí.

## Reglas de negocio

- **BR-001:** una herramienta solo pertenece a esta superficie si el sistema
  participa de la consulta: enviando el dato, mostrando el resultado dentro del
  espacio de trabajo, o conservando evidencia. Un enlace que únicamente abre un
  portal ajeno no califica; su lugar es el marcador del navegador del asesor.
- **BR-002:** la superficie declara con claridad cuándo el contenido proviene
  de un portal externo, para que el asesor sepa que ese material no está bajo
  control del sistema ni deja rastro auditable.
- **BR-003:** mientras exista una sola herramienta, la superficie no presenta
  sub-navegación: un menú de un elemento es ruido.
- **BR-004:** retirar una herramienta no elimina el conocimiento de dominio que
  la rodea. Las referencias a `consulta.portabilidad.pe` de SPEC-029 y SPEC-030
  describen el reporte de portabilidad que alimenta el cruce de recuperación y
  **permanecen vigentes**: son una fuente de datos del proceso, no esta
  herramienta.

## Alcance vigente

| Herramienta | Ruta | Naturaleza |
|---|---|---|
| Checa tus líneas | `/tools/lines` | Portal oficial embebido; muestra las líneas asociadas a un documento |

## Criterios de aceptación

- **AC-001:** la navegación principal ya no ofrece "Consulta portabilidad" ni
  promete portabilidad en su descripción.
- **AC-002:** `/tools/portability` deja de existir; `/tools` sigue redirigiendo
  a la única herramienta vigente.
- **AC-003:** la página de líneas no muestra sub-navegación.
- **AC-004:** el cruce de portabilidad de SPEC-030 no se ve afectado.

## Decisiones registradas

- **30/08/2026:** se retira "Consulta portabilidad" por no aportar trabajo
  dentro del sistema (BR-001).
- **Pendiente de decisión:** unificar la consulta por DNI con esta superficie
  bajo el nombre "Consultas". La evaluación concluyó que es viable —las tres
  responden la misma pregunta en el mismo momento del trabajo— con dos
  condiciones: que el saldo de créditos del servicio de DNI permanezca visible
  sin entrar al detalle, y que la interfaz distinga la consulta propia
  (auditada y con costo) de las que solo abren un portal ajeno.

## Fuera de alcance

- La integración con el regulador para consultar portabilidad desde el sistema.
  Si algún día existe, entraría como herramienta nueva cumpliendo BR-001.
- La ruta `/tools/external-preview`, que solo redirige y nadie referencia.
