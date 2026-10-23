-- SPEC-086: ventas consultadas en Máximo que no aparecen en su historial.
-- Tabla aditiva: nada existente cambia y la sincronización la llena sola.
CREATE TABLE "agr_delivery_missing_orders" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "dito_order_id" UUID NOT NULL,
  "first_missing_at" TIMESTAMPTZ(3) NOT NULL,
  "last_checked_at" TIMESTAMPTZ(3) NOT NULL,
  "source_imported_at" TIMESTAMPTZ(3),
  "alerted_at" TIMESTAMPTZ(3),
  CONSTRAINT "agr_delivery_missing_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agr_delivery_missing_orders_dito_order_id_key"
  ON "agr_delivery_missing_orders"("dito_order_id");

CREATE INDEX "agr_delivery_missing_orders_org_checked_idx"
  ON "agr_delivery_missing_orders"("organization_id", "last_checked_at");

ALTER TABLE "agr_delivery_missing_orders"
  ADD CONSTRAINT "agr_delivery_missing_orders_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "agr_delivery_missing_orders_dito_order_id_fkey"
    FOREIGN KEY ("dito_order_id") REFERENCES "dito_orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
