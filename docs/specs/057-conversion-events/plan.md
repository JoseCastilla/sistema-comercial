# Plan — SPEC-057

## Modelo

- `ConversionDataset` — `organizationId`, `whatsappNumberId`, `datasetId`.
- `ConversionEvent` — `organizationId`, `conversationId`, `ditoOrderId`
  (opcional), `eventName`, `eventId` (único), `eventTime`, `payload` (JSONB
  inmutable), `status`, `metaResponse` (JSONB), `discardReason`, `attempts`,
  `sentAt`.
- `AutomaticEventObservation` — webhook `automatic_events` para contraste.

## Reglas puras

- `conversion-mapping.ts` — hecho del sistema → evento (BR-003), elegibilidad
  (BR-002), plazo (BR-008) y `event_id` determinista (BR-005).
- `conversion-payload.ts` — construcción de la carga sin datos personales
  (BR-007), con prueba que falla si aparece DNI, nombre, dirección o teléfono.
- `conversion-value.ts` — cargo fijo → valor en PEN (BR-004).

## Integración

- Emisores:
  - etapa de conversación (SPEC-054) → `LeadSubmitted`, `QualifiedLead`;
  - proyección de pedidos DITO (cambios de estado ya existentes y el canal
    `dito_order_changes`) → `OrderCreated`, `Purchase`, `OrderCanceled`.
- Envío por la outbox de SPEC-053 a `POST /<dataset_id>/events` con la
  versión fija de Graph API.

## Pantalla

`/admin/integrations/whatsapp/conversions` — resumen diario por tipo y
estado, lista, reenvío.

## Fases

1. Dataset y reglas puras con pruebas.
2. Emisores y envío idempotente.
3. Registro y pantalla.
4. Contraste con `automatic_events` y lectura en el Administrador de eventos.
