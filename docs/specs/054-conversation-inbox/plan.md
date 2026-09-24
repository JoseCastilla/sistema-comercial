# Plan — SPEC-054

## Modelo (sobre el de SPEC-053)

- `Conversation`: `responderState` (`IA_ACTIVA`, `REQUIERE_ASESOR`,
  `CONTROL_HUMANO`), `responderChangedAt`, `isOrderInquiry`, `assignedTeamId`, `assignedUserId`, `claimedAt`,
  `firstResponseAt`, `closedAt`, `automationPausedAt`.
- `ConversationEvent` — asignación, transferencia, devolución, cambio de
  etapa, cierre, reapertura (solo añade filas; mismo patrón que
  `RecoveryCaseEvent`).
- `ConversationNote` — nota interna.
- `ConversationTag` y `Tag` por organización.
- `QuickReply` por organización.
- `AgentPresence` — `userId`, `available`, `lastSeenAt`.
- `TeamInboxSettings` — modo de reparto, tiempos de «sin atender» y retorno,
  horario.

## Reglas puras (`packages/validation/src/messaging/`)

- `inbox-access.ts` — alcance por rol (espejo de `recoveryCaseAccessWhere`).
- `inbox-routing.ts` — equipo destino (BR-003) y elección del asesor en
  reparto equitativo (BR-004, BR-005).
- `responder-state.ts` — transiciones de quién responde y qué envíos
  pendientes se cancelan al tomar control (BR-008 a BR-008c). La etapa
  comercial vive en SPEC-061.
- `inbox-sla.ts` — sin atender / retorno en horario de Lima (BR-007).

## Tiempo real

Canal `LISTEN/NOTIFY` `conversation_changes` con `organizationId`,
`conversationId` y tipo; ruta SSE `app/api/conversations/stream` que filtra
por el alcance del usuario antes de emitir. Mismo patrón que
`order-change-events.ts`.

## Pantallas (`apps/web/src/app/conversations/`)

- `page.tsx` — tres paneles; vistas «Mis chats», «Sin tomar», «Sin atender»,
  «Por cerrar ventana», «De anuncios», «Cerrados»; filtros en la URL
  (SPEC-039).
- `[conversationId]` — chat + ficha; en móvil, pantalla propia.
- `settings` — respuestas rápidas, etiquetas, reparto y horario (supervisor /
  administrador).
- `metrics` — atención (BR-022), enlazada desde Rendimiento.

## Fases

1. Modelo, reglas puras y acceso.
2. Lista + chat + envío + tiempo real (sustituye la vista mínima de SPEC-053).
3. Asignación, presencia, tomar/transferir/devolver, SLA en el reloj del worker.
4. Ficha lateral con vínculos, etapa, tipificación y agenda.
5. Respuestas rápidas, etiquetas, notas y métricas.
6. Piloto con número nuevo; condición de copia fuera del servidor (SPEC-052 §8).
