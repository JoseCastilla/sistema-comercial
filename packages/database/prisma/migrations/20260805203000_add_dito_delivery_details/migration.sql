-- Detalles logísticos extraídos desde DITO para uso exclusivo del Sistema
-- Comercial. Las columnas opcionales preservan las órdenes históricas.
ALTER TABLE "dito_orders"
ADD COLUMN "delivery_address" VARCHAR(500),
ADD COLUMN "delivery_reference" VARCHAR(500),
ADD COLUMN "delivery_latitude" DECIMAL(11, 8),
ADD COLUMN "delivery_longitude" DECIMAL(12, 8);
