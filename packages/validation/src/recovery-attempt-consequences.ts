/**
 * Consecuencias de cada resultado de un intento — SPEC-049 BR-001 a BR-006,
 * BR-009 a BR-011.
 *
 * La regla «cada resultado define estado, próxima acción y vista destino»
 * vive aquí como datos y una función pura, y la leen la acción de registro
 * (para aplicar), la bandeja y la ficha (para decir «qué pasará si guardas»)
 * y la agenda de SPEC-048 (para clasificar). Antes estaban repartidas en
 * `if` dentro de la acción y cuatro resultados caían en una rama genérica.
 */
import { limaDayStartFromIso } from "./recovery-agenda-period.js";
import {
  getBaseRecoveryNextTouchAt,
  getNextLimaMorning,
} from "./recovery-base-distribution.js";
import {
  getInternalRecoveryNextTouchAt,
  getInternalRecoveryPauseUntil,
} from "./recovery-internal-gate.js";
import { parseLimaDateTimeLocal } from "./lima-datetime.js";

export type RecoveryAttemptResultValue =
  | "SIN_RESPUESTA"
  | "INTERESADO"
  | "INTERESADO_CON_PEDIDO"
  | "TIENE_PEDIDO"
  | "RECHAZA"
  | "NO_CONTACTAR"
  | "AGENDA"
  | "NUMERO_ERRADO"
  | "NO_CUMPLE_30D"
  | "YA_ACTIVO"
  | "DATOS_INVALIDOS"
  | "VENDIDO"
  | "IMPEDIMENTO"
  | "CANCELADO";

export type RecoveryAttemptReasonValue =
  | "NO_CONTESTA"
  | "APAGADO"
  | "OCUPADO"
  | "HUELLA"
  | "OTRO";

export const recoveryAttemptReasonLabels: Record<
  RecoveryAttemptReasonValue,
  string
> = {
  NO_CONTESTA: "No contesta",
  APAGADO: "Apagado",
  OCUPADO: "Ocupado",
  HUELLA: "Problema de huella",
  OTRO: "Otro",
};

/** Motivos que admite cada resultado que los pide. */
export const noContactReasons: ReadonlyArray<RecoveryAttemptReasonValue> = [
  "NO_CONTESTA",
  "APAGADO",
  "OCUPADO",
];
export const impedimentReasons: ReadonlyArray<RecoveryAttemptReasonValue> = [
  "HUELLA",
  "OTRO",
];

/**
 * Qué se ofrece al tipificar (BR-009, BR-011). Sin preselección; los
 * frecuentes llevan tecla. `CANCELADO` no se ofrece: queda en el historial.
 */
export const recoveryAttemptChoices: ReadonlyArray<{
  value: Exclude<RecoveryAttemptResultValue, "CANCELADO">;
  label: string;
  hotkey?: string;
}> = [
  { value: "SIN_RESPUESTA", label: "No contesta", hotkey: "N" },
  { value: "INTERESADO", label: "Interesado", hotkey: "I" },
  { value: "RECHAZA", label: "No interesado", hotkey: "R" },
  { value: "AGENDA", label: "Agenda una próxima llamada", hotkey: "A" },
  { value: "VENDIDO", label: "Aceptó la oferta" },
  {
    value: "INTERESADO_CON_PEDIDO",
    label: "Interesado · tiene un pedido en curso",
  },
  {
    value: "TIENE_PEDIDO",
    label: "Tiene un pedido en curso · interés por confirmar",
  },
  { value: "NO_CUMPLE_30D", label: "No cumple los 30 días de porta" },
  { value: "NUMERO_ERRADO", label: "Número errado" },
  { value: "YA_ACTIVO", label: "Ya está activo en Movistar" },
  { value: "NO_CONTACTAR", label: "Pide que no lo llamen" },
  { value: "IMPEDIMENTO", label: "Impedimento comercial" },
  { value: "DATOS_INVALIDOS", label: "Datos inválidos" },
];

export type RecoveryAttemptField =
  | "reason"
  | "impedimentReason"
  | "interestedNext"
  | "scheduledAt"
  | "followUpDate"
  | "pauseDays"
  | "observation"
  | "serviceNumber"
  | "reportedDate"
  | "needsSupervisor";

