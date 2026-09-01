-- SPEC-030 BR-084: un caso que cumple 7 días sin verificación completa de
-- portabilidad se descarta solo. No es pérdida ni descarte por estar activo:
-- nadie confirmó a tiempo que fuera oportunidad.
ALTER TYPE "RecoveryDiscardReason" ADD VALUE 'VENCIDO';
