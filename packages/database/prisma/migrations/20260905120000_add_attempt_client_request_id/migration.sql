-- BR-090: clave de idempotencia del intento. La genera el cliente al abrir la
-- gestión en la bandeja; un reenvío del mismo formulario —doble clic, reintento
-- tras un corte de red— trae la misma clave y encuentra el intento ya guardado
-- en vez de crear otro. Nula en los intentos históricos y en los de la ficha.
ALTER TABLE "recovery_case_attempts" ADD COLUMN "client_request_id" UUID;

CREATE UNIQUE INDEX "recovery_case_attempts_case_request_key"
  ON "recovery_case_attempts" ("case_id", "client_request_id");
