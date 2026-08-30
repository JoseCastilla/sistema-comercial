CREATE TYPE "MobileDebtCredentialStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ERROR');
CREATE TYPE "MobileDebtOperator" AS ENUM ('CLARO', 'ENTEL', 'BITEL');
CREATE TYPE "MobileDebtLookupStatus" AS ENUM ('SUCCESS', 'FAILED');

CREATE TABLE "mobile_debt_integrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "encrypted_credentials" TEXT NOT NULL,
    "credential_hint" VARCHAR(8) NOT NULL,
    "credential_status" "MobileDebtCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "credential_updated_by_id" UUID NOT NULL,
    "credential_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_validated_at" TIMESTAMPTZ(3),
    "last_attempt_at" TIMESTAMPTZ(3),
    "last_success_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "mobile_debt_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mobile_debt_lookup_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "mobile_debt_integration_id" UUID,
    "actor_user_id" UUID NOT NULL,
    "operator" "MobileDebtOperator" NOT NULL,
    "phone" VARCHAR(9) NOT NULL,
    "status" "MobileDebtLookupStatus" NOT NULL,
    "debt_amount" DECIMAL(12,2),
    "commission_amount" DECIMAL(12,2),
    "total_amount" DECIMAL(12,2),
    "due_date_raw" VARCHAR(30),
    "error_code" VARCHAR(50),
    "queried_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mobile_debt_lookup_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mobile_debt_lookup_events_phone_check" CHECK ("phone" ~ '^9[0-9]{8}$')
);

CREATE UNIQUE INDEX "mobile_debt_integrations_organization_id_key"
ON "mobile_debt_integrations"("organization_id");

CREATE INDEX "mobile_debt_lookup_events_org_queried_idx"
ON "mobile_debt_lookup_events"("organization_id", "queried_at");

CREATE INDEX "mobile_debt_lookup_events_actor_queried_idx"
ON "mobile_debt_lookup_events"("actor_user_id", "queried_at");

CREATE INDEX "mobile_debt_lookup_events_phone_queried_idx"
ON "mobile_debt_lookup_events"("phone", "queried_at");

ALTER TABLE "mobile_debt_integrations"
ADD CONSTRAINT "mobile_debt_integrations_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mobile_debt_integrations"
ADD CONSTRAINT "mobile_debt_integrations_credential_updated_by_id_fkey"
FOREIGN KEY ("credential_updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mobile_debt_lookup_events"
ADD CONSTRAINT "mobile_debt_lookup_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mobile_debt_lookup_events"
ADD CONSTRAINT "mobile_debt_lookup_events_mobile_debt_integration_id_fkey"
FOREIGN KEY ("mobile_debt_integration_id") REFERENCES "mobile_debt_integrations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mobile_debt_lookup_events"
ADD CONSTRAINT "mobile_debt_lookup_events_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
