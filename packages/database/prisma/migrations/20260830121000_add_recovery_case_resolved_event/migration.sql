-- SPEC-030 BR-041: la resolución de un caso (RECOVERED o LOST) deja su
-- propio rastro; el estado final viaja en new_status.
ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'CASE_RESOLVED';
