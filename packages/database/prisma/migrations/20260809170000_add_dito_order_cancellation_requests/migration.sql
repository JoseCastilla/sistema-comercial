CREATE TYPE "DitoOrderCancellationRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "dito_order_cancellation_requests" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "dito_order_id" UUID NOT NULL,
  "status" "DitoOrderCancellationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(3),
  "review_observation" TEXT,
  "order_updated_at_snapshot" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "dito_order_cancellation_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dito_cancellation_requests_review_complete_check"
    CHECK (
      ("status" = 'PENDING'
        AND "reviewed_by_user_id" IS NULL
        AND "reviewed_at" IS NULL)
      OR
      ("status" IN ('APPROVED', 'REJECTED')
        AND "reviewed_by_user_id" IS NOT NULL
        AND "reviewed_at" IS NOT NULL)
    )
);

ALTER TABLE "dito_order_cancellation_requests"
  ADD CONSTRAINT "dito_order_cancellation_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "dito_order_cancellation_requests_dito_order_id_fkey"
    FOREIGN KEY ("dito_order_id") REFERENCES "dito_orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "dito_order_cancellation_requests_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "dito_order_cancellation_requests_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "dito_cancellation_requests_one_pending_per_order_key"
  ON "dito_order_cancellation_requests"("dito_order_id")
  WHERE "status" = 'PENDING';

CREATE INDEX "dito_cancellation_requests_org_status_requested_idx"
  ON "dito_order_cancellation_requests"("organization_id", "status", "requested_at");

CREATE INDEX "dito_cancellation_requests_order_status_idx"
  ON "dito_order_cancellation_requests"("dito_order_id", "status");

CREATE INDEX "dito_cancellation_requests_requester_requested_idx"
  ON "dito_order_cancellation_requests"("requested_by_user_id", "requested_at");

CREATE INDEX "dito_cancellation_requests_reviewer_reviewed_idx"
  ON "dito_order_cancellation_requests"("reviewed_by_user_id", "reviewed_at");
