-- SPEC-048 fase 0: las citas acordadas se guardaban cinco horas antes porque
-- el servidor interpretaba la hora en su propia zona (UTC). La corrección de
-- los datos ya guardados la ejecuta un script con evidencia
-- (docs/operacion/consultas/corregir-horas-agendadas-2026-09-08.sql) y deja
-- un evento por caso con la hora anterior y la nueva. Este es su tipo.
ALTER TYPE "RecoveryCaseEventType" ADD VALUE 'NEXT_ACTION_CORRECTED';
