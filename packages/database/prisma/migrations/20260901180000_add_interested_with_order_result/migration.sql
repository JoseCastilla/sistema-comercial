-- SPEC-030 BR-086: el cliente quiere, pero otra agencia ya le envió un
-- pedido. Es el lead más caliente de la base y merece su propio resultado
-- tipificado para agendarse solo y medirse.
ALTER TYPE "RecoveryAttemptResult" ADD VALUE 'INTERESADO_CON_PEDIDO';
