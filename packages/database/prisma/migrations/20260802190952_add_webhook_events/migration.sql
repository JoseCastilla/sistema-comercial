-- CreateEnum
CREATE TYPE "WebhookSource" AS ENUM ('GHL_N8N');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED_DUPLICATE');

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "ghl_integration_id" UUID NOT NULL,
    "source" "WebhookSource" NOT NULL,
    "location_id" VARCHAR(100) NOT NULL,
    "external_event_id" VARCHAR(191) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "envelope_version" VARCHAR(20) NOT NULL,
    "snapshot_type" VARCHAR(50),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "processing_attempts" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_events_org_status_received_idx" ON "webhook_events"("organization_id", "status", "received_at");

-- CreateIndex
CREATE INDEX "webhook_events_integration_status_idx" ON "webhook_events"("ghl_integration_id", "status");

-- CreateIndex
CREATE INDEX "webhook_events_occurred_at_idx" ON "webhook_events"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_org_source_location_event_key" ON "webhook_events"("organization_id", "source", "location_id", "external_event_id");

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_ghl_integration_id_fkey" FOREIGN KEY ("ghl_integration_id") REFERENCES "ghl_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
