-- CreateEnum
CREATE TYPE "RecoveryCaseSource" AS ENUM ('NATIONAL_BASE', 'INTERNAL_ORDER_STATE', 'MANUAL');

-- CreateEnum
CREATE TYPE "RecoveryCaseStatus" AS ENUM ('TRIAGE', 'WAITING', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SCHEDULED', 'RECOVERED', 'LOST', 'DISCARDED');

-- CreateEnum
CREATE TYPE "RecoveryLossReason" AS ENUM ('YA_MIGRO_OTRA_AGENCIA', 'RECHAZO_DEFINITIVO', 'INUBICABLE', 'DEUDA', 'DATOS_INVALIDOS', 'NO_PORTABLE', 'OTRO');

-- CreateEnum
CREATE TYPE "RecoveryDiscardReason" AS ENUM ('YA_ACTIVO', 'FUERA_DE_FILTRO', 'DUPLICADO', 'ADMIN');

-- CreateEnum
CREATE TYPE "RecoveryBaseBatchStatus" AS ENUM ('PREVIEW', 'CONFIRMING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecoveryBaseRecordClassification" AS ENUM ('ELIGIBLE', 'EXCLUDED', 'INVALID');

-- CreateEnum
CREATE TYPE "RecoveryBaseRecordApplication" AS ENUM ('PENDING', 'APPLIED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecoveryCaseEventType" AS ENUM ('CASE_CREATED', 'SIGHTING_RECORDED', 'TRIAGE_WAITING', 'TRIAGE_RELEASED', 'MANUAL_INCLUSION', 'CASE_DISCARDED', 'CASE_REOPENED');

-- CreateEnum
CREATE TYPE "RecoveryPhoneKind" AS ENUM ('SERVICE', 'CONTACT');

-- DropIndex
-- Deriva de esquema preexistente, ajena al modulo de recupero: el indice
-- legacy quedo en produccion tras la compatibilidad expand/contract de
-- SPEC-015. Se retira de forma idempotente para que un despliegue no falle
-- si ya no existiera (SPEC-004 BR-003).
DROP INDEX IF EXISTS "dito_orders_org_match_captured_idx";

-- AlterTable
ALTER TABLE "delivery_escalations" ALTER COLUMN "requested_action" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dito_orders" ALTER COLUMN "order_code_suffix" DROP NOT NULL,
ALTER COLUMN "order_code_suffix" DROP DEFAULT;

-- CreateTable
CREATE TABLE "recovery_eligibility_configs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "modalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plan_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipment_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "carrier_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_eligibility_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_base_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_sha256" CHAR(64) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "parser_version" VARCHAR(30) NOT NULL,
    "status" "RecoveryBaseBatchStatus" NOT NULL DEFAULT 'PREVIEW',
    "source_rows" INTEGER NOT NULL,
    "eligible_rows" INTEGER NOT NULL,
    "excluded_rows" INTEGER NOT NULL,
    "invalid_rows" INTEGER NOT NULL,
    "new_cases" INTEGER NOT NULL DEFAULT 0,
    "sighting_cases" INTEGER NOT NULL DEFAULT 0,
    "registered_from" TIMESTAMPTZ(3),
    "registered_to" TIMESTAMPTZ(3),
    "eligibility_config_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_by_user_id" UUID,
    "confirmed_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recovery_base_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_base_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "source_row" INTEGER NOT NULL,
    "classification" "RecoveryBaseRecordClassification" NOT NULL,
    "application_status" "RecoveryBaseRecordApplication" NOT NULL DEFAULT 'PENDING',
    "issue_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "document_number" VARCHAR(20),
    "service_number" VARCHAR(15),
    "contact_phone" VARCHAR(15),
    "holder_name" VARCHAR(200),
    "registered_at" TIMESTAMPTZ(3),
    "modality_raw" VARCHAR(20),
    "plan_raw" VARCHAR(150),
    "equipment_raw" VARCHAR(150),
    "carrier_raw" VARCHAR(100),
    "requires_identity_validation" BOOLEAN NOT NULL DEFAULT false,
    "raw_data" JSONB NOT NULL,
    "case_id" UUID,
    "applied_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_base_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_cases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source" "RecoveryCaseSource" NOT NULL DEFAULT 'NATIONAL_BASE',
    "status" "RecoveryCaseStatus" NOT NULL DEFAULT 'TRIAGE',
    "document_number" VARCHAR(20) NOT NULL,
    "holder_name" VARCHAR(200) NOT NULL,
    "department" VARCHAR(100),
    "province" VARCHAR(100),
    "district" VARCHAR(100),
    "contact_summary" JSONB,
    "requires_identity_validation" BOOLEAN NOT NULL DEFAULT false,
    "father_name" VARCHAR(150),
    "mother_name" VARCHAR(150),
    "birth_place" VARCHAR(150),
    "sensitive_revealed_at" TIMESTAMPTZ(3),
    "sensitive_revealed_by_user_id" UUID,
    "first_registered_at" TIMESTAMPTZ(3) NOT NULL,
    "last_sighting_at" TIMESTAMPTZ(3) NOT NULL,
    "assigned_team_id" UUID,
    "assigned_user_id" UUID,
    "claimed_at" TIMESTAMPTZ(3),
    "next_action_at" TIMESTAMPTZ(3),
    "first_contact_at" TIMESTAMPTZ(3),
    "portability_eligible_at" TIMESTAMPTZ(3),
    "previous_case_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by_user_id" UUID,
    "loss_reason" "RecoveryLossReason",
    "discard_reason" "RecoveryDiscardReason",
    "recovered_dito_order_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recovery_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_case_services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "service_number" VARCHAR(15) NOT NULL,
    "modality_raw" VARCHAR(20),
    "plan_raw" VARCHAR(150),
    "equipment_raw" VARCHAR(150),
    "carrier_raw" VARCHAR(100),
    "first_registered_at" TIMESTAMPTZ(3) NOT NULL,
    "last_registered_at" TIMESTAMPTZ(3) NOT NULL,
    "is_plant_line" BOOLEAN NOT NULL DEFAULT false,
    "portability_eligible_at" TIMESTAMPTZ(3),
    "discarded_at" TIMESTAMPTZ(3),
    "discard_reason" "RecoveryDiscardReason",
    "included_manually" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recovery_case_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_case_phones" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "phone_number" VARCHAR(15) NOT NULL,
    "kind" "RecoveryPhoneKind" NOT NULL,
    "invalid_marked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_case_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_case_sightings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "service_number" VARCHAR(15) NOT NULL,
    "registered_at" TIMESTAMPTZ(3) NOT NULL,
    "source_row" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_case_sightings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_case_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "type" "RecoveryCaseEventType" NOT NULL,
    "actor_user_id" UUID,
    "previous_status" "RecoveryCaseStatus",
    "new_status" "RecoveryCaseStatus",
    "observation" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_case_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recovery_eligibility_configs_org_active_created_idx" ON "recovery_eligibility_configs"("organization_id", "is_active", "created_at");

-- CreateIndex
CREATE INDEX "recovery_base_batches_org_status_uploaded_idx" ON "recovery_base_batches"("organization_id", "status", "uploaded_at");

-- CreateIndex
CREATE INDEX "recovery_base_batches_uploader_uploaded_idx" ON "recovery_base_batches"("uploaded_by_user_id", "uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_base_batches_org_file_hash_key" ON "recovery_base_batches"("organization_id", "file_sha256");

-- CreateIndex
CREATE INDEX "recovery_base_records_org_classification_created_idx" ON "recovery_base_records"("organization_id", "classification", "created_at");

-- CreateIndex
CREATE INDEX "recovery_base_records_org_document_idx" ON "recovery_base_records"("organization_id", "document_number");

-- CreateIndex
CREATE INDEX "recovery_base_records_org_service_idx" ON "recovery_base_records"("organization_id", "service_number");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_base_records_batch_source_row_key" ON "recovery_base_records"("batch_id", "source_row");

-- CreateIndex
CREATE INDEX "recovery_cases_org_status_next_action_idx" ON "recovery_cases"("organization_id", "status", "next_action_at");

-- CreateIndex
CREATE INDEX "recovery_cases_org_document_idx" ON "recovery_cases"("organization_id", "document_number");

-- CreateIndex
CREATE INDEX "recovery_cases_org_team_status_idx" ON "recovery_cases"("organization_id", "assigned_team_id", "status");

-- CreateIndex
CREATE INDEX "recovery_cases_org_agent_status_idx" ON "recovery_cases"("organization_id", "assigned_user_id", "status");

-- CreateIndex
CREATE INDEX "recovery_cases_org_status_sighting_idx" ON "recovery_cases"("organization_id", "status", "last_sighting_at");

-- CreateIndex
CREATE INDEX "recovery_case_services_org_service_idx" ON "recovery_case_services"("organization_id", "service_number");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_case_services_case_service_key" ON "recovery_case_services"("case_id", "service_number");

-- CreateIndex
CREATE INDEX "recovery_case_phones_org_phone_idx" ON "recovery_case_phones"("organization_id", "phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_case_phones_case_phone_key" ON "recovery_case_phones"("case_id", "phone_number");

-- CreateIndex
CREATE INDEX "recovery_case_sightings_batch_idx" ON "recovery_case_sightings"("batch_id");

-- CreateIndex
CREATE INDEX "recovery_case_sightings_org_created_idx" ON "recovery_case_sightings"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_case_sightings_case_service_registered_key" ON "recovery_case_sightings"("case_id", "service_number", "registered_at");

-- CreateIndex
CREATE INDEX "recovery_case_events_case_created_idx" ON "recovery_case_events"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "recovery_case_events_org_created_idx" ON "recovery_case_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "recovery_case_events_actor_created_idx" ON "recovery_case_events"("actor_user_id", "created_at");

-- RenameForeignKey
ALTER TABLE "commercial_team_members" RENAME CONSTRAINT "commercial_team_members_team_organization_fkey" TO "commercial_team_members_team_id_organization_id_fkey";

-- AddForeignKey
ALTER TABLE "recovery_eligibility_configs" ADD CONSTRAINT "recovery_eligibility_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_eligibility_configs" ADD CONSTRAINT "recovery_eligibility_configs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_base_batches" ADD CONSTRAINT "recovery_base_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_base_batches" ADD CONSTRAINT "recovery_base_batches_eligibility_config_id_fkey" FOREIGN KEY ("eligibility_config_id") REFERENCES "recovery_eligibility_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_base_batches" ADD CONSTRAINT "recovery_base_batches_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_base_batches" ADD CONSTRAINT "recovery_base_batches_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_base_records" ADD CONSTRAINT "recovery_base_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_base_records" ADD CONSTRAINT "recovery_base_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "recovery_base_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_base_records" ADD CONSTRAINT "recovery_base_records_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "recovery_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_assigned_team_id_fkey" FOREIGN KEY ("assigned_team_id") REFERENCES "commercial_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_sensitive_revealed_by_user_id_fkey" FOREIGN KEY ("sensitive_revealed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_recovered_dito_order_id_fkey" FOREIGN KEY ("recovered_dito_order_id") REFERENCES "dito_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_previous_case_id_fkey" FOREIGN KEY ("previous_case_id") REFERENCES "recovery_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_services" ADD CONSTRAINT "recovery_case_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_services" ADD CONSTRAINT "recovery_case_services_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "recovery_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_phones" ADD CONSTRAINT "recovery_case_phones_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_phones" ADD CONSTRAINT "recovery_case_phones_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "recovery_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_sightings" ADD CONSTRAINT "recovery_case_sightings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_sightings" ADD CONSTRAINT "recovery_case_sightings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "recovery_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_sightings" ADD CONSTRAINT "recovery_case_sightings_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "recovery_base_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_events" ADD CONSTRAINT "recovery_case_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_events" ADD CONSTRAINT "recovery_case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "recovery_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_case_events" ADD CONSTRAINT "recovery_case_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
