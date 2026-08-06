-- SPEC-002 / BR-008, AC-005:
-- La identidad declarada por la extensión se conserva separada del responsable
-- actual. Las columnas son opcionales para mantener compatibilidad con órdenes
-- y envelopes 1.0 existentes.
ALTER TABLE "dito_orders"
ADD COLUMN "submitter_installation_id" UUID,
ADD COLUMN "submitter_email_raw" VARCHAR(254),
ADD COLUMN "submitter_email_normalized" VARCHAR(254);

CREATE INDEX "dito_orders_org_submitter_installation_idx"
ON "dito_orders" ("organization_id", "submitter_installation_id", "captured_at");

CREATE INDEX "dito_orders_org_submitter_email_idx"
ON "dito_orders" ("organization_id", "submitter_email_normalized", "captured_at");
