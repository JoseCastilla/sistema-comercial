CREATE TYPE "DeliveryEscalationCategory" AS ENUM (
  'COMMERCIAL_OFFER',
  'CUSTOMER_REQUEST',
  'DELIVERY_LOGISTICS',
  'ACTIVATION_PAYMENT',
  'DATA_QUALITY',
  'CANCELLATION',
  'OTHER'
);

CREATE TYPE "DeliveryEscalationPriority" AS ENUM (
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

ALTER TABLE "delivery_escalations"
  ADD COLUMN "category" "DeliveryEscalationCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "priority" "DeliveryEscalationPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "requested_action" TEXT NOT NULL DEFAULT 'Revisar la incidencia',
  ADD COLUMN "acknowledgement" TEXT,
  ADD COLUMN "resolution" TEXT,
  ADD COLUMN "team_id_snapshot" UUID;

CREATE UNIQUE INDEX "delivery_escalations_one_active_per_order_key"
  ON "delivery_escalations"("dito_order_id")
  WHERE "status" IN ('OPEN', 'ACKNOWLEDGED');

CREATE INDEX "delivery_escalations_org_team_status_created_idx"
  ON "delivery_escalations"(
    "organization_id",
    "team_id_snapshot",
    "status",
    "created_at"
  );
