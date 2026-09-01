/**
 * Distribución y cadencia del carril de campañas (base nacional) —
 * SPEC-030 BR-028, BR-028c, BR-031 a BR-034, BR-058, BR-077 y BR-078.
 *
 * Reglas puras, sin base de datos, para poder probar el reparto equitativo y
 * los relojes de la campaña con casos sintéticos.
 */

const limaOffsetMs = 5 * 60 * 60 * 1000;

const limaDayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface EquitableAdvisorInput {
  userId: string;
  /** Casos de base abiertos que ya carga; el residuo va a quien tiene menos. */
  openCases: number;
}

export interface EquitableAssignment {
  caseId: string;
  userId: string;
}

/**
 * BR-028c: reparto en ronda respetando el orden de prioridad de la cola, con
 * diferencia máxima de un caso entre asesores. Los asesores se ordenan por
 * carga abierta ascendente, de modo que la ronda incompleta final — el
 * residuo — caiga en quienes tienen menos casos. Al repartir en ronda, cada
 * asesor recibe una mezcla equivalente de casos urgentes y normales.
 */
export function distributeCasesEquitably(input: {
  orderedCaseIds: readonly string[];
  advisors: readonly EquitableAdvisorInput[];
}): EquitableAssignment[] {
  if (input.advisors.length === 0) return [];

  const rotation = [...input.advisors].sort(
    (left, right) => left.openCases - right.openCases,
  );

  return input.orderedCaseIds.map((caseId, index) => {
    const advisor = rotation[index % rotation.length];
    // rotation nunca está vacío aquí: el guard de arriba lo garantiza.
    return { caseId, userId: (advisor as EquitableAdvisorInput).userId };
  });
}

/** BR-078: la toma del pool es por bloque de hasta 10 casos. */
export const baseRecoveryPoolTakeLimit = 10;

/** BR-032: un caso sin respuesta exige un mínimo de tres intentos en el día. */
export const baseRecoveryMinimumDailyAttempts = 3;

/** BR-058: al séptimo día de gestión el caso entra en resolución obligatoria. */
export const baseRecoveryResolutionDays = 7;

/** BR-077: dos días asignado sin ningún intento devuelven el caso al pool. */
export const baseRecoveryPoolReturnDays = 2;

/**
 * BR-084: un caso sin verificación completa de portabilidad caduca a los
 * siete días de su fecha de registro. La experiencia operativa manda: de la
 * base diaria quedan 400–500 registros llamables, y validar los 15 000
 * acumulados de un mes es inviable — el embudo debe drenar solo. Siete días
 * cubren la ventana móvil de tres días de la base más margen de operación.
 */
export const recoveryConsultationMaxAgeDays = 7;

export function isRecoveryConsultationExpired(
  firstRegisteredAt: Date,
  now: Date,
): boolean {
  return (
    now.getTime() - firstRegisteredAt.getTime() >=
    recoveryConsultationMaxAgeDays * 24 * 60 * 60 * 1000
  );
}

/** Cuenta cuántos momentos caen en el mismo día calendario de Lima que `reference`. */
export function countOnSameLimaDay(
  moments: readonly Date[],
  reference: Date,
): number {
  const referenceKey = limaDayKeyFormatter.format(reference);
  return moments.filter(
    (moment) => limaDayKeyFormatter.format(moment) === referenceKey,
  ).length;
}

/** Las 9:00 de Lima del día siguiente al de `now` (Perú no tiene horario de verano). */
function getNextLimaMorning(now: Date): Date {
  const lima = new Date(now.getTime() - limaOffsetMs);
  const nextMorningUtc = Date.UTC(
    lima.getUTCFullYear(),
    lima.getUTCMonth(),
    lima.getUTCDate() + 1,
    9,
    0,
    0,
  );
  return new Date(nextMorningUtc + limaOffsetMs);
}

/**
 * BR-031/BR-032: la cadencia de campaña es diaria — mientras el caso no
 * complete sus tres intentos del día sigue vigente hoy; con el mínimo
 * cumplido, reaparece a la mañana siguiente de Lima. La agenda (BR-034) y la
 * pausa por rechazo (BR-033) se resuelven aparte y suspenden esta cadencia.
 */
export function getBaseRecoveryNextTouchAt(
  attemptsToday: number,
  now: Date,
): Date {
  if (attemptsToday < baseRecoveryMinimumDailyAttempts) return now;
  return getNextLimaMorning(now);
}

/** BR-058: fecha en la que el caso entra en resolución obligatoria. */
export function getBaseRecoveryResolutionDueAt(claimedAt: Date): Date {
  return new Date(
    claimedAt.getTime() + baseRecoveryResolutionDays * 24 * 60 * 60 * 1000,
  );
}

export function isBaseRecoveryResolutionDue(
  claimedAt: Date,
  now: Date,
): boolean {
  return now.getTime() >= getBaseRecoveryResolutionDueAt(claimedAt).getTime();
}

/**
 * BR-077: un caso de base asignado que no recibió ningún intento durante dos
 * días vuelve solo al pool de su equipo. Un solo intento desde la asignación
 * lo retiene con su responsable: la redistribución de casos ya gestionados es
 * decisión humana (BR-030).
 */
export function shouldReturnBaseCaseToPool(input: {
  claimedAt: Date;
  lastAttemptAt: Date | null;
  now: Date;
}): boolean {
  if (
    input.lastAttemptAt !== null &&
    input.lastAttemptAt.getTime() >= input.claimedAt.getTime()
  ) {
    return false;
  }
  return (
    input.now.getTime() - input.claimedAt.getTime() >=
    baseRecoveryPoolReturnDays * 24 * 60 * 60 * 1000
  );
}
