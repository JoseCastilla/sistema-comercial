-- SPEC-037 (contracción, SPEC-015 BR-004/BR-005): `match_status` quedó
-- ignorada por Prisma desde el endurecimiento del 09/08/2026 y ningún código
-- la lee ni la escribe; su tipo `DitoMatchStatus` es una copia de
-- `DitoCommercialLinkStatus`, que es el que se usa. Se retiran con una
-- migración nueva; las aplicadas no se reescriben (SPEC-037 BR-002).
ALTER TABLE "dito_orders" DROP COLUMN IF EXISTS "match_status";

DROP TYPE IF EXISTS "DitoMatchStatus";
