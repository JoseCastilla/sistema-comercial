# Plan — SPEC-061

## Modelo

- `CommercialRequest` (oportunidad), ampliado:
  - `stage` (enum de BR-007), `stageChangedAt`;
  - `origin` (se amplía `LeadOrigin` con `BROADCAST`, `ADVISOR`, `ORGANIC`;
    `CAMPAIGN` se lee como anuncio y `DATABASE` como gestión de asesor);
  - `originTouchId`, `customerRelation` (`NEW`/`EXISTING`), `relationCutoffAt`;
  - `conversationId` (opcional), `recoveryCaseId` (opcional);
  - `nextActionKind`, `nextActionAt`;
  - `lostReason`, `lostDetail`, `closedAt`, `droppedOrderFlag`.
  - `pipelineStage` y `opportunityStatus` de GHL quedan como texto crudo.
- `ContactTouch` — `organizationId`, `contactId`, `kind`, `adId`,
  `broadcastId`, `referrerContactId`, `recoveryCaseId`, `occurredAt`,
  `evidence` (JSONB inmutable).
- `Contact.initialTouchId` — se fija una vez.
- `CommercialRequestEvent` — solo añade filas.
- `CommercialProposal` — oportunidad, planes (referencias a versiones de
  catálogo), líneas, cargo fijo total, autor.
- `PlanCatalogItem` y `PlanCatalogItemRevision` — nombre, tipo, cargo fijo,
  requisitos, promoción, `validFrom`, `validUntil`.
- `RecoveryCaseCommitment` → generalizar dueño: `caseId` opcional +
  `commercialRequestId` opcional, con restricción «exactamente uno». Se
  evalúa renombrar a `Commitment` en la migración.
- Índice parcial único: una oportunidad abierta por contacto
  (`organizationId`, `requesterContactId`) donde `stage` no es final.

## Reglas puras (`packages/validation/src/opportunities/`)

- `opportunity-opening.ts` — BR-001 a BR-003 (incluida la excepción de pedido
  en curso).
- `opportunity-origin.ts` — BR-004 a BR-006.
- `opportunity-stage.ts` — transiciones manuales y derivadas (BR-007 a BR-010).
- `order-opportunity-linking.ts` — automático / sugerido (BR-011, BR-012).
- `opportunity-attribution.ts` — BR-013 y los tres montos de BR-009.

## Pantallas

- Ficha de oportunidad dentro del panel lateral de la bandeja (SPEC-054).
- `/opportunities` — tablero por etapas y vista lista; filtros en la URL.
- `/opportunities/metrics` — indicadores de BR-021.
- `/admin/catalog` — catálogo de planes.

## Fases

1. Modelo, migración y reglas puras.
2. Apertura automática, toques y relación nuevo/existente.
3. Vínculo pedido ↔ oportunidad (automático y sugerido) y etapa derivada.
4. Ficha en bandeja, propuesta y catálogo.
5. Tablero por etapas y siguiente acción con agenda generalizada.
6. Indicadores por origen × relación.
