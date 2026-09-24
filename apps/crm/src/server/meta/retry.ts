/** Reintentos del bucle de envío: espera exponencial fija, cinco intentos. Reglas puras. */
export const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

/**
 * Dado el número de intentos ya hechos (incluido el que acaba de fallar),
 * devuelve cuándo volver a intentar, o null si ya no quedan intentos.
 */
export function nextAttemptAt(attemptsDone: number, now: Date): Date | null {
  if (attemptsDone >= MAX_ATTEMPTS) return null;
  const delay = RETRY_DELAYS_MS[Math.max(0, attemptsDone - 1)] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
  return new Date(now.getTime() + delay);
}