/** Qué campos pide cada resultado (BR-009): solo los necesarios. */
export function recoveryAttemptFields(result: string): {
  required: RecoveryAttemptField[];
  optional: RecoveryAttemptField[];
} {
  switch (result) {
    case "SIN_RESPUESTA":
      return { required: [], optional: ["reason"] };
    case "INTERESADO":
      return { required: [], optional: ["interestedNext"] };
    case "RECHAZA":
      return { required: ["pauseDays"], optional: [] };
    case "NO_CONTACTAR":
      return { required: ["observation"], optional: [] };
    case "AGENDA":
      return { required: ["scheduledAt"], optional: [] };
    case "NO_CUMPLE_30D":
      return { required: ["serviceNumber"], optional: ["reportedDate"] };
    case "NUMERO_ERRADO":
      return { required: [], optional: [] };
    case "IMPEDIMENTO":
      return {
        required: ["impedimentReason", "observation", "followUpDate"],
        optional: ["needsSupervisor"],
      };
    default:
      return { required: [], optional: [] };
  }
}

/** Vista de la bandeja a la que va el caso (SPEC-049 BR-012). */
export type RecoveryWorkView = "ahora" | "agenda" | "completar" | "espera";

export interface RecoveryAttemptConsequenceInput {
  result: string;
  reason?: string | null;
  now: Date;
  /** Intentos del día de Lima contando este. */
  attemptsToday: number;
  /** Desde cuándo lo gestiona su responsable (cadencia interna). */
  managedSince: Date;
  isBaseCase: boolean;
  pauseDays?: 1 | 2;
  /** `AGENDA` o `INTERESADO` con llamada acordada. */
  scheduledAt?: Date | null;
  /** `INTERESADO` con seguimiento o `IMPEDIMENTO`: fecha `AAAA-MM-DD`. */
  followUpDate?: string | null;
  /** `NO_CUMPLE_30D`: fecha de portación informada, `AAAA-MM-DD`. */
  reportedDate?: string | null;
  /** `NO_CUMPLE_30D`: habilitación del caso tras guardar la informada. */
  caseEligibleAt?: Date | null;
  /** `NO_CUMPLE_30D`: alguna otra línea activa ya puede portar. */
  anyWorkableLine?: boolean;
  /** `NUMERO_ERRADO`: teléfonos válidos que quedan tras marcar el usado. */
  validPhonesLeft?: number;
  phoneUsed?: string | null;
  needsSupervisor?: boolean;
}

export interface RecoveryAttemptConsequence {
  status: "IN_PROGRESS" | "SCHEDULED" | "WAITING";
  nextActionAt: Date | null;
  /** Se crea una cita acordada (SPEC-048 BR-003). */
  createsCommitment: boolean;
  /** Las líneas entran a revalidación diaria (BR-085/BR-086). */
  marksLinesForRevalidation: boolean;
  /** El teléfono usado queda marcado como errado (BR-002). */
  invalidatesPhone: boolean;
  workView: RecoveryWorkView;
  /** La consecuencia en una frase, para leerla antes o después de guardar. */
  summary: string;
}

const limaShort = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmt(date: Date): string {
  return limaShort.format(date);
}

const dayMs = 24 * 60 * 60 * 1000;
export const portabilityWaitDays = 30;

/** Las 09:00 de Lima del día `AAAA-MM-DD`; nulo si la fecha no vale. */
export function limaMorningFromIso(date: string): Date | null {
  return limaDayStartFromIso(date)
    ? parseLimaDateTimeLocal(`${date.trim()}T09:00`)
    : null;
}

/** BR-037: treinta días desde la portación informada. */
export function eligibleFromReportedDate(date: string): Date | null {
  const start = limaDayStartFromIso(date);

  return start ? new Date(start.getTime() + portabilityWaitDays * dayMs) : null;
}

function cadence(input: RecoveryAttemptConsequenceInput): Date {
  return input.isBaseCase
    ? getBaseRecoveryNextTouchAt(input.attemptsToday, input.now)
    : (getInternalRecoveryNextTouchAt(input.managedSince, input.now) ??
        input.now);
}

