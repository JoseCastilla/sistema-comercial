-- SPEC-043 PE-05: renombrar, retirar una supervisión y reactivar un equipo
-- dejan rastro con su propio nombre en la auditoría de equipos.
ALTER TYPE "CommercialTeamAuditAction" ADD VALUE 'MEMBER_REMOVED';
ALTER TYPE "CommercialTeamAuditAction" ADD VALUE 'TEAM_RENAMED';
ALTER TYPE "CommercialTeamAuditAction" ADD VALUE 'TEAM_REACTIVATED';
