-- SPEC-030 BR-073: un caso interno cuya entrega se concretó después no es una
-- pérdida ni un descarte por portabilidad; necesita su propio motivo.
ALTER TYPE "RecoveryDiscardReason" ADD VALUE 'ENTREGA_CONCRETADA';
