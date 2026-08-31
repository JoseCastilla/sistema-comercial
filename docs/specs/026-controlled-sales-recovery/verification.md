# Verificación — SPEC-026

## Estado actual

- El filtro vigente incluye `SENT + NOT_DELIVERED` y `CANCELLED`.
- La orden local `1942469714A` está `OPEN`, pertenece a Steven y al equipo
  Huancayo.
- La observación del OL aún no existe en la copia local.
- La orden local `1942303517A` está `CANCELLED`, atribuida a Estefany y al
  equipo Magisterial. El resultado comercial informado es pérdida frente a otra
  agencia.

## Criterios del incremento

- Enviar a recupero no elimina ni cambia silenciosamente al propietario.
- El motivo comercial queda separado del estado logístico.
- Dos usuarios no pueden tomar el mismo caso simultáneamente.
- Los agentes no pueden apropiarse de casos ajenos.
- La resolución conserva una línea de tiempo auditable.
- SLA de entrega y tiempo de recupero se muestran como conceptos distintos.
- Una cancelación genera como máximo un caso abierto de recupero.
- Resolver como recuperada exige vincular una nueva orden.
- Resolver como perdida exige un motivo estructurado.
- El caso `1942303517A` puede clasificarse como perdido frente a otra agencia
  sin reabrir ni modificar su orden original.
