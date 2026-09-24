# Plan — SPEC-059

## Modelo

- `Segment` — `organizationId`, nombre, filtros (JSONB validado), autor.
- `Broadcast` — `organizationId`, `segmentId`, `templateVersionId`,
  `category`, `ownerTeamId`, `scheduledAt`, `status` (`BORRADOR`,
  `PENDIENTE_APROBACION`, `PROGRAMADA`, `ENVIANDO`, `PAUSADA`,
  `PAUSADA_POR_FRENO`, `TERMINADA`, `CANCELADA`), `approvedByUserId`,
  `pauseReason`.
- `BroadcastRecipient` — `broadcastId`, `contactId`, `status`,
  `exclusionReason`, `messageId`, `scheduledDay`. Se congela al lanzar.
- `BroadcastEvent` — aprobación, pausa, freno, reanudación (solo añade).

## Reglas puras

- `segment-filters.ts` — validación y traducción a consulta con
  `organizationId` primero.
- `broadcast-eligibility.ts` — exclusiones de BR-003 y BR-005, con motivo.
- `broadcast-schedule.ts` — franja de Lima, reparto por límite diario.
- `broadcast-brake.ts` — umbrales de BR-009.

## Envío

Al lanzar se congela la lista de destinatarios; el worker encola por día y
franja en la outbox de SPEC-053; el freno se evalúa con cada lote de estados.

## Pantallas

`/conversations/broadcasts` (lista y resultados), `/new` (asistente de cuatro
pasos: segmento → plantilla → programación → previsualización y aprobación),
`/segments`.

## Fases

1. Modelo y reglas puras.
2. Segmentos y previsualización con costo.
3. Aprobación, programación, envío escalonado, pausa.
4. Freno automático y resultados.
5. Respuestas a la bandeja y medición de pedidos a 7 días.
