-- CreateEnum
CREATE TYPE "DitoOrderStatus" AS ENUM ('OPEN', 'SENT', 'CLOSED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DitoSentSubstatus" AS ENUM ('NO_STATUS', 'ASSIGNED', 'SCHEDULED', 'NOT_DELIVERED', 'REJECTED', 'DELIVERED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "dito_orders" ADD COLUMN     "no_status_detected_at" TIMESTAMPTZ(3),
ADD COLUMN     "sent_substatus" "DitoSentSubstatus",
ADD COLUMN     "sent_substatus_raw" VARCHAR(100),
ADD COLUMN     "sent_substatus_updated_at" TIMESTAMPTZ(3),
ADD COLUMN     "status" "DitoOrderStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "status_raw" VARCHAR(100),
ADD COLUMN     "status_updated_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "dito_orders_org_status_registered_idx" ON "dito_orders"("organization_id", "status", "registered_at");

-- CreateIndex
CREATE INDEX "dito_orders_org_status_substatus_registered_idx" ON "dito_orders"("organization_id", "status", "sent_substatus", "registered_at");
