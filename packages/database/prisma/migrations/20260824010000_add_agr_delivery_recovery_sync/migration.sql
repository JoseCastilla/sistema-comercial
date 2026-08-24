CREATE TYPE "AgrDeliveryCredentialStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ERROR');
CREATE TYPE "AgrDeliverySyncTrigger" AS ENUM ('SCHEDULED', 'MANUAL');
CREATE TYPE "AgrDeliverySyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

CREATE TABLE "agr_delivery_integrations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "encrypted_session_cookie" TEXT NOT NULL,
  "credential_hint" VARCHAR(8) NOT NULL,
  "credential_status" "AgrDeliveryCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "credential_updated_by_id" UUID NOT NULL,
  "credential_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_validated_at" TIMESTAMPTZ(3),
  "last_attempt_at" TIMESTAMPTZ(3),
  "last_success_at" TIMESTAMPTZ(3),
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "agr_delivery_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agr_delivery_sync_runs" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "agr_delivery_integration_id" UUID NOT NULL,
  "schedule_key" VARCHAR(50) NOT NULL,
  "trigger" "AgrDeliverySyncTrigger" NOT NULL,
  "status" "AgrDeliverySyncStatus" NOT NULL DEFAULT 'RUNNING',
  "candidate_orders" INTEGER NOT NULL DEFAULT 0,
  "consulted_orders" INTEGER NOT NULL DEFAULT 0,
  "found_orders" INTEGER NOT NULL DEFAULT 0,
  "changed_orders" INTEGER NOT NULL DEFAULT 0,
  "opportunity_orders" INTEGER NOT NULL DEFAULT 0,
  "error_orders" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3),
  CONSTRAINT "agr_delivery_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agr_delivery_order_snapshots" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "dito_order_id" UUID NOT NULL,
  "external_order_id" VARCHAR(100) NOT NULL,
  "pedido" VARCHAR(100), "envio" VARCHAR(100),
  "estado_pedido" VARCHAR(100) NOT NULL,
  "motivo_rechazo" VARCHAR(500), "submotivo_rechazo" VARCHAR(500),
  "fecha_entrega_pactada_raw" VARCHAR(100), "fecha_entrega_real_raw" VARCHAR(100),
  "fecha_toma_pedido_raw" VARCHAR(100), "tipo_delivery" VARCHAR(100),
  "vendedor" VARCHAR(100), "nombre_vendedor" VARCHAR(200),
  "gestion_status" VARCHAR(100), "resultado" VARCHAR(500),
  "proxima_accion" VARCHAR(500), "fecha_compromiso_raw" VARCHAR(100),
  "gestion_updated_at_raw" VARCHAR(100), "updated_by_name" VARCHAR(200),
  "is_recovery_opportunity" BOOLEAN NOT NULL DEFAULT false,
  "source_fingerprint" CHAR(64) NOT NULL,
  "raw_payload" JSONB NOT NULL,
  "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fetched_at" TIMESTAMPTZ(3) NOT NULL,
  "changed_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "agr_delivery_order_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agr_delivery_order_history" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "agr_delivery_order_snapshot_id" UUID NOT NULL,
  "estado_pedido" VARCHAR(100) NOT NULL,
  "motivo_rechazo" VARCHAR(500), "submotivo_rechazo" VARCHAR(500),
  "gestion_status" VARCHAR(100), "source_fingerprint" CHAR(64) NOT NULL,
  "raw_payload" JSONB NOT NULL,
  "observed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agr_delivery_order_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agr_delivery_integrations_organization_id_key" ON "agr_delivery_integrations"("organization_id");
CREATE UNIQUE INDEX "agr_delivery_sync_runs_org_schedule_key" ON "agr_delivery_sync_runs"("organization_id", "schedule_key");
CREATE INDEX "agr_delivery_sync_runs_org_started_idx" ON "agr_delivery_sync_runs"("organization_id", "started_at");
CREATE UNIQUE INDEX "agr_delivery_order_snapshots_dito_order_id_key" ON "agr_delivery_order_snapshots"("dito_order_id");
CREATE INDEX "agr_delivery_snapshots_org_opportunity_fetched_idx" ON "agr_delivery_order_snapshots"("organization_id", "is_recovery_opportunity", "fetched_at");
CREATE INDEX "agr_delivery_snapshots_org_status_idx" ON "agr_delivery_order_snapshots"("organization_id", "estado_pedido");
CREATE INDEX "agr_delivery_history_snapshot_observed_idx" ON "agr_delivery_order_history"("agr_delivery_order_snapshot_id", "observed_at");

ALTER TABLE "agr_delivery_integrations" ADD CONSTRAINT "agr_delivery_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agr_delivery_integrations" ADD CONSTRAINT "agr_delivery_integrations_credential_updated_by_id_fkey" FOREIGN KEY ("credential_updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agr_delivery_sync_runs" ADD CONSTRAINT "agr_delivery_sync_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agr_delivery_sync_runs" ADD CONSTRAINT "agr_delivery_sync_runs_agr_delivery_integration_id_fkey" FOREIGN KEY ("agr_delivery_integration_id") REFERENCES "agr_delivery_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agr_delivery_order_snapshots" ADD CONSTRAINT "agr_delivery_order_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agr_delivery_order_snapshots" ADD CONSTRAINT "agr_delivery_order_snapshots_dito_order_id_fkey" FOREIGN KEY ("dito_order_id") REFERENCES "dito_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agr_delivery_order_history" ADD CONSTRAINT "agr_delivery_order_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agr_delivery_order_history" ADD CONSTRAINT "agr_delivery_order_history_agr_delivery_order_snapshot_id_fkey" FOREIGN KEY ("agr_delivery_order_snapshot_id") REFERENCES "agr_delivery_order_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
