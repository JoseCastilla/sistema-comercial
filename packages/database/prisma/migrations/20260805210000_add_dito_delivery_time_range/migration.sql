-- Rango horario original informado por DITO. No se convierte a timestamps
-- porque el payload del escenario no contiene fecha de entrega.
ALTER TABLE "dito_orders"
ADD COLUMN "delivery_time_range_raw" VARCHAR(100);
