-- SPEC-064: la cuota pasa a ser del mes completo. Valor aparte porque
-- Postgres no deja usar un valor de enum en la misma transacción que lo crea.
ALTER TYPE "PerformanceQuotaWindow" ADD VALUE IF NOT EXISTS 'MONTH';
