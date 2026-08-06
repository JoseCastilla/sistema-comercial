-- La migración inicial y la migración de endurecimiento crearon el mismo
-- índice parcial con nombres distintos. Conservamos el nombre definitivo.
DROP INDEX IF EXISTS "commercial_teams_org_active_name_key";
