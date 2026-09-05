-- SPEC-042 BR-013: cada baja, reingreso y promoción de una persona queda
-- escrita con quién, cuándo y por qué. La auditoría de equipos exige un
-- equipo; la baja es de la persona, así que tiene su propia tabla.

CREATE TYPE "PersonLifecycleAction" AS ENUM (
  'DISABLED',
  'REENTERED',
  'PROMOTED'
);

CREATE TABLE "person_lifecycle_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "action" "PersonLifecycleAction" NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "reason" VARCHAR(200) NOT NULL,
  "previous_values" JSONB,
  "new_values" JSONB,
  "released_summary" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "person_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "person_lifecycle_events_org_created_idx"
ON "person_lifecycle_events"("organization_id", "created_at");

CREATE INDEX "person_lifecycle_events_user_created_idx"
ON "person_lifecycle_events"("user_id", "created_at");

ALTER TABLE "person_lifecycle_events"
ADD CONSTRAINT "person_lifecycle_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "person_lifecycle_events"
ADD CONSTRAINT "person_lifecycle_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "person_lifecycle_events"
ADD CONSTRAINT "person_lifecycle_events_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
