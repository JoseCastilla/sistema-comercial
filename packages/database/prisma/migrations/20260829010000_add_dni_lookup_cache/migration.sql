CREATE TYPE "DniLookupSource" AS ENUM ('API', 'CACHE');

CREATE TABLE "dni_person_snapshots" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dni" VARCHAR(8) NOT NULL,
    "verification_digit" VARCHAR(8),
    "given_names" VARCHAR(200),
    "paternal_surname" VARCHAR(120),
    "maternal_surname" VARCHAR(120),
    "sex" VARCHAR(30),
    "birth_date_raw" VARCHAR(30),
    "birth_department" VARCHAR(120),
    "birth_province" VARCHAR(120),
    "birth_district" VARCHAR(120),
    "education_level" VARCHAR(150),
    "marital_status" VARCHAR(80),
    "height_cm" INTEGER,
    "registration_date_raw" VARCHAR(30),
    "issue_date_raw" VARCHAR(30),
    "expiry_date_raw" VARCHAR(30),
    "father_name" VARCHAR(200),
    "mother_name" VARCHAR(200),
    "restriction" VARCHAR(255),
    "address_description" TEXT,
    "address_department" VARCHAR(120),
    "address_province" VARCHAR(120),
    "address_district" VARCHAR(120),
    "reniec_ubigeo" VARCHAR(20),
    "inei_ubigeo" VARCHAR(20),
    "sunat_ubigeo" VARCHAR(20),
    "postal_code" VARCHAR(20),
    "credits_at_fetch" VARCHAR(100),
    "raw_payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "dni_person_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dni_person_snapshots_dni_check" CHECK ("dni" ~ '^[0-9]{8}$'),
    CONSTRAINT "dni_person_snapshots_height_check" CHECK ("height_cm" IS NULL OR "height_cm" BETWEEN 50 AND 250)
);

CREATE TABLE "dni_lookup_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dni_person_snapshot_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "source" "DniLookupSource" NOT NULL,
    "queried_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dni_lookup_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dni_person_snapshots_org_dni_key"
ON "dni_person_snapshots"("organization_id", "dni");

CREATE INDEX "dni_person_snapshots_org_fetched_idx"
ON "dni_person_snapshots"("organization_id", "fetched_at");

CREATE INDEX "dni_lookup_events_org_queried_idx"
ON "dni_lookup_events"("organization_id", "queried_at");

CREATE INDEX "dni_lookup_events_snapshot_queried_idx"
ON "dni_lookup_events"("dni_person_snapshot_id", "queried_at");

CREATE INDEX "dni_lookup_events_actor_queried_idx"
ON "dni_lookup_events"("actor_user_id", "queried_at");

ALTER TABLE "dni_person_snapshots"
ADD CONSTRAINT "dni_person_snapshots_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dni_lookup_events"
ADD CONSTRAINT "dni_lookup_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dni_lookup_events"
ADD CONSTRAINT "dni_lookup_events_dni_person_snapshot_id_fkey"
FOREIGN KEY ("dni_person_snapshot_id") REFERENCES "dni_person_snapshots"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dni_lookup_events"
ADD CONSTRAINT "dni_lookup_events_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
