-- SPEC-046 BR-005 (y SPEC-037 BR-002): la consulta de deuda móvil se
-- revirtió el 30/08/2026 (commit fccbf13) pero sus migraciones ya estaban
-- aplicadas, así que quedaron dos tablas —una con credenciales cifradas de
-- operadores y otra con teléfonos consultados— sin modelo, sin código y sin
-- nadie que las vigile. No son evidencia de negocio: la función nunca llegó
-- a usarse en producción. Se retiran con una migración nueva; la aplicada
-- no se reescribe.
DROP TABLE IF EXISTS "mobile_debt_lookup_events";
DROP TABLE IF EXISTS "mobile_debt_integrations";

DROP TYPE IF EXISTS "MobileDebtLookupStatus";
DROP TYPE IF EXISTS "MobileDebtOperator";
DROP TYPE IF EXISTS "MobileDebtCredentialStatus";
