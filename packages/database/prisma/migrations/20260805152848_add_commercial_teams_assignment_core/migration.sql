-- CreateEnum
CREATE TYPE "CommercialTeamStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CommercialTeamMemberRole" AS ENUM ('SUPERVISOR', 'AGENT');

-- CreateEnum
CREATE TYPE "DitoOrderAssignmentReason" AS ENUM ('REGISTERED_FOR_ANOTHER_AGENT', 'INCORRECT_ALIAS', 'AGENT_ABSENCE', 'WORKLOAD_BALANCING', 'TEAM_TRANSFER', 'DATA_CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "DitoOrderAssignmentSource" AS ENUM ('ALIAS_AUTO', 'MANUAL', 'BACKFILL', 'ORPHAN_CLAIM', 'REQUEST_APPROVAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DitoOrderAssignmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DitoOrderAssignmentRequestSource" AS ENUM ('AGENT_REQUEST', 'BACKOFFICE_SUGGESTION', 'SUPERVISOR_REVIEW', 'SYSTEM_REVIEW');

-- AlterTable
ALTER TABLE "commercial_requests" ADD COLUMN     "assigned_team_id" UUID;

-- AlterTable
ALTER TABLE "dito_orders" ADD COLUMN     "assigned_team_id" UUID;

-- CreateTable
CREATE TABLE "commercial_teams" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "normalized_name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50),
    "status" "CommercialTeamStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "commercial_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_team_members" (
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "member_role" "CommercialTeamMemberRole" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by_user_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "commercial_team_members_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateTable
CREATE TABLE "dito_order_assignment_history" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dito_order_id" UUID NOT NULL,
    "previous_agent_user_id" UUID,
    "new_agent_user_id" UUID,
    "previous_team_id" UUID,
    "new_team_id" UUID,
    "original_agent_name_raw" VARCHAR(150) NOT NULL,
    "original_agent_name_normalized" VARCHAR(150),
    "reason" "DitoOrderAssignmentReason" NOT NULL,
    "observation" TEXT,
    "source" "DitoOrderAssignmentSource" NOT NULL,
    "performed_by_user_id" UUID,
    "performed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order_updated_at_before" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dito_order_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dito_order_assignment_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dito_order_id" UUID NOT NULL,
    "status" "DitoOrderAssignmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "source" "DitoOrderAssignmentRequestSource" NOT NULL,
    "requested_by_user_id" UUID,
    "suggested_agent_user_id" UUID,
    "suggested_team_id" UUID,
    "comment" TEXT NOT NULL,
    "reviewed_by_user_id" UUID,
    "review_comment" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "order_updated_at_snapshot" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dito_order_assignment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commercial_teams_org_status_idx" ON "commercial_teams"("organization_id", "status");

-- CreateIndex
CREATE INDEX "commercial_teams_org_name_idx" ON "commercial_teams"("organization_id", "normalized_name");

-- CreateIndex
CREATE INDEX "commercial_team_members_team_role_active_idx" ON "commercial_team_members"("team_id", "member_role", "is_active");

-- CreateIndex
CREATE INDEX "commercial_team_members_user_role_active_idx" ON "commercial_team_members"("user_id", "member_role", "is_active");

-- CreateIndex
CREATE INDEX "commercial_team_members_assigner_created_idx" ON "commercial_team_members"("assigned_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "dito_assignment_history_order_performed_idx" ON "dito_order_assignment_history"("dito_order_id", "performed_at");

-- CreateIndex
CREATE INDEX "dito_assignment_history_org_performed_idx" ON "dito_order_assignment_history"("organization_id", "performed_at");

-- CreateIndex
CREATE INDEX "dito_assignment_history_actor_performed_idx" ON "dito_order_assignment_history"("performed_by_user_id", "performed_at");

-- CreateIndex
CREATE INDEX "dito_assignment_history_new_team_performed_idx" ON "dito_order_assignment_history"("new_team_id", "performed_at");

-- CreateIndex
CREATE INDEX "dito_assignment_requests_org_status_created_idx" ON "dito_order_assignment_requests"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "dito_assignment_requests_order_status_idx" ON "dito_order_assignment_requests"("dito_order_id", "status");

-- CreateIndex
CREATE INDEX "dito_assignment_requests_team_status_idx" ON "dito_order_assignment_requests"("suggested_team_id", "status");

-- CreateIndex
CREATE INDEX "dito_assignment_requests_requester_created_idx" ON "dito_order_assignment_requests"("requested_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "commercial_requests_org_team_created_idx" ON "commercial_requests"("organization_id", "assigned_team_id", "created_at");

-- CreateIndex
CREATE INDEX "commercial_requests_org_team_agent_created_idx" ON "commercial_requests"("organization_id", "assigned_team_id", "agent_user_id", "created_at");

-- CreateIndex
CREATE INDEX "dito_orders_org_team_status_registered_idx" ON "dito_orders"("organization_id", "assigned_team_id", "status", "registered_at");

-- CreateIndex
CREATE INDEX "dito_orders_org_team_agent_registered_idx" ON "dito_orders"("organization_id", "assigned_team_id", "agent_user_id", "registered_at");

-- CreateIndex
CREATE INDEX "dito_orders_org_agent_team_registered_idx" ON "dito_orders"("organization_id", "agent_user_id", "assigned_team_id", "registered_at");

-- AddForeignKey
ALTER TABLE "commercial_requests" ADD CONSTRAINT "commercial_requests_assigned_team_id_fkey" FOREIGN KEY ("assigned_team_id") REFERENCES "commercial_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_orders" ADD CONSTRAINT "dito_orders_assigned_team_id_fkey" FOREIGN KEY ("assigned_team_id") REFERENCES "commercial_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_teams" ADD CONSTRAINT "commercial_teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_teams" ADD CONSTRAINT "commercial_teams_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_team_members" ADD CONSTRAINT "commercial_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "commercial_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_team_members" ADD CONSTRAINT "commercial_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_team_members" ADD CONSTRAINT "commercial_team_members_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_history" ADD CONSTRAINT "dito_order_assignment_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_history" ADD CONSTRAINT "dito_order_assignment_history_dito_order_id_fkey" FOREIGN KEY ("dito_order_id") REFERENCES "dito_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_history" ADD CONSTRAINT "dito_order_assignment_history_previous_agent_user_id_fkey" FOREIGN KEY ("previous_agent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_history" ADD CONSTRAINT "dito_order_assignment_history_new_agent_user_id_fkey" FOREIGN KEY ("new_agent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_history" ADD CONSTRAINT "dito_order_assignment_history_previous_team_id_fkey" FOREIGN KEY ("previous_team_id") REFERENCES "commercial_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_history" ADD CONSTRAINT "dito_order_assignment_history_new_team_id_fkey" FOREIGN KEY ("new_team_id") REFERENCES "commercial_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_history" ADD CONSTRAINT "dito_order_assignment_history_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_requests" ADD CONSTRAINT "dito_order_assignment_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_requests" ADD CONSTRAINT "dito_order_assignment_requests_dito_order_id_fkey" FOREIGN KEY ("dito_order_id") REFERENCES "dito_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_requests" ADD CONSTRAINT "dito_order_assignment_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_requests" ADD CONSTRAINT "dito_order_assignment_requests_suggested_agent_user_id_fkey" FOREIGN KEY ("suggested_agent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_requests" ADD CONSTRAINT "dito_order_assignment_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dito_order_assignment_requests" ADD CONSTRAINT "dito_order_assignment_requests_suggested_team_id_fkey" FOREIGN KEY ("suggested_team_id") REFERENCES "commercial_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- SPEC-001 / BR-002:
-- El nombre normalizado debe ser único entre los equipos activos
-- de una misma organización.
CREATE UNIQUE INDEX "commercial_teams_org_active_name_key"
ON "commercial_teams" ("organization_id", "normalized_name")
WHERE "status" = 'ACTIVE';

-- SPEC-001 / BR-003:
-- Un agente solo puede tener una membresía primaria activa.
CREATE UNIQUE INDEX "commercial_team_members_one_primary_agent_key"
ON "commercial_team_members" ("user_id")
WHERE
  "member_role" = 'AGENT'
  AND "is_primary" = true
  AND "is_active" = true;

-- SPEC-001 / BR-052, INV-012:
-- Una orden solo puede tener una solicitud de reasignación pendiente.
CREATE UNIQUE INDEX "dito_assignment_requests_one_pending_order_key"
ON "dito_order_assignment_requests" ("dito_order_id")
WHERE "status" = 'PENDING';
