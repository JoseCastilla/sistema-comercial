# Plan — SPEC-060

## Modelo

- `Flow` — `organizationId`, nombre, `kind` (`CONVERSATIONAL`/`INTERNAL`),
  `priority`, `activeVersionId`, `status` (`BORRADOR`, `ACTIVO`, `PAUSADO`),
  `ownerTeamIds`.
- `FlowVersion` — grafo (JSONB validado: nodos, aristas, configuración por
  nodo), `sendsMarketing` (derivado), `publishedAt`, `publishedByUserId`,
  `publishReason`. Inmutable al activarse.
- `FlowExecution` — `flowVersionId`, `triggerKind`, `triggerRef`,
  `idempotencyKey` (único: flujo + objeto + evento), `conversationId`,
  `status`, `currentNodeId`, `resumeAt`, `stepCount`, `endReason`,
  `startedAt`, `endedAt`.
- `FlowExecutionStep` — nodo, entrada, resultado, rama, mensajes (solo añade).

## Motor (`apps/worker` + reglas en `packages/validation/src/flows/`)

- `flow-graph-validation.ts` — BR-005 (conectividad, ramas obligatorias,
  bucles sin espera, ventana, plantillas aprobadas).
- `flow-step-runtime.ts` — ejecución pura de un paso dado el estado; devuelve
  efectos (enviar, asignar, esperar hasta, terminar) que el worker aplica.
  Así el simulador y la producción usan el mismo código con efectos
  distintos.
- Disparadores: suscripción a eventos ya existentes — mensajes y etapas
  (SPEC-053/054), cambios de pedidos (`dito_order_changes`), sincronización
  AGR (histórico de snapshots), agenda (citas) y reloj diario.
- Esperas: `resumeAt` consultado por el bucle del worker con `SKIP LOCKED`.
- Cada envío pasa por las reglas de consentimiento, ventana, franja y
  frecuencia antes de la outbox (BR-012).

## Lienzo

Biblioteca de grafos para React con licencia MIT (a elegir en fase 2, p. ej.
React Flow) sobre `apps/web`; paneles laterales de configuración con los
mismos componentes de formulario del sistema. Validación en vivo con la regla
pura compartida.

## Fases

1. Modelo, validación del grafo y runtime puro con pruebas.
2. Motor en worker: disparadores de conversación, oportunidad, agenda, DITO y
   AGR; esperas.
3. **Automatizaciones predefinidas** (etapa 2 del producto): los seis flujos
   de BR-017 como grafos fijos con parámetros editables e interruptor;
   registro de ejecuciones y métricas.
4. Versionado, pausa y vuelta atrás.
5. **Lienzo y simulador** (etapa 3 del producto): diseño libre sobre el mismo
   catálogo y motor.
