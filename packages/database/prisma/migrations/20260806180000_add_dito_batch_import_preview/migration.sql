ALTER TYPE "DitoOrderCorrectionSource" ADD VALUE 'DITO_BATCH_IMPORT';

CREATE TYPE "DitoImportBatchStatus" AS ENUM (
  'PREVIEW',
  'READY',
  'CONFIRMING',
  'CONFIRMED',
  'FAILED'
);

CREATE TYPE "DitoImportRowClassification" AS ENUM (
  'NEW_ORDER',
  'ENRICHMENT',
  'UNCHANGED',
  'EXCLUDED',
  'INVALID',
  'BLOCKED_IDENTITY',
  'CONFLICT'
);

CREATE TYPE "DitoImportRowApplicationStatus" AS ENUM (
  'PENDING',
  'APPLIED',
  'SKIPPED',
  'FAILED'
);

CREATE TABLE "dito_agent_identities" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "external_username" VARCHAR(150) NOT NULL,
  "external_username_normalized" VARCHAR(150) NOT NULL,
  "display_name" VARCHAR(150),
  "user_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "resolved_by_user_id" UUID,
  "resolved_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "dito_agent_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dito_import_batches" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "file_sha256" CHAR(64) NOT NULL,
  "file_size" INTEGER NOT NULL,
  "parser_version" VARCHAR(30) NOT NULL,
  "ubigeo_catalog_version" VARCHAR(30) NOT NULL,
  "source_sheet" VARCHAR(100) NOT NULL,
  "header_row" INTEGER NOT NULL,
  "status" "DitoImportBatchStatus" NOT NULL DEFAULT 'PREVIEW',
  "source_rows" INTEGER NOT NULL,
  "importable_rows" INTEGER NOT NULL,
  "excluded_rows" INTEGER NOT NULL,
  "invalid_rows" INTEGER NOT NULL,
  "new_rows" INTEGER NOT NULL DEFAULT 0,
  "enrichment_rows" INTEGER NOT NULL DEFAULT 0,
  "unchanged_rows" INTEGER NOT NULL DEFAULT 0,
  "blocked_rows" INTEGER NOT NULL DEFAULT 0,
  "conflict_rows" INTEGER NOT NULL DEFAULT 0,
  "uploaded_by_user_id" UUID NOT NULL,
  "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_by_user_id" UUID,
  "confirmed_at" TIMESTAMPTZ(3),
  "failure_reason" TEXT,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "dito_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dito_import_rows" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "source_row" INTEGER NOT NULL,
  "classification" "DitoImportRowClassification" NOT NULL,
  "application_status" "DitoImportRowApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "issue_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "order_code_normalized" VARCHAR(100),
  "displayed_order_code" VARCHAR(100),
  "sales_code" VARCHAR(100),
  "dito_username_normalized" VARCHAR(150),
  "dito_agent_identity_id" UUID,
  "target_dito_order_id" UUID,
  "parsed_data" JSONB NOT NULL,
  "proposed_changes" JSONB,
  "conflicts" JSONB,
  "applied_at" TIMESTAMPTZ(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "dito_import_rows_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "dito_order_corrections"
  ADD COLUMN "dito_import_batch_id" UUID;

CREATE UNIQUE INDEX "dito_agent_identities_org_username_key"
  ON "dito_agent_identities"("organization_id", "external_username_normalized");
CREATE INDEX "dito_agent_identities_org_user_active_idx"
  ON "dito_agent_identities"("organization_id", "user_id", "is_active");

CREATE UNIQUE INDEX "dito_import_batches_org_file_hash_key"
  ON "dito_import_batches"("organization_id", "file_sha256");
CREATE INDEX "dito_import_batches_org_status_uploaded_idx"
  ON "dito_import_batches"("organization_id", "status", "uploaded_at");
CREATE INDEX "dito_import_batches_uploader_uploaded_idx"
  ON "dito_import_batches"("uploaded_by_user_id", "uploaded_at");

CREATE UNIQUE INDEX "dito_import_rows_batch_source_row_key"
  ON "dito_import_rows"("batch_id", "source_row");
CREATE INDEX "dito_import_rows_org_classification_created_idx"
  ON "dito_import_rows"("organization_id", "classification", "created_at");
CREATE INDEX "dito_import_rows_org_order_code_idx"
  ON "dito_import_rows"("organization_id", "order_code_normalized");
CREATE INDEX "dito_import_rows_org_sales_code_idx"
  ON "dito_import_rows"("organization_id", "sales_code");
CREATE INDEX "dito_import_rows_agent_identity_idx"
  ON "dito_import_rows"("dito_agent_identity_id");
CREATE INDEX "dito_import_rows_target_order_idx"
  ON "dito_import_rows"("target_dito_order_id");
CREATE INDEX "dito_order_corrections_batch_created_idx"
  ON "dito_order_corrections"("dito_import_batch_id", "created_at");

ALTER TABLE "dito_agent_identities"
  ADD CONSTRAINT "dito_agent_identities_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dito_agent_identities"
  ADD CONSTRAINT "dito_agent_identities_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dito_agent_identities"
  ADD CONSTRAINT "dito_agent_identities_resolved_by_user_id_fkey"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dito_import_batches"
  ADD CONSTRAINT "dito_import_batches_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dito_import_batches"
  ADD CONSTRAINT "dito_import_batches_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dito_import_batches"
  ADD CONSTRAINT "dito_import_batches_confirmed_by_user_id_fkey"
  FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dito_import_rows"
  ADD CONSTRAINT "dito_import_rows_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dito_import_rows"
  ADD CONSTRAINT "dito_import_rows_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "dito_import_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dito_import_rows"
  ADD CONSTRAINT "dito_import_rows_dito_agent_identity_id_fkey"
  FOREIGN KEY ("dito_agent_identity_id") REFERENCES "dito_agent_identities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dito_import_rows"
  ADD CONSTRAINT "dito_import_rows_target_dito_order_id_fkey"
  FOREIGN KEY ("target_dito_order_id") REFERENCES "dito_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dito_order_corrections"
  ADD CONSTRAINT "dito_order_corrections_dito_import_batch_id_fkey"
  FOREIGN KEY ("dito_import_batch_id") REFERENCES "dito_import_batches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
