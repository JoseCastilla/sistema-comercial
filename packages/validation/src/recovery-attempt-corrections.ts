/**
 * Rectificación de intentos — SPEC-049 BR-017, BR-018.
 *
 * Un intento registrado es inmutable (SPEC-030 BR-035). La rectificación es
 * un registro aparte que declara el resultado efectivo; aquí se decide qué
 * resultado «vale» para la cadencia, las puertas de pérdida y los
 * contadores (siempre con la fecha del original), quién puede rectificar y
 * hasta cuándo, y qué resultados admite una rectificación.
 */
import { getLimaIsoDate } from "./order-period.js";

export interface CorrectableAttemptLike {
  result: string;
  reason?: string | null;
  correction?: {
    effectiveResult: string;
    effectiveReason?: string | null;
  } | null;
}

/** El resultado que vale: el rectificado si lo hay, el original si no. */
export function effectiveAttemptResult(attempt: CorrectableAttemptLike): string {
  return attempt.correction?.effectiveResult ?? attempt.result;
}

export function effectiveAttemptReason(
  attempt: CorrectableAttemptLike,
): string | null {
  return attempt.correction
    ? (attempt.correction.effectiveReason ?? null)
    : (attempt.reason ?? null);
}

/**
 * La misma lista de intentos, con el resultado efectivo en `result` y el
 * original en `originalResult`. La fecha no cambia: la rectificación no es
 * un contacto nuevo.
 */
export function effectiveAttempts<T extends CorrectableAttemptLike>(
  attempts: ReadonlyArray<T>,
): Array<T & { result: string; originalResult: string; corrected: boolean }> {
  return attempts.map((attempt) => ({
    ...attempt,
    result: effectiveAttemptResult(attempt),
    originalResult: attempt.result,
    corrected: attempt.correction != null,
  }));
}

/**
 * Resultados que admite una rectificación: los que no necesitan un dato
 * extra (fecha y hora acordadas, línea y fecha de portación, fecha del
 * impedimento). Para esos, lo correcto es registrar un intento nuevo.
 */
export const correctableResults: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "SIN_RESPUESTA", label: "No contesta" },
  { value: "INTERESADO", label: "Interesado" },
  { value: "RECHAZA", label: "No interesado" },
  { value: "VENDIDO", label: "Aceptó la oferta" },
  { value: "INTERESADO_CON_PEDIDO", label: "Interesado · tiene un pedido en curso" },
  { value: "TIENE_PEDIDO", label: "Tiene un pedido en curso · interés por confirmar" },
  { value: "NUMERO_ERRADO", label: "Número errado" },
  { value: "YA_ACTIVO", label: "Ya está activo en Movistar" },
  { value: "NO_CONTACTAR", label: "Pide que no lo llamen" },
  { value: "DATOS_INVALIDOS", label: "Datos inválidos" },
];

export const correctionWindowDaysForSupervisor = 7;

export interface CorrectionActor {
  role: string;
  userId: string;
  /** El actor supervisa el equipo del caso (o el caso está a su cargo). */
  supervisesCase: boolean;
}

export interface CorrectionTarget {
  actorUserId: string;
  createdAt: Date;
  alreadyCorrected: boolean;
  caseResolved: boolean;
}

/**
 * BR-018: el autor el mismo día de Lima; el supervisor de su equipo dentro
 * de siete días; `ADMIN` siempre. Un caso resuelto no se rectifica.
 */
export function canCorrectAttempt(
  actor: CorrectionActor,
  target: CorrectionTarget,
  now: Date,
): { allowed: boolean; reason: string | null } {
  if (target.caseResolved) {
    return {
      allowed: false,
      reason: "El caso ya está resuelto; para reabrirlo hay un flujo aparte.",
    };
  }
  if (target.alreadyCorrected) {
    return { allowed: false, reason: "Este intento ya fue rectificado." };
  }
  if (actor.role === "ADMIN") return { allowed: true, reason: null };

  const ageMs = now.getTime() - target.createdAt.getTime();
  const sameLimaDay = getLimaIsoDate(now) === getLimaIsoDate(target.createdAt);

  if (target.actorUserId === actor.userId && sameLimaDay) {
    return { allowed: true, reason: null };
  }
  if (
    actor.role === "SUPERVISOR" &&
    actor.supervisesCase &&
    ageMs <= correctionWindowDaysForSupervisor * 24 * 60 * 60 * 1000
  ) {
    return { allowed: true, reason: null };
  }
  if (target.actorUserId === actor.userId) {
    return {
      allowed: false,
      reason: "Solo puedes rectificar tus intentos el mismo día; pídeselo a tu supervisor.",
    };
  }
  if (actor.role === "SUPERVISOR") {
    return {
      allowed: false,
      reason: actor.supervisesCase
        ? "Pasaron más de siete días; solo administración puede rectificarlo."
        : "El caso no es de tus equipos.",
    };
  }

  return { allowed: false, reason: "No puedes rectificar este intento." };
}
