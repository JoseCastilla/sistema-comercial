/**
 * Puerta interna de recuperación — SPEC-030 BR-061 a BR-073.
 *
 * Reglas puras que deciden cuándo una venta propia entra a recuperación, con
 * qué motivo comercial y con qué prioridad. No tocan base de datos para poder
 * probarse con los casos reales del operador logístico.
 */

export type RecoveryEntryReason =
  | "NO_ENTREGADO"
  | "INCIDENCIA_LOGISTICA"
  | "PROMESA_COMERCIAL_INCORRECTA"
  | "DEUDA"
  | "ANTIGUEDAD_PORTA"
  | "OTRO";

export type RecoveryCasePriority =
  | "CRITICA"
  | "ALTA"
  | "MEDIA"
  | "CONDICIONADA";

export interface InternalRecoveryTrigger {
  status: "OPEN" | "SENT" | "CLOSED" | "CANCELLED" | "UNKNOWN";
  sentSubstatus?:
    | "NO_STATUS"
    | "ASSIGNED"
    | "SCHEDULED"
    | "NOT_DELIVERED"
    | "REJECTED"
    | "DELIVERED"
    | "UNKNOWN"
    | null;
  motivoRechazo?: string | null;
  submotivoRechazo?: string | null;
}

const priorityByReason: Record<RecoveryEntryReason, RecoveryCasePriority> = {
  PROMESA_COMERCIAL_INCORRECTA: "CRITICA",
  NO_ENTREGADO: "ALTA",
  INCIDENCIA_LOGISTICA: "MEDIA",
  DEUDA: "CONDICIONADA",
  ANTIGUEDAD_PORTA: "CONDICIONADA",
  OTRO: "MEDIA",
};

const priorityRank: Record<RecoveryCasePriority, number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  CONDICIONADA: 1,
};

/**
 * BR-061: solo una cancelación o una entrega fallida abren la puerta. Un
 * rechazo del operador llega como `CANCELLED`, porque Máximo cancela la orden
 * automáticamente.
 */
export function shouldOpenInternalRecoveryCase(
  trigger: InternalRecoveryTrigger,
): boolean {
  if (trigger.status === "CANCELLED") return true;
  return trigger.status === "SENT" && trigger.sentSubstatus === "NOT_DELIVERED";
}

/**
 * BR-063: el motivo se propone desde estado × motivo × submotivo. El motivo
 * del operador nunca decide solo: el mismo texto significa cosas distintas
 * según el estado en que llega.
 */
export function resolveInternalRecoveryEntryReason(
  trigger: InternalRecoveryTrigger,
): RecoveryEntryReason {
  const motive = [trigger.motivoRechazo, trigger.submotivoRechazo]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toUpperCase();

  // Error comercial del asesor: el cliente rechazó porque lo ofrecido no
  // coincidía con el contrato. Nunca vuelve a quien originó la venta.
  if (
    /PROMESA|BENEFICIO|NO CORRESPONDE LO OFRECIDO|INFORMACION DISTINTA|MALA VENTA|NO DESEA EL PLAN/.test(
      motive,
    )
  ) {
    return "PROMESA_COMERCIAL_INCORRECTA";
  }

  // Solo la deuda vencida impide portar; se agenda hasta que se regularice.
  if (/DEUDA EXIGIBLE|DEUDA/.test(motive)) return "DEUDA";

  // La línea ya portó y no cumple los 30 días, o su antigüedad no es
  // verificable por ser línea de planta.
  if (/TIEMPO MINIMO DE PORTA|NO ESTUVO EN SERVICIO|OTRA PORTA EN CURSO/.test(motive)) {
    return "ANTIGUEDAD_PORTA";
  }

  // El estorbo es el lugar o la ventana de entrega, no el cliente.
  if (
    /FUERA DE COBERTURA|ZONA PELIGROSA|DIRECCION NO RECUPERABLE|VISITA EN FECHA NO ACORDADA/.test(
      motive,
    )
  ) {
    return "INCIDENCIA_LOGISTICA";
  }

  // Ausencia o falta de tiempo: la entrega todavía se puede salvar.
  if (/CLIENTE AUSENTE|NO SE ENCONTRABA|FALTA DE TIEMPO|NO CONTESTA/.test(motive)) {
    return "NO_ENTREGADO";
  }

  if (
    trigger.status === "SENT" &&
    trigger.sentSubstatus === "NOT_DELIVERED" &&
    motive === ""
  ) {
    return "NO_ENTREGADO";
  }

  return "OTRO";
}

/** BR-064: la prioridad deriva del motivo, no se elige a mano. */
export function getInternalRecoveryPriority(
  reason: RecoveryEntryReason,
): RecoveryCasePriority {
  return priorityByReason[reason];
}

/** BR-072: al fusionar puertas, el caso adopta la prioridad más alta. */
export function getHighestRecoveryPriority(
  left: RecoveryCasePriority | null,
  right: RecoveryCasePriority | null,
): RecoveryCasePriority | null {
  if (left === null) return right;
  if (right === null) return left;
  return priorityRank[left] >= priorityRank[right] ? left : right;
}

/**
 * BR-065 y BR-067: un caso crítico nace de un error comercial del asesor, así
 * que jamás vuelve a quien originó la venta, ni por asignación ni por cola.
 */
export function canAssignRecoveryCaseToOriginalAgent(
  priority: RecoveryCasePriority,
): boolean {
  return priority !== "CRITICA";
}

/**
 * BR-065: en motivos recuperables el asesor original conserva la primera
 * oportunidad; en los críticos el caso nace sin responsable, a la espera de
 * que supervisión lo reasigne.
 */
