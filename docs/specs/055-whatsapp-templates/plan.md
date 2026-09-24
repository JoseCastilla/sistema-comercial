# Plan — SPEC-055

## Modelo

- `MessageTemplate` — `organizationId`, `whatsappNumberId`/`wabaId`,
  `externalTemplateId`, `name`, `language`, `status`, `category`,
  `qualityRating`, `pausedUntil`, `retiredAt`.
- `MessageTemplateVersion` — `templateId`, `components` (JSONB), `variables`
  (nombre → origen del dato), `submittedAt`, `approvedAt`, `rejectedReason`,
  `createdByUserId`. Inmutable una vez enviada a revisión.
- `MessageTemplateEvent` — cambios de estado, categoría y calidad (solo añade).
- `MessagingRate` — `organizationId`, `country`, `category`, `currency`,
  `amount`, `validFrom`.
- `Message` (SPEC-053) guarda `templateVersionId` y los parámetros usados.

## Reglas puras

- `template-validation.ts` — topes de longitud y botones; ejemplos
  obligatorios.
- `template-category-hints.ts` — palabras promocionales en utilidad.
- `template-cost.ts` — costo según categoría, tarifa vigente y ventana
  (abierta / gratis por anuncio).
- `template-variables.ts` — resolución de variables desde contacto, asesor,
  cita, AGR y pedido.

## API y worker

- `apps/api/src/modules/meta/templates`: crear (`POST /<WABA>/message_templates`),
  listar, borrar; subida de media de encabezado (Resumable Upload).
- Procesador de webhooks: `message_template_status_update`,
  `message_template_quality_update`, `template_category_update`,
  `message_template_components_update`.
- Worker: sincronización horaria.

## Pantallas

`/conversations/templates` (lista con costo y estado) y
`/conversations/templates/[id]` (editor con vista previa tipo teléfono).

## Fases

1. Modelo, reglas puras, sincronización y lista.
2. Editor, envío a revisión y webhooks de estado.
3. Uso desde la bandeja con variables y costo.
4. Alertas y retención de difusiones/flujos ante recategorización.
5. Biblioteca inicial enviada a revisión.
