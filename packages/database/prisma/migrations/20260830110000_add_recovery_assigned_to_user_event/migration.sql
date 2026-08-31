-- SPEC-030 Fase 5: la reasignación de un caso a un asesor deja su propio
-- rastro de auditoría (BR-030, BR-051).
ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'ASSIGNED_TO_USER';