export function resolveInitialRecoveryAssignee(input: {
  priority: RecoveryCasePriority;
  originalAgentUserId: string | null;
}): string | null {
  if (!canAssignRecoveryCaseToOriginalAgent(input.priority)) return null;
  return input.originalAgentUserId;
}

/** BR-066: primer contacto a más tardar dos horas después de la novedad. */
export const internalRecoveryFirstContactMinutes = 120;

export function getInternalRecoveryFirstActionAt(noveltyAt: Date): Date {
  return new Date(
    noveltyAt.getTime() + internalRecoveryFirstContactMinutes * 60 * 1000,
  );
}

/**
 * BR-066: los toques de la cadencia interna son Día 0, 1, 3 y 7, contados
 * desde la asignación (24, 72 y 168 horas). Devuelve el siguiente toque
 * posterior a `now`, o `null` cuando la cadencia se agotó y el caso entra en
 * resolución obligatoria (BR-058).
 */
export const internalRecoveryCadenceDays = [1, 3, 7] as const;

export function getInternalRecoveryNextTouchAt(
  claimedAt: Date,
  now: Date,
): Date | null {
  for (const day of internalRecoveryCadenceDays) {
    const candidate = new Date(
      claimedAt.getTime() + day * 24 * 60 * 60 * 1000,
    );
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
}

/**
 * BR-033: un rechazo pausa el caso uno o dos días, a elección del asesor, y
 * el caso reaparece solo al vencer la pausa.
 */
export function getInternalRecoveryPauseUntil(
  now: Date,
  pauseDays: 1 | 2,
): Date {
  return new Date(now.getTime() + pauseDays * 24 * 60 * 60 * 1000);
}

export type RecoveryLossReasonOption =
  | "YA_MIGRO_OTRA_AGENCIA"
  | "RECHAZO_DEFINITIVO"
  | "INUBICABLE"
  | "DEUDA"
  | "DATOS_INVALIDOS"
  | "NO_PORTABLE"
  | "OTRO";

export interface RecoveryAttemptSummary {
  result:
    | "SIN_RESPUESTA"
    | "INTERESADO"
    | "INTERESADO_CON_PEDIDO"
    | "RECHAZA"
    | "AGENDA"
    | "NUMERO_ERRADO"
    | "NO_CUMPLE_30D"
    | "YA_ACTIVO"
    | "DATOS_INVALIDOS"
    | "VENDIDO"
    | "CANCELADO";
  createdAt: Date;
}

export interface LossReasonGate {
  enabled: boolean;
  missing: string | null;
}

const limaDayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const contactedResults = new Set([
  "INTERESADO",
  "INTERESADO_CON_PEDIDO",
  "RECHAZA",
  "AGENDA",
  "VENDIDO",
]);

/**
 * BR-057: cada motivo de pérdida se habilita solo cuando su criterio se
 * cumple; mientras no, la interfaz explica qué falta. `RECHAZO_DEFINITIVO`
 * admite además la vía rápida de solicitud expresa del cliente, que exige al
 * menos un intento registrado y se valida aparte.
 */
export function evaluateInternalLossReasonGates(
  attempts: readonly RecoveryAttemptSummary[],
): Record<RecoveryLossReasonOption, LossReasonGate> {
  const noResponseDays = new Map<string, number>();
  const rejectionDays = new Set<string>();
  let contacted = 0;
  let wrongNumber = 0;
  let notPortable = 0;

  for (const attempt of attempts) {
    const day = limaDayKeyFormatter.format(attempt.createdAt);
    if (attempt.result === "SIN_RESPUESTA") {
      noResponseDays.set(day, (noResponseDays.get(day) ?? 0) + 1);
    }
    if (attempt.result === "RECHAZA") rejectionDays.add(day);
    if (contactedResults.has(attempt.result)) contacted += 1;
    if (attempt.result === "NUMERO_ERRADO") wrongNumber += 1;
    if (attempt.result === "NO_CUMPLE_30D") notPortable += 1;
  }

  const exhaustedDays = [...noResponseDays.values()].filter(
    (count) => count >= 3,
  ).length;

  return {
    INUBICABLE: {
      enabled: exhaustedDays >= 3,
      missing:
        exhaustedDays >= 3
          ? null
          : `Necesitas 3 días distintos con 3 o más intentos sin respuesta cada uno; llevas ${exhaustedDays}.`,
    },
    RECHAZO_DEFINITIVO: {
      enabled: rejectionDays.size >= 2,
      missing:
        rejectionDays.size >= 2
          ? null
          : `Necesitas dos rechazos en días distintos (llevas ${rejectionDays.size}) o la solicitud expresa del cliente de no ser contactado.`,
    },
    DEUDA: {
      enabled: contacted >= 1,
      missing:
        contacted >= 1
          ? null
          : "Antes registra al menos un contacto efectivo que confirme la deuda sin fecha de solución.",
    },
    DATOS_INVALIDOS: {
      enabled: wrongNumber >= 1,
      missing:
        wrongNumber >= 1
          ? null
          : "Antes registra al menos un intento marcado como número errado.",
    },
    NO_PORTABLE: {
      enabled: notPortable >= 1,
      missing:
        notPortable >= 1
          ? null
          : "Antes registra un intento donde el cliente no cumpla los 30 días para portar y no se conozca desde cuándo podría.",
    },
    YA_MIGRO_OTRA_AGENCIA: {
      enabled: contacted >= 1,
      missing:
        contacted >= 1
          ? null
          : "Necesitas que el cliente lo haya confirmado en un contacto; si lo dice el reporte de portabilidad, el cierre es automático.",
    },
    OTRO: { enabled: true, missing: null },
  };
}
