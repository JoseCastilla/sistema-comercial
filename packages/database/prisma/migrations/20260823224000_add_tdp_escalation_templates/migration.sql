ALTER TABLE "delivery_escalations"
  ADD COLUMN "tdp_template_type" VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "tdp_template" TEXT,
  ADD COLUMN "tdp_escalated_by_user_id" UUID,
  ADD COLUMN "tdp_escalated_at" TIMESTAMPTZ(3);

ALTER TABLE "delivery_escalations"
  ADD CONSTRAINT "delivery_escalations_tdp_escalated_by_user_id_fkey"
  FOREIGN KEY ("tdp_escalated_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "delivery_escalations_tdp_escalated_at_idx"
  ON "delivery_escalations"("organization_id", "tdp_escalated_at");
