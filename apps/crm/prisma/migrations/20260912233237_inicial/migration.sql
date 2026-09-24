-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'SUPERVISOR', 'AGENT', 'BACKOFFICE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WhatsappNumberStatus" AS ENUM ('PENDING', 'CONNECTED', 'RESTRICTED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ConnectionMethod" AS ENUM ('MANUAL', 'EMBEDDED_SIGNUP');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'RETIRED');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');

-- CreateEnum
CREATE TYPE "ContactOrigin" AS ENUM ('AD', 'BROADCAST', 'REFERRAL', 'ADVISOR', 'ORGANIC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConsentCategory" AS ENUM ('SERVICE', 'MARKETING');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ResponderState" AS ENUM ('IA_ACTIVA', 'REQUIERE_ASESOR', 'CONTROL_HUMANO');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "MessageOriginKind" AS ENUM ('USER', 'AGENT_AI', 'WORKFLOW', 'BROADCAST', 'SYSTEM', 'CONTACT');

-- CreateEnum
CREATE TYPE "OutboundJobStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('NUEVO', 'EN_CONTACTO', 'CALIFICADO', 'PROPUESTA', 'EN_CIERRE', 'GANADA', 'PERDIDA');

-- CreateEnum
CREATE TYPE "CustomerRelation" AS ENUM ('NEW', 'EXISTING');

-- CreateEnum
CREATE TYPE "NextActionKind" AS ENUM ('LLAMAR', 'CITA', 'ESPERAR_RESPUESTA', 'COMPLETAR_DATOS');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('INGRESADO', 'ENTREGADO', 'ACTIVADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'DONE', 'NO_SHOW', 'RESCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiAgentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('RUNNING', 'WAITING', 'DONE', 'STOPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Lima',
    "business_hours" JSONB NOT NULL DEFAULT '{"days":[1,2,3,4,5,6],"start":"09:00","end":"19:00"}',
    "unattended_after_minutes" INTEGER NOT NULL DEFAULT 15,
    "return_to_queue_after_minutes" INTEGER NOT NULL DEFAULT 30,
    "hand_back_to_agent_on_close" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "user_id" UUID NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "account_id" VARCHAR(255) NOT NULL,
    "provider_id" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "refresh_token_expires_at" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "identifier" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3),

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "target_kind" VARCHAR(40) NOT NULL,
    "target_id" VARCHAR(80),
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_numbers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "waba_id" VARCHAR(40) NOT NULL,
    "phone_number_id" VARCHAR(40) NOT NULL,
    "display_phone_number" VARCHAR(40),
    "verified_name" VARCHAR(160),
    "status" "WhatsappNumberStatus" NOT NULL DEFAULT 'PENDING',
    "quality_rating" VARCHAR(20),
    "messaging_limit_tier" VARCHAR(40),
    "connection_method" "ConnectionMethod" NOT NULL,
    "access_token_ciphertext" TEXT NOT NULL,
    "default_ai_agent_id" UUID,
    "last_error" TEXT,
    "connected_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "whatsapp_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "source" VARCHAR(40) NOT NULL DEFAULT 'META_WHATSAPP',
    "external_id" VARCHAR(200) NOT NULL,
    "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "whatsapp_number_id" UUID NOT NULL,
    "external_id" VARCHAR(40),
    "name" VARCHAR(512) NOT NULL,
    "language" VARCHAR(16) NOT NULL DEFAULT 'es',
    "category" "TemplateCategory" NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "components" JSONB NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "rejected_reason" TEXT,
    "quality_score" VARCHAR(20),
    "paused_until" TIMESTAMPTZ(3),
    "last_synced_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "display_name" VARCHAR(200),
    "phone" VARCHAR(20),
    "wa_user_id" VARCHAR(80),
    "document_number" VARCHAR(20),
    "email" VARCHAR(255),
    "district" VARCHAR(120),
    "current_carrier" VARCHAR(60),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "initial_origin" "ContactOrigin" NOT NULL DEFAULT 'UNKNOWN',
    "initial_origin_ref" VARCHAR(120),
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "marketing_opt_out_at" TIMESTAMPTZ(3),
    "last_inbound_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_consents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "category" "ConsentCategory" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "evidence_text" TEXT,
    "recorded_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "whatsapp_number_id" UUID NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "responder_state" "ResponderState" NOT NULL DEFAULT 'REQUIERE_ASESOR',
    "responder_changed_at" TIMESTAMPTZ(3),
    "assigned_user_id" UUID,
    "assigned_at" TIMESTAMPTZ(3),
    "ai_agent_id" UUID,
    "origin_referral" JSONB,
    "origin_ad_id" VARCHAR(80),
    "is_order_inquiry" BOOLEAN NOT NULL DEFAULT false,
    "last_inbound_at" TIMESTAMPTZ(3),
    "last_outbound_at" TIMESTAMPTZ(3),
    "last_message_at" TIMESTAMPTZ(3),
    "last_message_preview" VARCHAR(200),
    "free_until" TIMESTAMPTZ(3),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "first_response_at" TIMESTAMPTZ(3),
    "unattended_since" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "external_id" VARCHAR(200),
    "type" VARCHAR(40) NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "raw_payload" JSONB,
    "media_path" VARCHAR(300),
    "media_mime_type" VARCHAR(120),
    "media_size_bytes" INTEGER,
    "status" "MessageStatus" NOT NULL,
    "error_code" VARCHAR(40),
    "error_title" TEXT,
    "origin_kind" "MessageOriginKind" NOT NULL,
    "origin_ref" VARCHAR(120),
    "sender_user_id" UUID,
    "template_id" UUID,
    "client_request_id" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_jobs" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "status" "OutboundJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbound_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_notes" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_events" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "actor_user_id" UUID,
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_replies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shortcut" VARCHAR(40) NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "conversation_id" UUID,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'NUEVO',
    "stage_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origin" "ContactOrigin" NOT NULL DEFAULT 'UNKNOWN',
    "origin_ref" VARCHAR(120),
    "customer_relation" "CustomerRelation" NOT NULL DEFAULT 'NEW',
    "assigned_user_id" UUID,
    "next_action_kind" "NextActionKind",
    "next_action_at" TIMESTAMPTZ(3),
    "proposal_plan_id" UUID,
    "proposal_lines" INTEGER,
    "proposal_fixed_charge" DECIMAL(10,2),
    "lost_reason" VARCHAR(60),
    "lost_detail" TEXT,
    "order_dropped" BOOLEAN NOT NULL DEFAULT false,
    "won_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_events" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "actor_user_id" UUID,
    "actor_kind" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID,
    "opportunity_id" UUID,
    "external_ref" VARCHAR(80) NOT NULL,
    "document_number" VARCHAR(20),
    "holder_name" VARCHAR(200),
    "phone" VARCHAR(20),
    "plan_name" VARCHAR(120),
    "fixed_charge" DECIMAL(10,2),
    "status" "OrderStatus" NOT NULL DEFAULT 'INGRESADO',
    "link_confidence" VARCHAR(20),
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(3),
    "activated_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_catalog_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "fixed_charge" DECIMAL(10,2) NOT NULL,
    "requirements" TEXT,
    "promotion" TEXT,
    "valid_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "opportunity_id" UUID,
    "conversation_id" UUID,
    "user_id" UUID,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_by_kind" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "created_by_user_id" UUID,
    "superseded_by_id" UUID,
    "client_request_id" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "slot_minutes" INTEGER NOT NULL DEFAULT 30,
    "capacity" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "AiAgentStatus" NOT NULL DEFAULT 'DRAFT',
    "provider" VARCHAR(40) NOT NULL DEFAULT 'ANTHROPIC',
    "model_id" VARCHAR(80) NOT NULL DEFAULT 'claude-opus-5',
    "effort" VARCHAR(16) NOT NULL DEFAULT 'low',
    "draft_config" JSONB NOT NULL,
    "draft_tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_version_id" UUID,
    "schedule" JSONB NOT NULL DEFAULT '{"mode":"WHEN_NO_ADVISOR"}',
    "monthly_budget_pen" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent_versions" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model_id" VARCHAR(80) NOT NULL,
    "effort" VARCHAR(16) NOT NULL,
    "config" JSONB NOT NULL,
    "tools" TEXT[],
    "knowledge_snapshot" JSONB NOT NULL,
    "test_summary" JSONB,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by_user_id" UUID,
    "publish_reason" TEXT,

    CONSTRAINT "ai_agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent_examples" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "turns" JSONB NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_agent_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_test_cases" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "input_turns" JSONB NOT NULL,
    "expectations" JSONB NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_test_results" (
    "id" UUID NOT NULL,
    "test_case_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "transcript" JSONB NOT NULL,
    "detail" TEXT,
    "cost_usd" DECIMAL(10,6),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_turns" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "version_id" UUID,
    "conversation_id" UUID,
    "mode" VARCHAR(16) NOT NULL,
    "model_id" VARCHAR(80) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "tool_calls" JSONB NOT NULL,
    "articles_used" JSONB,
    "stop_reason" VARCHAR(40),
    "response_text" TEXT,
    "flagged_reason" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "trigger" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version" INTEGER NOT NULL,
    "conversation_id" UUID,
    "contact_id" UUID,
    "opportunity_id" UUID,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'RUNNING',
    "current_step_id" VARCHAR(40),
    "resume_at" TIMESTAMPTZ(3),
    "waiting_for_reply" BOOLEAN NOT NULL DEFAULT false,
    "step_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "trigger_payload" JSONB,
    "log" JSONB NOT NULL DEFAULT '[]',
    "end_reason" VARCHAR(120),
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "whatsapp_number_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "segment" JSONB NOT NULL,
    "variable_values" JSONB NOT NULL DEFAULT '{}',
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "pause_reason" TEXT,
    "created_by_user_id" UUID,
    "approved_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" UUID NOT NULL,
    "broadcast_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "exclusion_reason" VARCHAR(120),
    "message_id" UUID,
    "replied_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numbers_phone_number_id_key" ON "whatsapp_numbers"("phone_number_id");

-- CreateIndex
CREATE INDEX "whatsapp_numbers_organization_id_idx" ON "whatsapp_numbers"("organization_id");

-- CreateIndex
CREATE INDEX "webhook_events_status_received_at_idx" ON "webhook_events"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_source_external_id_key" ON "webhook_events"("source", "external_id");

-- CreateIndex
CREATE INDEX "message_templates_organization_id_status_idx" ON "message_templates"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_whatsapp_number_id_name_language_key" ON "message_templates"("whatsapp_number_id", "name", "language");

-- CreateIndex
CREATE INDEX "contacts_organization_id_document_number_idx" ON "contacts"("organization_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organization_id_phone_key" ON "contacts"("organization_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organization_id_wa_user_id_key" ON "contacts"("organization_id", "wa_user_id");

-- CreateIndex
CREATE INDEX "contact_consents_contact_id_category_created_at_idx" ON "contact_consents"("contact_id", "category", "created_at");

-- CreateIndex
CREATE INDEX "conversations_organization_id_status_last_message_at_idx" ON "conversations"("organization_id", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_organization_id_assigned_user_id_status_idx" ON "conversations"("organization_id", "assigned_user_id", "status");

-- CreateIndex
CREATE INDEX "conversations_contact_id_idx" ON "conversations"("contact_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_organization_id_external_id_key" ON "messages"("organization_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_organization_id_client_request_id_key" ON "messages"("organization_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_jobs_message_id_key" ON "outbound_jobs"("message_id");

-- CreateIndex
CREATE INDEX "outbound_jobs_status_next_attempt_at_idx" ON "outbound_jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "conversation_notes_conversation_id_created_at_idx" ON "conversation_notes"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "conversation_events_conversation_id_created_at_idx" ON "conversation_events"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "quick_replies_organization_id_shortcut_key" ON "quick_replies"("organization_id", "shortcut");

-- CreateIndex
CREATE INDEX "opportunities_organization_id_stage_last_activity_at_idx" ON "opportunities"("organization_id", "stage", "last_activity_at");

-- CreateIndex
CREATE INDEX "opportunities_contact_id_stage_idx" ON "opportunities"("contact_id", "stage");

-- CreateIndex
CREATE INDEX "opportunity_events_opportunity_id_created_at_idx" ON "opportunity_events"("opportunity_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_organization_id_document_number_idx" ON "orders"("organization_id", "document_number");

-- CreateIndex
CREATE INDEX "orders_organization_id_status_registered_at_idx" ON "orders"("organization_id", "status", "registered_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_organization_id_external_ref_key" ON "orders"("organization_id", "external_ref");

-- CreateIndex
CREATE INDEX "plan_catalog_items_organization_id_valid_until_idx" ON "plan_catalog_items"("organization_id", "valid_until");

-- CreateIndex
CREATE INDEX "appointments_organization_id_scheduled_at_idx" ON "appointments"("organization_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "appointments_user_id_scheduled_at_idx" ON "appointments"("user_id", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_organization_id_client_request_id_key" ON "appointments"("organization_id", "client_request_id");

-- CreateIndex
CREATE INDEX "booking_rules_organization_id_weekday_idx" ON "booking_rules"("organization_id", "weekday");

-- CreateIndex
CREATE INDEX "ai_agents_organization_id_status_idx" ON "ai_agents"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_agent_versions_agent_id_version_number_key" ON "ai_agent_versions"("agent_id", "version_number");

-- CreateIndex
CREATE INDEX "knowledge_articles_agent_id_valid_until_idx" ON "knowledge_articles"("agent_id", "valid_until");

-- CreateIndex
CREATE INDEX "ai_test_results_run_id_idx" ON "ai_test_results"("run_id");

-- CreateIndex
CREATE INDEX "ai_turns_agent_id_created_at_idx" ON "ai_turns"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "workflows_organization_id_status_idx" ON "workflows"("organization_id", "status");

-- CreateIndex
CREATE INDEX "workflow_runs_status_resume_at_idx" ON "workflow_runs"("status", "resume_at");

-- CreateIndex
CREATE INDEX "workflow_runs_conversation_id_status_idx" ON "workflow_runs"("conversation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_workflow_id_idempotency_key_key" ON "workflow_runs"("workflow_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "broadcasts_organization_id_status_idx" ON "broadcasts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_recipients_message_id_key" ON "broadcast_recipients"("message_id");

-- CreateIndex
CREATE INDEX "broadcast_recipients_broadcast_id_status_idx" ON "broadcast_recipients"("broadcast_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_recipients_broadcast_id_contact_id_key" ON "broadcast_recipients"("broadcast_id", "contact_id");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_numbers" ADD CONSTRAINT "whatsapp_numbers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_whatsapp_number_id_fkey" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_whatsapp_number_id_fkey" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_jobs" ADD CONSTRAINT "outbound_jobs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_proposal_plan_id_fkey" FOREIGN KEY ("proposal_plan_id") REFERENCES "plan_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_events" ADD CONSTRAINT "opportunity_events_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_catalog_items" ADD CONSTRAINT "plan_catalog_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_rules" ADD CONSTRAINT "booking_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent_versions" ADD CONSTRAINT "ai_agent_versions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent_examples" ADD CONSTRAINT "ai_agent_examples_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_test_cases" ADD CONSTRAINT "ai_test_cases_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_test_results" ADD CONSTRAINT "ai_test_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "ai_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_turns" ADD CONSTRAINT "ai_turns_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_turns" ADD CONSTRAINT "ai_turns_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "ai_agent_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_turns" ADD CONSTRAINT "ai_turns_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_whatsapp_number_id_fkey" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
