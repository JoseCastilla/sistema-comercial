-- SPEC-083: de dónde salió la venta. Hasta ahora el equipo lo escribía en la
-- nota («BASE», «CAMPAÑA»); pasa a ser un dato propio del pedido.
CREATE TYPE "SaleOrigin" AS ENUM ('BASE', 'CAMPAIGN', 'OTHER');

ALTER TABLE "dito_orders"
  ADD COLUMN "sale_origin" "SaleOrigin",
  ADD COLUMN "sale_origin_set_at" TIMESTAMPTZ(3),
  ADD COLUMN "sale_origin_set_by_user_id" UUID,
  ADD CONSTRAINT "dito_orders_sale_origin_set_by_user_id_fkey"
    FOREIGN KEY ("sale_origin_set_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Se recupera lo que ya estaba escrito: la nota que empieza con «BASE» o con
-- «CAMPAÑA» (también «CAMPANA» y «CAMAPAÑA», como se escribió). La nota no se
-- toca. Sin autor: lo hizo esta migración, no una persona.
UPDATE "dito_orders"
SET
  "sale_origin" = CASE
    WHEN upper(btrim("delivery_observation")) LIKE 'BASE%'
      THEN 'BASE'::"SaleOrigin"
    ELSE 'CAMPAIGN'::"SaleOrigin"
  END,
  "sale_origin_set_at" = CURRENT_TIMESTAMP
WHERE "sale_origin" IS NULL
  AND (
    upper(btrim("delivery_observation")) LIKE 'BASE%'
    OR upper(btrim("delivery_observation")) ~ '^(CAMPA[ÑN]A|CAMAPA[ÑN]A)'
  );