function cadenceSummary(input: RecoveryAttemptConsequenceInput, at: Date) {
  if (input.isBaseCase && input.attemptsToday < 3) {
    return `Llevas ${input.attemptsToday} de 3 intentos exigidos hoy; sigue en tu cola.`;
  }

  return at.getTime() <= input.now.getTime()
    ? "Sigue en tu cola."
    : `Vuelve a tu cola el ${fmt(at)}.`;
}

/**
 * BR-001: un resultado, una consecuencia. Cada rama declara estado,
 * próxima acción, efectos laterales y vista destino; ninguna cae en una
 * rama genérica.
 */
export function resolveRecoveryAttemptConsequence(
  input: RecoveryAttemptConsequenceInput,
): RecoveryAttemptConsequence {
  const base: Omit<RecoveryAttemptConsequence, "summary" | "workView"> = {
    status: "IN_PROGRESS",
    nextActionAt: null,
    createsCommitment: false,
    marksLinesForRevalidation: false,
    invalidatesPhone: false,
  };

  switch (input.result) {
    case "AGENDA": {
      const at = input.scheduledAt ?? input.now;
      return {
        ...base,
        status: "SCHEDULED",
        nextActionAt: at,
        createsCommitment: true,
        workView: "agenda",
        summary: `Queda agendado para el ${fmt(at)}; hasta entonces no exige gestión.`,
      };
    }
    case "INTERESADO": {
      if (input.scheduledAt) {
        return {
          ...base,
          status: "SCHEDULED",
          nextActionAt: input.scheduledAt,
          createsCommitment: true,
          workView: "agenda",
          summary: `Interesado: llamada acordada para el ${fmt(input.scheduledAt)}.`,
        };
      }
      const followUp = input.followUpDate
        ? limaMorningFromIso(input.followUpDate)
        : null;
      if (followUp) {
        return {
          ...base,
          nextActionAt: followUp,
          workView: followUp.getTime() <= input.now.getTime() ? "ahora" : "espera",
          summary: `Interesado: seguimiento el ${fmt(followUp)}.`,
        };
      }
      const at = cadence(input);
      return {
        ...base,
        nextActionAt: at,
        workView: "ahora",
        summary: `Interesado sin fecha: sigue en tu cola de hoy.`,
      };
    }
    case "RECHAZA":
    case "CANCELADO": {
      const until = getInternalRecoveryPauseUntil(input.now, input.pauseDays ?? 1);
      return {
        ...base,
        nextActionAt: until,
        workView: "espera",
        summary: `Queda pausado hasta el ${fmt(until)}.`,
      };
    }
    case "NO_CONTACTAR":
      return {
        ...base,
        nextActionAt: input.now,
        workView: "completar",
        summary:
          "No se vuelve a llamar. Pasa a «Por completar» para cerrarlo como rechazo definitivo.",
      };
    case "VENDIDO":
      return {
        ...base,
        nextActionAt: input.now,
        workView: "completar",
        summary:
          "Pasa a «Por completar»: vincula la orden nueva desde la ficha para resolverlo como recuperado.",
      };
    case "DATOS_INVALIDOS":
      return {
        ...base,
        nextActionAt: input.now,
        workView: "completar",
        summary: "Pasa a «Por completar» para resolverlo como datos inválidos.",
      };
    case "YA_ACTIVO":
      return {
        ...base,
        status: "WAITING",
        nextActionAt: null,
        marksLinesForRevalidation: true,
        workView: "espera",
        summary:
          "Pasa a verificación: el caso no se cierra hasta que el reporte o tu supervisor lo confirmen.",
      };
    case "INTERESADO_CON_PEDIDO": {
      const morning = getNextLimaMorning(input.now);
      return {
        ...base,
        status: "SCHEDULED",
        nextActionAt: morning,
        marksLinesForRevalidation: true,
        workView: "ahora",
        summary:
          "Agendado para mañana al frente de tu cola: vuelve a llamarlo para ver si el pedido anterior cayó; el cruce lo vigila en paralelo.",
      };
    }
    case "TIENE_PEDIDO": {
      const morning = getNextLimaMorning(input.now);
      return {
        ...base,
        status: "SCHEDULED",
        nextActionAt: morning,
        marksLinesForRevalidation: true,
        workView: "espera",
        summary:
          "Vuelve mañana a las 09:00 para confirmar si le interesa; el cruce vigila el pedido ajeno.",
      };
    }
    case "NUMERO_ERRADO": {
      const left = input.validPhonesLeft ?? 0;
      const phone = input.phoneUsed ? ` ${input.phoneUsed}` : "";
      if (left === 0) {
        return {
          ...base,
          nextActionAt: input.now,
          invalidatesPhone: true,
          workView: "completar",
          summary: `El número${phone} queda marcado como errado. No quedan teléfonos válidos: pasa a «Por completar» para resolverlo.`,
        };
      }
      const at = cadence(input);
      return {
        ...base,
        nextActionAt: at,
        invalidatesPhone: true,
        workView: "ahora",
        summary: `El número${phone} queda marcado como errado. Sigue en tu cola con el siguiente teléfono.`,
      };
    }
    case "NO_CUMPLE_30D": {
      const eligible = input.caseEligibleAt ?? null;
      if (input.reportedDate && eligible && !input.anyWorkableLine) {
        if (eligible.getTime() > input.now.getTime()) {
          return {
            ...base,
            status: "SCHEDULED",
            nextActionAt: eligible,
            workView: "espera",
            summary: `Podrá portar desde el ${fmt(eligible)}; hasta entonces queda en espera.`,
          };
        }
      }
      const at = cadence(input);
      if (input.reportedDate && eligible) {
        return {
          ...base,
          nextActionAt: at,
          workView: "ahora",
          summary: `Esa línea podrá portar desde el ${fmt(eligible)}; otra línea del caso sigue trabajable, así que sigue en tu cola.`,
        };
      }
      return {
        ...base,
        nextActionAt: at,
        workView: "ahora",
        summary:
          "Queda la tarea de pedirle la fecha de portación; sigue en tu cola.",
      };
    }
    case "IMPEDIMENTO": {
      const followUp = input.followUpDate
        ? limaMorningFromIso(input.followUpDate)
        : null;
      const at = followUp ?? cadence(input);
      return {
        ...base,
        nextActionAt: at,
        workView: at.getTime() <= input.now.getTime() ? "ahora" : "espera",
        summary: `Seguimiento del impedimento el ${fmt(at)}.${
          input.needsSupervisor
            ? " Tu supervisor lo verá como pendiente de apoyo."
            : ""
        }`,
      };
    }
    default: {
      const at = cadence(input);
      return {
        ...base,
        nextActionAt: at,
        workView: "ahora",
        summary: cadenceSummary(input, at),
      };
    }
  }
}

