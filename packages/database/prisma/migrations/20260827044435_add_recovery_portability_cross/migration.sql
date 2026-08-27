-- CreateEnum
CREATE TYPE "RecoveryPortabilityReportKind" AS ENUM ('FULL', 'QUICK');

-- CreateEnum
CREATE TYPE "RecoveryPortabilityBatchStatus" AS ENUM ('APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecoveryPortabilityState" AS ENUM ('PORTADO', 'NO_PORTADO', 'PROGRAMADO', 'DESCONOCIDO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'PORTABILITY_CROSSED';
ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'PORTABILITY_WAITING';
ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'PORTABILITY_SCHEDULED';
ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'PORTABILITY_DISCARD_REVERTED';

-- AlterTable
ALTER TABLE "recovery_case_services" ADD COLUMN     "needs_revalidation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "portability_checked_at" TIMESTAMPTZ(3),
ADD COLUMN     "portability_receiver" VARCHAR(150),
ADD COLUMN     "portability_state" "RecoveryPortabilityState",
ADD COLUMN     "portability_window_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "recovery_portability_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" "RecoveryPortabilityReportKind" NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_sha256" CHAR(64) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "status" "RecoveryPortabilityBatchStatus" NOT NULL DEFAULT 'APPLIED',
    "total_rows" INTEGER NOT NULL,
    "matched_services" INTEGER NOT NULL DEFAULT 0,
    "discarded_services" INTEGER NOT NULL DEFAULT 0,
    "discarded_cases" INTEGER NOT NULL DEFAULT 0,
    "waiting_cases" INTEGER NOT NULL DEFAULT 0,
    "revalidation_cases" INTEGER NOT NULL DEFAULT 0,
    "scheduled_services" INTEGER NOT NULL DEFAULT 0,
    "plant_line_services" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_user_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failure_reason" TEXT,

    CONSTRAINT "recovery_portability_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_portability_results" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "service_number" VARCHAR(15) NOT NULL,
    "state" "RecoveryPortabilityState" NOT NULL,
    "receiver_raw" VARCHAR(150),
    "cedent_raw" VARCHAR(150),
    "window_date" TIMESTAMPTZ(3),
    "is_movistar_receiver" BOOLEAN NOT NULL DEFAULT false,
    "matched_case" BOOLEAN NOT NULL DEFAULT false,
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_portability_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recovery_portability_batches_org_uploaded_idx" ON "recovery_portability_batches"("organization_id", "uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_portability_batches_org_file_hash_key" ON "recovery_portability_batches"("organization_id", "file_sha256");

-- CreateIndex
CREATE INDEX "recovery_portability_results_org_service_idx" ON "recovery_portability_results"("organization_id", "service_number");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_portability_results_batch_service_key" ON "recovery_portability_results"("batch_id", "service_number");

-- CreateIndex
CREATE INDEX "recovery_case_services_org_discarded_eligible_idx" ON "recovery_case_services"("organization_id", "discarded_at", "portability_eligible_at");

-- AddForeignKey
ALTER TABLE "recovery_portability_batches" ADD CONSTRAINT "recovery_portability_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_portability_batches" ADD CONSTRAINT "recovery_portability_batches_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_portability_results" ADD CONSTRAINT "recovery_portability_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_portability_results" ADD CONSTRAINT "recovery_portability_results_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "recovery_portability_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
