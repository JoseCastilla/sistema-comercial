-- Conserva el soporte de consulta del vínculo comercial con su nombre y
-- semántica corregidos. Su uso se medirá en producción antes de retirarlo.
CREATE INDEX "dito_orders_org_commercial_link_captured_idx"
ON "dito_orders" ("organization_id", "commercial_link_status", "captured_at");
