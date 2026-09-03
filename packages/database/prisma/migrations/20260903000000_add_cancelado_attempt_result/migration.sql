-- El cliente cancela la gestión. Pausa la cadencia igual que RECHAZA y no
-- cierra el caso: un resultado mal registrado se corrige sin perder el
-- historial del intento.
ALTER TYPE "RecoveryAttemptResult" ADD VALUE 'CANCELADO';
