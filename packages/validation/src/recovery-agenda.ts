/**
 * Agenda del asesor de campaña — SPEC-048 BR-004, BR-005, BR-011, BR-016.
 *
 * Bandeja, ficha y agenda pasan cada caso por este selector y obtienen **un
 * solo elemento** (o ninguno): qué toca, de dónde sale y si ocupa una hora.
 * Solo la cita acordada con el cliente ocupa una hora; las tareas
 * automáticas llevan un centinela del sistema («ahora», «mañana a las
 * 09:00») que no es un acuerdo y no se dibuja como tal (AG-R02, AG-R10).
 */

export type RecoveryAgendaItemKind =
  | "VERIFICACION"
  | "CITA_ACORDADA"
  | "COMPLETAR_VENTA"
  | "CERRAR"
  | "RESOLVER_DATOS"
  | "SEGUIMIENTO"
  | "HABILITACION"
  | "REINTENTO"
  | "SIN_FECHA";

export type RecoveryAgendaOrigin =
  | "acuerdo"
  | "cadencia"
  | "pausa"
  | "habilitacion"
  | "comercial"
  | "verificacion"
  | "devuelto"
  | "dato_pendiente"
  | "impedimento"
  | "seguimiento"
  | "sin_gestion";

export const recoveryAgendaKindLabels: Record<RecoveryAgendaItemKind, string> =
  {
    VERIFICACION: "Pendiente de verificación",
    CITA_ACORDADA: "Llamada acordada",
    COMPLETAR_VENTA: "Completar venta",
    CERRAR: "Cerrar como rechazo definitivo",
    RESOLVER_DATOS: "Resolver: datos inválidos",
    SEGUIMIENTO: "Seguimiento pendiente",
    HABILITACION: "Ya puede portar",
    REINTENTO: "Volver a intentar",
    SIN_FECHA: "Sin gestión aún",
  };

export const recoveryAgendaOriginLabels: Record<RecoveryAgendaOrigin, string> =
  {
    acuerdo: "acordada con el cliente",
    cadencia: "cadencia del día",
    pausa: "pausa por rechazo",
    habilitacion: "habilitación de portabilidad",
    comercial: "gestión comercial",
    verificacion: "verificación",
    devuelto: "devuelto de verificación: sigue portable",
    dato_pendiente: "falta la fecha de portación",
    impedimento: "seguimiento del impedimento",
    seguimiento: "seguimiento acordado",
    sin_gestion: "nadie lo ha llamado",
  };

export interface RecoveryAgendaCaseLike {
  status: string;
  nextActionAt: Date | null;
  /** Fecha de habilitación consolidada en el caso (BR-006). */
  portabilityEligibleAt: Date | null;
  /** Resultado y momento del intento más reciente; nulos sin intentos. */
  lastResult: string | null;
  lastAttemptAt: Date | null;
  /** Hora de la cita PENDING del caso, si la hay. */
  pendingCommitmentAt: Date | null;
  /** SPEC-049 BR-008: última devolución de verificación (`CASE_REOPENED`). */
  returnedFromVerificationAt?: Date | null;
  /** SPEC-049 BR-002: teléfonos válidos que quedan (contacto + líneas). */
  validPhoneCount?: number | null;
  /** Fecha de seguimiento que dio el asesor en el último intento. */
  lastFollowUpAt?: Date | null;
}

export interface RecoveryAgendaItem {
  kind: RecoveryAgendaItemKind;
  origin: RecoveryAgendaOrigin;
  /** Cuándo toca; nulo para verificación y para «sin fecha». */
  at: Date | null;
  /** Solo la cita acordada ocupa una hora en la cuadrícula. */
  timed: boolean;
  /** `at` ya pasó. */
  overdue: boolean;
}

const openStatuses = new Set([
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "SCHEDULED",
  "WAITING",
]);

const pausingResults = new Set(["RECHAZA", "CANCELADO"]);

/**
 * De dónde sale el reintento (SPEC-049 BR-008, BR-011): una devolución de
 * verificación posterior al último intento manda sobre todo; después la
 * pausa, el dato pendiente, el impedimento y el seguimiento acordado; y si
 * no, la cadencia del día.
 */
function reintentoOrigin(recoveryCase: RecoveryAgendaCaseLike): RecoveryAgendaOrigin {
  const returned = recoveryCase.returnedFromVerificationAt ?? null;
  if (
    returned &&
    (recoveryCase.lastAttemptAt === null ||
      returned.getTime() > recoveryCase.lastAttemptAt.getTime())
  ) {
    return "devuelto";
  }
  const last = recoveryCase.lastResult;
  if (last && pausingResults.has(last)) return "pausa";
  if (last === "NO_CUMPLE_30D" && recoveryCase.portabilityEligibleAt === null) {
    return "dato_pendiente";
  }
  if (last === "IMPEDIMENTO") return "impedimento";
  if (last === "INTERESADO" && recoveryCase.lastFollowUpAt) return "seguimiento";

  return "cadencia";
}

function item(
  kind: RecoveryAgendaItemKind,
  origin: RecoveryAgendaOrigin,
  at: Date | null,
  timed: boolean,
  now: Date,
): RecoveryAgendaItem {
  return {
    kind,
    origin,
    at,
    timed,
    overdue: at !== null && at.getTime() < now.getTime(),
  };
}

