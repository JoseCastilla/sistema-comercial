# Plan — SPEC-053

## Modelo de datos (borrador; nombres definitivos al migrar)

Esquema nuevo `packages/database/prisma/schema/messaging.prisma`:

- `WhatsappNumber` — `organizationId`, `wabaId`, `phoneNumberId` (único),
  `displayName`, `status`, `qualityRating`, `messagingLimit`,
  `accessTokenCiphertext`, `webhookVerifyTokenHash`, `connectedAt`.
- `Conversation` — `organizationId`, `contactId`, `channel` (`WHATSAPP`),
  `channelAccountId` (número), `originReferral` (JSONB inmutable),
  `lastInboundAt`, `freeUntil`, `status`, `assignedTeamId`, `assignedUserId`
  (estos dos los usa SPEC-054).
- `Message` — `organizationId`, `conversationId`, `direction`, `externalId`
  (`wamid`, único por organización), `type`, `normalizedBody` (JSONB),
  `rawPayload` (JSONB inmutable), `status`, `errorCode`, `errorTitle`,
  `originKind` (`USER`/`AGENT_AI`/`FLOW`/`BROADCAST`/`SYSTEM`), `originRef`,
  `clientRequestId` (único), `sentAt`, `deliveredAt`, `readAt`.
- `MessageStatusEvent` — historial de estados (solo añade filas).
- `MessageAttachment` — `messageId`, `storageKey`, `mimeType`, `sizeBytes`,
  `sha256`.
- `OutboundMessageJob` — outbox: `messageId`, `status`, `attempts`,
  `nextAttemptAt`, `lastError`, `lockedAt`.
- `ContactChannelIdentity` — `organizationId`, `contactId`, `channel`,
  `externalUserId` (BSUID), `phoneE164`; únicos por organización.
- `ContactConsent` — `organizationId`, `contactId`, `category`, `granted`
  (bool), `source`, `evidenceText`, `recordedByUserId`, `createdAt`.
- `ContactLink` — `contactId`, `targetKind` (`DITO_ORDER`/`RECOVERY_CASE`/
  `DNI_SNAPSHOT`), `targetId`, `confidence` (`CONFIRMED`/`PROBABLE`),
  `confirmedByUserId`.
- `ContactMerge` — auditoría de uniones y su reversión.
- `Contact`: `documentNumberNormalized` pasa a nulo si hoy no lo es
  (verificar); se agrega `displayName` de canal.
- `WebhookSource`: nuevo valor `META_WHATSAPP`.

## Reglas puras primero (`packages/validation/src/messaging/`)

1. `conversation-windows.ts` — «puede escribir libremente hasta» y «gratis
   hasta» (BR-009, BR-010).
2. `message-status.ts` — avance monótono de estados (BR-006).
3. `consent.ts` — ¿se puede enviar esta categoría a esta persona? (BR-018 a
   BR-020), incluida la detección de palabras de baja.
4. `contact-matching.ts` — unión por BSUID/teléfono y vínculos confirmados vs
   probables (BR-014, BR-015).
5. `send-retry.ts` — clasificación de errores de Meta en temporal, límite,
   tope de marketing y definitivo (BR-012).

Cada una con pruebas `node --test` antes de tocar la API.

## Fases

1. **Motor y reglas** — esquema y migración; reglas puras; módulo
   `apps/api/src/modules/meta/` (cliente Graph API con versión fija,
   verificación de firma, cifrado de token); webhook `GET` (verificación) y
   `POST` (recepción) sobre `WebhookEvent`; procesador que proyecta mensajes,
   estados, calidad y preferencias.
2. **Salida y archivos** — outbox y bucle del worker con `SKIP LOCKED`;
   almacenamiento de objetos (MinIO en EasyPanel, cliente S3); descarga de
   media entrante.
3. **Pantalla de integración y prueba mínima** — `/admin/integrations/whatsapp`
   (ADMIN): conectar, estado, alertas; una vista mínima de conversación para
   probar ida y vuelta (se reemplaza por SPEC-054).
4. **Ficha única** — vínculos con DITO, Campañas y DNI; unión manual de
   duplicados.
5. **Embedded Signup v4** — solo cuando exista Tech Provider (SPEC-052 D-02).

## Variables de entorno nuevas

`META_APP_ID`, `META_APP_SECRET` (firma), `META_GRAPH_API_VERSION`,
`WHATSAPP_TOKEN_ENCRYPTION_KEY`, `OBJECT_STORAGE_ENDPOINT`,
`OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY`,
`OBJECT_STORAGE_SECRET_KEY`. Se documentan en `.env.example` (SPEC-046).

## Riesgos

- El worker se vuelve crítico: si cae, no sale ningún mensaje. Salud expuesta
  y alerta si un trabajo lleva más de 2 minutos pendiente.
- Una migración que vuelva nulo `documentNumberNormalized` debe revisar el
  índice único por organización (Postgres admite varios nulos).
