# SPEC-016 — Bandeja operativa de recuperación

**Estado:** `READY_FOR_VALIDATION`
**Fecha:** 2026-08-11

## Problema

Los períodos Hoy, Ayer, Semana y Mes organizan las ventas por fecha de ingreso.
Sin embargo, una orden no entregada o cancelada puede continuar siendo una
oportunidad recuperable. Limitarla a Hoy, Ayer o Semana hace que desaparezca de
la vista de trabajo; enviarla a todo el histórico mezclaría meses anteriores.

## Objetivo

Dar al asesor una entrada visible y directa a todos sus pedidos por recuperar,
sin agregar una nueva página ni saturar la bandeja con controles.

## Reglas de negocio

- **BR-001:** los períodos representan cohortes por `registeredAt`; recuperación
  representa trabajo pendiente de la cohorte del mes actual, sin limitarse al
  día o semana seleccionados.
- **BR-002:** una orden está por recuperar cuando conserva
  `status = SENT` y `sentSubstatus = NOT_DELIVERED`, o cuando su
  `status = CANCELLED`.
- **BR-003:** `REJECTED` permanece en Incidencias porque requiere revisión o
  reingreso, no la misma gestión que una visita no entregada.
- **BR-004:** la cola respeta el alcance vigente: AGENT propio, SUPERVISOR sus
  equipos y huérfanas visibles, ADMIN/BACKOFFICE toda la organización.
- **BR-005:** el filtro de equipo se conserva. La búsqueda libre se limpia al
  abrir la cola para no ocultar trabajo por una consulta anterior.
- **BR-006:** una orden sale automáticamente de la cola cuando cambia de estado
  o subestado; no existe un indicador manual duplicado.
- **BR-007:** una orden cancelada permanece terminal e inmutable. Recuperarla
  significa gestionar una nueva venta, no reabrir ni alterar la orden original.
- **BR-008:** hasta contar con causas estructuradas, todas las cancelaciones del
  período consultado se consideran oportunidades potenciales de recuperación.
- **BR-009:** el acceso operativo principal abre el mes actual. Cuando otra
  vista envía un rango explícito, como Desempeño, la bandeja conserva ese rango
  para que el conteo y las órdenes coincidan.

## Criterios de aceptación

- La bandeja muestra el total recuperable del mes actual aunque se consulte Hoy,
  Ayer, Semana, Mes o un rango.
- Una única acción abre `period=MONTH&status=RECOVERY`.
- Un enlace histórico con `period=RANGE` conserva sus fechas y muestra el total
  recuperable de ese rango.
- La vista Recuperación muestra pedidos enviados no entregados y cancelados.
- Cambiar de período desde Recuperación vuelve a la consulta comercial normal.
- Cuando no quedan pedidos, aparece un estado positivo y explícito.
- Los pendientes de meses anteriores permanecen separados en el aviso
  histórico ya existente.
- No se requiere migración ni corrección manual de datos.

## Siguiente incremento recomendado

La observación libre no permite distinguir de forma confiable cancelaciones
por logística, antigüedad, deuda u otras causas. Un incremento posterior debe:

- incorporar un catálogo estructurado de causas de cancelación;
- conservar la observación como detalle complementario;
- definir prioridad y acción sugerida por causa;
- vincular una venta recuperada con la orden cancelada original sin reabrirla;
- medir tasa y tiempo de recuperación por asesor, equipo y causa.
