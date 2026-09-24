# Plan — SPEC-056

## Modelo

- `AdAccountConnection` — `organizationId`, `adAccountId`, `currency`,
  `tokenCiphertext`, `scopes`, `status`.
- `AdCampaign`, `AdSet`, `Ad` — espejo de Meta con `externalId`, nombre,
  estado, objetivo, presupuesto, `createdInSystem` (bool), `lastSyncedAt`.
- `AdDailySpend` — `adId`, `date` (Lima), `spend`, `impressions`, `clicks`,
  `messagingConversationsStarted` (dato de Meta, para contraste).
- `AdRoutingRule` — `adId` o `adCampaignId` → `teamId`.
- `AdChangeLog` — pausa/reanudación/presupuesto con autor y valor anterior.
- `ExchangeRate` — fecha, moneda, valor.
- `Conversation.originAdId` (derivado de `originReferral.source_id`).

## Reglas puras

- La atribución no vive aquí: se usa `opportunity-attribution.ts` de
  SPEC-061 (pedido → oportunidad → toque de origen → anuncio).
- `ad-funnel.ts` — conteo por persona única y cohorte; «en maduración».
- `ad-cost.ts` — costo por etapa y conversión de moneda.

## Integración

- `apps/api/src/modules/meta/ads`: lectura de estructura
  (`/act_<id>/campaigns`, `adsets`, `ads`) e insights diarios por anuncio.
- Fase B: creación de campaña, conjunto (`destination_type: WHATSAPP`,
  `promoted_object.page_id` y número), creativo (`WHATSAPP_MESSAGE`,
  `page_welcome_message`) y anuncio, todo con `status: PAUSED`.
- Worker: sincronización diaria 06:00 Lima + reintento de 7 días.

## Pantallas

`/campaigns-meta` (tablero de embudo) — **nombre visible «Anuncios»** para no
confundir con «Campañas» de recupero (SPEC-030). Fase B: `/campaigns-meta/new`.

## Fases

1. Conexión y sincronización de estructura y gasto.
2. Atribución y embudo con reglas puras.
3. Tablero y ruteo por anuncio.
4. **Piloto** (SPEC-052 plan paso 4).
5. Fase B: crear en pausa, activar, pausar, presupuesto.