/**
 * La consecuencia leída **antes** de guardar (BR-009), con lo que el
 * formulario sabe: sin intentos del día ni líneas; con lo demás igual.
 */
export function previewRecoveryAttemptConsequence(input: {
  result: string;
  reason?: string | null;
  pauseDays?: 1 | 2;
  scheduledAtRaw?: string;
  followUpDate?: string;
  reportedDate?: string;
  needsSupervisor?: boolean;
  phoneUsed?: string | null;
  validPhonesLeft?: number;
  now?: Date;
}): string {
  if (!input.result) return "";
  const now = input.now ?? new Date();
  const scheduledAt = input.scheduledAtRaw
    ? parseLimaDateTimeLocal(input.scheduledAtRaw)
    : null;
  const eligible = input.reportedDate
    ? eligibleFromReportedDate(input.reportedDate)
    : null;

  if (input.result === "SIN_RESPUESTA") {
    return "Cuenta como intento sin respuesta; sigue en tu cola hasta completar los 3 del día.";
  }

  return resolveRecoveryAttemptConsequence({
    result: input.result,
    reason: input.reason,
    now,
    attemptsToday: 1,
    managedSince: now,
    isBaseCase: true,
    pauseDays: input.pauseDays,
    scheduledAt,
    followUpDate: input.followUpDate,
    reportedDate: input.reportedDate,
    caseEligibleAt: eligible,
    anyWorkableLine: false,
    validPhonesLeft: input.validPhonesLeft ?? 1,
    phoneUsed: input.phoneUsed,
    needsSupervisor: input.needsSupervisor,
  }).summary;
}
