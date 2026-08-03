-- CreateEnum
CREATE TYPE "AgentAliasSource" AS ENUM ('MANUAL', 'DITO_LEGACY', 'GHL_OWNER', 'IMPORT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DNI', 'FOREIGNER_ID', 'RUC_10', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LeadOrigin" AS ENUM ('CAMPAIGN', 'DATABASE', 'REFERRAL', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CommercialRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Carrier" AS ENUM ('BITEL', 'CLARO', 'ENTEL', 'MOVISTAR', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CommercialOperation" AS ENUM ('NEW_LINE', 'PORT_PREPAID', 'PORT_POSTPAID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ManagementStatus" AS ENUM ('QUALIFIED', 'FOLLOW_UP', 'ORDER_ENTERED', 'CHIP_DELIVERED', 'SALE_CONFIRMED', 'LOST');

-- CreateEnum
CREATE TYPE "ActivationStatus" AS ENUM ('PENDING', 'INCIDENT', 'ACTIVATED');

-- CreateEnum
CREATE TYPE "FollowUpReason" AS ENUM ('SCHEDULED', 'ACTIVE_DEBT', 'LESS_THAN_30_DAYS', 'MEETING_POINT');

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('CURRENT_MOVISTAR_CUSTOMER', 'OUT_OF_COVERAGE', 'ZERO_FIXED_CHARGE', 'FOREIGNER_ID', 'DEVICE_INSTALLMENTS', 'NO_LONGER_INTERESTED', 'PORTED_OTHER_AGENCY', 'PORTED_OTHER_OPERATOR', 'RUC_10');

-- CreateEnum
CREATE TYPE "DeliveryShiftCode" AS ENUM ('MORNING', 'MIDDAY', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "DeliveryEscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DitoProductType" AS ENUM ('MOBILE', 'FIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DitoDeliveryMethod" AS ENUM ('EXPRESS', 'REGULAR_24H', 'REGULAR_48H', 'REGULAR_72H', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DitoParseStatus" AS ENUM ('PARSED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "DitoMatchStatus" AS ENUM ('UNMATCHED', 'SUGGESTED', 'LINKED', 'NEEDS_REVIEW', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ApprovalSource" AS ENUM ('ASSUMED_FROM_REGISTRATION', 'MANUAL_INTEGRATEL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'NOT_DELIVERED', 'RESCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DitoOrderLinkAction" AS ENUM ('LINKED', 'UNLINKED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "DitoOrderLinkMethod" AS ENUM ('MANUAL', 'SUGGESTED');

-- CreateTable
CREATE TABLE "agent_aliases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "alias" VARCHAR(150) NOT NULL,
    "normalized_alias" VARCHAR(150) NOT NULL,
    "source" "AgentAliasSource" NOT NULL DEFAULT 'MANUAL',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agent_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL DEFAULT 'UNKNOWN',
    "document_number" VARCHAR(30),
    "document_number_normalized" VARCHAR(30),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "full_name" VARCHAR(200),
    "email" VARCHAR(254),
    "primary_phone" VARCHAR(30),
    "secondary_phone" VARCHAR(30),
    "customer_city" VARCHAR(100),
    "country" VARCHAR(2) NOT NULL DEFAULT 'PE',
    "contact_type" VARCHAR(50),
    "tags" TEXT,
    "source_created_at" TIMESTAMPTZ(3),
    "last_event_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_external_identities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "ghl_integration_id" UUID NOT NULL,
    "external_contact_id" VARCHAR(100) NOT NULL,
    "location_id" VARCHAR(100) NOT NULL,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contact_external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "ghl_integration_id" UUID,
    "external_opportunity_id" VARCHAR(100),
    "requester_contact_id" UUID,
    "referrer_contact_id" UUID,
    "agent_user_id" UUID,
    "lead_origin" "LeadOrigin" NOT NULL DEFAULT 'UNKNOWN',
    "status" "CommercialRequestStatus" NOT NULL DEFAULT 'OPEN',
    "reported_total_fixed_charge" DECIMAL(10,2),
    "pipeline_stage" VARCHAR(150),
    "opportunity_status" VARCHAR(50),
    "referrer_name_raw" VARCHAR(200),
    "referrer_phone_raw" VARCHAR(30),
    "referral_notes" TEXT,
    "source_created_at" TIMESTAMPTZ(3),
    "last_event_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "commercial_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "commercial_request_id" UUID NOT NULL,
    "holder_contact_id" UUID,
    "service_number" VARCHAR(30),
    "carrier" "Carrier" NOT NULL DEFAULT 'UNKNOWN',
    "commercial_operation" "CommercialOperation" NOT NULL DEFAULT 'UNKNOWN',
    "fixed_charge" DECIMAL(10,2),
    "management_status" "ManagementStatus",
    "follow_up_reason" "FollowUpReason",
    "lost_reason" "LostReason",
    "activation_status" "ActivationStatus",
    "incident_reason" TEXT,
    "source_created_at" TIMESTAMPTZ(3),
    "last_event_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "commercial_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_shifts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" "DeliveryShiftCode" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "delivery_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_escalations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dito_order_id" UUID NOT NULL,
    "observation" TEXT NOT NULL,
    "generated_message" TEXT NOT NULL,
    "order_code_raw_snapshot" VARCHAR(100) NOT NULL,
    "delivery_method_snapshot" "DitoDeliveryMethod" NOT NULL,
    "contact_phone_snapshot" VARCHAR(30) NOT NULL,
    "department_snapshot" VARCHAR(100) NOT NULL,
    "province_snapshot" VARCHAR(100) NOT NULL,
    "district_snapshot" VARCHAR(100) NOT NULL,
    "delivery_window_start_snapshot" TIMESTAMPTZ(3),
    "delivery_window_end_snapshot" TIMESTAMPTZ(3),
    "status" "DeliveryEscalationStatus" NOT NULL DEFAULT 'OPEN',
    "created_by_user_id" UUID NOT NULL,
    "acknowledged_by_user_id" UUID,
    "resolved_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "delivery_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dito_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" VARCHAR(191) NOT NULL,
    "source_fingerprint" CHAR(64) NOT NULL,
    "product_type" "DitoProductType" NOT NULL DEFAULT 'UNKNOWN',
    "order_code_raw" VARCHAR(100) NOT NULL,
    "order_code_normalized" VARCHAR(100) NOT NULL,
    "order_code_suffix" VARCHAR(10) NOT NULL,
    "displayed_order_code" VARCHAR(100),
    "operation_raw" VARCHAR(200) NOT NULL,
    "commercial_operation" "CommercialOperation" NOT NULL DEFAULT 'UNKNOWN',
    "carrier" "Carrier" NOT NULL DEFAULT 'UNKNOWN',
    "fixed_charge" DECIMAL(10,2),
    "sales_code" VARCHAR(100),
    "billing_cycle_day" INTEGER,
    "payment_due_day" INTEGER,
    "holder_full_name_raw" VARCHAR(200) NOT NULL,
    "holder_document_type" "DocumentType" NOT NULL DEFAULT 'UNKNOWN',
    "holder_document_number" VARCHAR(30) NOT NULL,
    "service_number" VARCHAR(30) NOT NULL,
    "delivery_contact_phone" VARCHAR(30) NOT NULL,
    "delivery_method" "DitoDeliveryMethod" NOT NULL DEFAULT 'UNKNOWN',
    "delivery_method_raw" VARCHAR(150),
    "department" VARCHAR(100) NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100) NOT NULL,
    "agent_name_raw" VARCHAR(150) NOT NULL,
    "agent_name_normalized" VARCHAR(150),
    "agent_user_id" UUID,
    "raw_summary" TEXT NOT NULL,
    "additional_details" JSONB NOT NULL,
    "parse_status" "DitoParseStatus" NOT NULL DEFAULT 'PARSED',
    "match_status" "DitoMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "captured_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registered_at" TIMESTAMPTZ(3) NOT NULL,
    "approved_at" TIMESTAMPTZ(3) NOT NULL,
    "approval_source" "ApprovalSource" NOT NULL DEFAULT 'ASSUMED_FROM_REGISTRATION',
    "approval_updated_at" TIMESTAMPTZ(3),
    "approval_updated_by_user_id" UUID,
    "scheduled_delivery_date" DATE,
    "delivery_shift_id" UUID,
    "delivery_window_start" TIMESTAMPTZ(3),
    "delivery_window_end" TIMESTAMPTZ(3),
    "delivery_due_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "delivery_failure_reason" VARCHAR(150),
    "delivery_observation" TEXT,
    "commercial_service_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dito_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dito_order_link_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dito_order_id" UUID NOT NULL,
    "previous_commercial_request_id" UUID,
    "new_commercial_request_id" UUID,
    "previous_commercial_service_id" UUID,
    "new_commercial_service_id" UUID,
    "action" "DitoOrderLinkAction" NOT NULL,
    "method" "DitoOrderLinkMethod" NOT NULL,
    "suggestion_score" INTEGER,
    "reason" TEXT,
    "performed_by_user_id" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dito_order_link_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_aliases_org_alias_idx" ON "agent_aliases"("organization_id", "normalized_alias");

-- CreateIndex
CREATE INDEX "agent_aliases_org_active_idx" ON "agent_aliases"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "agent_aliases_org_user_alias_key" ON "agent_aliases"("organization_id", "user_id", "normalized_alias");

-- CreateIndex
CREATE INDEX "contacts_org_primary_phone_idx" ON "contacts"("organization_id", "primary_phone");

-- CreateIndex
CREATE INDEX "contacts_org_email_idx" ON "contacts"("organization_id", "email");

-- CreateIndex
CREATE INDEX "contacts_org_full_name_idx" ON "contacts"("organization_id", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_org_document_key" ON "contacts"("organization_id", "document_type", "document_number_normalized");

-- CreateIndex
CREATE INDEX "contact_external_identities_org_external_idx" ON "contact_external_identities"("organization_id", "external_contact_id");

-- CreateIndex
CREATE INDEX "contact_external_identities_contact_idx" ON "contact_external_identities"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_external_identities_integration_contact_key" ON "contact_external_identities"("ghl_integration_id", "external_contact_id");

-- CreateIndex
CREATE INDEX "commercial_requests_org_status_created_idx" ON "commercial_requests"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "commercial_requests_org_origin_created_idx" ON "commercial_requests"("organization_id", "lead_origin", "created_at");

-- CreateIndex
CREATE INDEX "commercial_requests_org_agent_created_idx" ON "commercial_requests"("organization_id", "agent_user_id", "created_at");

-- CreateIndex
CREATE INDEX "commercial_requests_requester_idx" ON "commercial_requests"("requester_contact_id");

-- CreateIndex
CREATE INDEX "commercial_requests_referrer_idx" ON "commercial_requests"("referrer_contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_requests_integration_opportunity_key" ON "commercial_requests"("ghl_integration_id", "external_opportunity_id");

-- CreateIndex
CREATE INDEX "commercial_services_org_status_created_idx" ON "commercial_services"("organization_id", "management_status", "created_at");

-- CreateIndex
CREATE INDEX "commercial_services_request_created_idx" ON "commercial_services"("commercial_request_id", "created_at");

-- CreateIndex
CREATE INDEX "commercial_services_org_service_number_idx" ON "commercial_services"("organization_id", "service_number");

-- CreateIndex
CREATE INDEX "commercial_services_holder_idx" ON "commercial_services"("holder_contact_id");

-- CreateIndex
CREATE INDEX "delivery_shifts_org_active_order_idx" ON "delivery_shifts"("organization_id", "is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_shifts_org_code_key" ON "delivery_shifts"("organization_id", "code");

-- CreateIndex
CREATE INDEX "delivery_escalations_org_status_created_idx" ON "delivery_escalations"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "delivery_escalations_order_created_idx" ON "delivery_escalations"("dito_order_id", "created_at");

-- CreateIndex
CREATE INDEX "dito_orders_org_match_captured_idx" ON "dito_orders"("organization_id", "match_status", "captured_at");

-- CreateIndex
CREATE INDEX "dito_orders_org_delivery_due_idx" ON "dito_orders"("organization_id", "delivery_status", "delivery_due_at");

-- CreateIndex
CREATE INDEX "dito_orders_org_agent_captured_idx" ON "dito_orders"("organization_id", "agent_user_id", "captured_at");

-- CreateIndex
CREATE INDEX "dito_orders_org_agent_name_idx" ON "dito_orders"("organization_id", "agent_name_normalized", "captured_at");

-- CreateIndex
CREATE INDEX "dito_orders_commercial_service_idx" ON "dito_orders"("commercial_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "dito_orders_org_event_key" ON "dito_orders"("organization_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "dito_orders_org_order_code_key" ON "dito_orders"("organization_id", "order_code_normalized");

-- CreateIndex
CREATE INDEX "dito_order_link_history_order_performed_idx" ON "dito_order_link_history"("dito_order_id", "performed_at");

-- CreateIndex
CREATE INDEX "dito_order_link_history_org_performed_idx" ON "dito_order_link_history"("organization_id", "performed_at");

-- CreateIndex
CREATE INDEX "dito_order_link_history_user_performed_idx" ON "dito_order_link_history"("performed_by_user_id", "performed_at");

-- AddForeignKey
ALTER TABLE "agent_aliases" ADD CONSTRAINT "agent_aliases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_aliases" ADD CONSTRAINT "agent_aliases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_external_identities" ADD CONSTRAINT "contact_external_identities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_external_identities" ADD CONSTRAINT "contact_external_identities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_external_identities" ADD CONSTRAINT "contact_external_identities_ghl_integration_id_fkey" FOREIGN KEY ("ghl_integration_id") REFERENCES "ghl_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_requests" ADD CONSTRAINT "commercial_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_requests" ADD CONSTRAINT "commercial_requests_ghl_integration_id_fkey" FOREIGN KEY ("ghl_integration_id") REFERENCES "ghl_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_requests" ADD CONSTRAINT "commercial_requests_requester_contact_id_fkey" FOREIGN KEY ("requester_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_requests" ADD CONSTRAINT "commercial_requests_referrer_contact_id_fkey" FOREIGN KEY ("referrer_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_requests" ADD CONSTRAINT "commercial_requests_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_services" ADD CONSTRAINT "commercial_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_services" ADD CONSTRAINT "commercial_services_commercial_request_id_fkey" FOREIGN KEY ("commercial_request_id") REFERENCES "commercial_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_services" ADD CONSTRAINT "commercial_services_holder_contact_id_fkey" FOREIGN KEY ("holder_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_shifts" ADD CONSTRAINT "delivery_shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_escalations" ADD CONSTRAINT "delivery_escalations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_escalations" ADD CONSTRAINT "delivery_escalations_dito_order_id_fkey" FOREIGN KEY ("dito_order_id") REFERENCES "dito_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_escalations" ADD CONSTRAINT "delivery_escalations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_escalations" ADD CONSTRAINT "delivery_escalations_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_escalations" ADD CONSTRAINT "delivery_escalations_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_orders" ADD CONSTRAINT "dito_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_orders" ADD CONSTRAINT "dito_orders_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_orders" ADD CONSTRAINT "dito_orders_approval_updated_by_user_id_fkey" FOREIGN KEY ("approval_updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_orders" ADD CONSTRAINT "dito_orders_commercial_service_id_fkey" FOREIGN KEY ("commercial_service_id") REFERENCES "commercial_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_orders" ADD CONSTRAINT "dito_orders_delivery_shift_id_fkey" FOREIGN KEY ("delivery_shift_id") REFERENCES "delivery_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_link_history" ADD CONSTRAINT "dito_order_link_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_link_history" ADD CONSTRAINT "dito_order_link_history_dito_order_id_fkey" FOREIGN KEY ("dito_order_id") REFERENCES "dito_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_link_history" ADD CONSTRAINT "dito_order_link_history_previous_commercial_request_id_fkey" FOREIGN KEY ("previous_commercial_request_id") REFERENCES "commercial_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_link_history" ADD CONSTRAINT "dito_order_link_history_new_commercial_request_id_fkey" FOREIGN KEY ("new_commercial_request_id") REFERENCES "commercial_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_link_history" ADD CONSTRAINT "dito_order_link_history_previous_commercial_service_id_fkey" FOREIGN KEY ("previous_commercial_service_id") REFERENCES "commercial_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_link_history" ADD CONSTRAINT "dito_order_link_history_new_commercial_service_id_fkey" FOREIGN KEY ("new_commercial_service_id") REFERENCES "commercial_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_link_history" ADD CONSTRAINT "dito_order_link_history_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