/**
 * Un caso, un elemento. El orden de comprobación es el de BR-004: la
 * verificación suspende todo; la cita acordada manda sobre cualquier
 * centinela; después las tareas comerciales, la habilitación y la cadencia.
 */
export function selectRecoveryAgendaItem(
  recoveryCase: RecoveryAgendaCaseLike,
  now: Date,
): RecoveryAgendaItem | null {
  if (!openStatuses.has(recoveryCase.status)) return null;

  if (recoveryCase.status === "WAITING") {
    return item("VERIFICACION", "verificacion", null, false, now);
  }

  if (recoveryCase.pendingCommitmentAt) {
    return item(
      "CITA_ACORDADA",
      "acuerdo",
      recoveryCase.pendingCommitmentAt,
      true,
      now,
    );
  }

  if (recoveryCase.lastResult === "VENDIDO") {
    return item(
      "COMPLETAR_VENTA",
      "comercial",
      recoveryCase.nextActionAt,
      false,
      now,
    );
  }

  // SPEC-049 BR-001: pidió que no lo llamen; el cierre es un clic explícito.
  if (recoveryCase.lastResult === "NO_CONTACTAR") {
    return item("CERRAR", "comercial", recoveryCase.nextActionAt, false, now);
  }

  // SPEC-049 BR-002: sin teléfonos válidos no hay a quién llamar.
  if (
    recoveryCase.lastResult === "DATOS_INVALIDOS" ||
    recoveryCase.validPhoneCount === 0
  ) {
    return item(
      "RESOLVER_DATOS",
      "comercial",
      recoveryCase.nextActionAt,
      false,
      now,
    );
  }

  if (
    recoveryCase.lastResult === "INTERESADO_CON_PEDIDO" ||
    recoveryCase.lastResult === "TIENE_PEDIDO"
  ) {
    return item(
      "SEGUIMIENTO",
      "comercial",
      recoveryCase.nextActionAt,
      false,
      now,
    );
  }

  // Una habilitación cuenta mientras nadie haya llamado después de ella:
  // el intento posterior ya la trabajó y la cadencia toma el relevo.
  if (
    recoveryCase.portabilityEligibleAt &&
    (recoveryCase.lastAttemptAt === null ||
      recoveryCase.lastAttemptAt.getTime() <
        recoveryCase.portabilityEligibleAt.getTime())
  ) {
    return item(
      "HABILITACION",
      "habilitacion",
      recoveryCase.portabilityEligibleAt,
      false,
      now,
    );
  }

  if (recoveryCase.nextActionAt) {
    return item(
      "REINTENTO",
      reintentoOrigin(recoveryCase),
      recoveryCase.nextActionAt,
      false,
      now,
    );
  }

  return item("SIN_FECHA", "sin_gestion", null, false, now);
}

export type RecoveryCommitmentState =
  | "pendiente"
  | "vencida"
  | "atendida"
  | "reprogramada"
  | "cancelada";

export const recoveryCommitmentStateLabels: Record<
  RecoveryCommitmentState,
  string
> = {
  pendiente: "Pendiente",
  vencida: "Vencida",
  atendida: "Atendida",
  reprogramada: "Reprogramada",
  cancelada: "Cancelada",
};

/**
 * BR-005: una cita pendiente cuya hora pasó está **vencida** y conserva su
 * fecha; no cambia de estado hasta que alguien registre un resultado, la
 * reprograme o la cancele.
 */
export function describeRecoveryCommitmentState(
  status: string,
  scheduledAt: Date,
  now: Date,
): RecoveryCommitmentState {
  switch (status) {
    case "DONE":
      return "atendida";
    case "RESCHEDULED":
      return "reprogramada";
    case "CANCELLED":
      return "cancelada";
    default:
      return scheduledAt.getTime() < now.getTime() ? "vencida" : "pendiente";
  }
}

export interface RecoveryAgendaDaySummary {
  /** Llamadas acordadas (ocupan hora). */
  commitments: number;
  /** Tareas sin hora. */
  tasks: number;
  /** Cuántas de las llamadas ya vencieron. */
  overdue: number;
}

/**
 * BR-015 / CAM-F11: cantidades por día, citas y tareas por separado, desde
 * los mismos elementos que dibujan Día y Semana: por construcción no pueden
 * decir cosas distintas.
 */
export function summarizeRecoveryAgendaByDay(
  entries: ReadonlyArray<{
    dayIso: string | null;
    timed: boolean;
    overdue?: boolean;
  }>,
): Record<string, RecoveryAgendaDaySummary> {
  const summary: Record<string, RecoveryAgendaDaySummary> = {};

  for (const entry of entries) {
    if (!entry.dayIso) continue;
    const day = (summary[entry.dayIso] ??= {
      commitments: 0,
      tasks: 0,
      overdue: 0,
    });
    if (entry.timed) {
      day.commitments += 1;
      if (entry.overdue) day.overdue += 1;
    } else {
      day.tasks += 1;
    }
  }

  return summary;
}

/** BR-016: dos citas «a la misma hora» si caen en el mismo tramo de 15 minutos. */
export const recoveryAgendaSlotMinutes = 15;

export function shareRecoveryAgendaSlot(left: Date, right: Date): boolean {
  const slotMs = recoveryAgendaSlotMinutes * 60 * 1000;

  return (
    Math.floor(left.getTime() / slotMs) === Math.floor(right.getTime() / slotMs)
  );
}
