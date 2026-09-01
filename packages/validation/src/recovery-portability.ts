export type RecoveryPortabilityState =
  | "PORTADO"
  | "NO_PORTADO"
  | "PROGRAMADO"
  | "DESCONOCIDO";

export type RecoveryPortabilityOutcome =
  | "DISCARD_ALREADY_ACTIVE"
  | "WAIT_IN_PROGRESS"
  | "WAIT_REVALIDATE"
  | "SCHEDULE_UNTIL_ELIGIBLE"
  | "PLANT_LINE"
  | "OPPORTUNITY";

/** Días que una línea debe esperar desde su última portación (BR-037). */
export const portabilityLockDays = 30;

const movistarMarkers = ["TELEFONICA", "(22)", "MOVISTAR"];

/**
 * El reporte nombra a Movistar como «Telefónica del Perú S. A.A.(22)». Se
 * comparan formas normalizadas para no depender de tildes ni espacios.
 */
export function isMovistarReceiver(value: string | null | undefined): boolean {
  if (!value) return false;

  const normalized = String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

  return movistarMarkers.some((marker) => normalized.includes(marker));
}

export function parseRecoveryPortabilityState(
  value: string | null | undefined,
): RecoveryPortabilityState {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

  if (normalized.includes("PROGRAMADO")) return "PROGRAMADO";
  if (normalized.includes("NO PORTADO")) return "NO_PORTADO";
  if (normalized.includes("PORTADO")) return "PORTADO";

  return "DESCONOCIDO";
}

/**
 * El reporte escribe la ventana como `d/M/yyyy HH:mm` y usa `-` cuando no
 * existe. Una línea sin ventana nunca portó: es de planta (BR-037).
 */
export function parseRecoveryPortabilityWindow(
  value: string | null | undefined,
): Date | null {
  const text = String(value ?? "").trim();

  if (text.length === 0 || text === "-") return null;

  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/,
  );

  if (!match) return null;

  const day = match[1] ?? "";
  const month = match[2] ?? "";
  const year = match[3] ?? "";
  const hour = match[4] ?? "0";
  const minute = match[5] ?? "00";

  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00-05:00`;
  const parsed = new Date(iso);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addPortabilityLock(windowDate: Date): Date {
  return new Date(
    windowDate.getTime() + portabilityLockDays * 24 * 60 * 60 * 1000,
  );
}

export interface RecoveryPortabilityDecisionInput {
  state: RecoveryPortabilityState;
  receiverRaw: string | null;
  windowDate: Date | null;
  now: Date;
}

export interface RecoveryPortabilityDecision {
  outcome: RecoveryPortabilityOutcome;
  eligibleAt: Date | null;
  isPlantLine: boolean;
  needsRevalidation: boolean;
}

/**
 * Traduce una fila del reporte a la decisión sobre el servicio, conforme a
 * BR-019 a BR-019e y BR-037.
 *
 * Ninguna combinación declara una venta perdida: la única pérdida automática
 * del sistema es BR-059, que exige gestión previa registrada y se resuelve
 * fuera de esta función.
 */
export function decideRecoveryPortability(
  input: RecoveryPortabilityDecisionInput,
): RecoveryPortabilityDecision {
  const toMovistar = isMovistarReceiver(input.receiverRaw);
  const base: RecoveryPortabilityDecision = {
    outcome: "OPPORTUNITY",
    eligibleAt: null,
    isPlantLine: false,
    needsRevalidation: false,
  };

  if (input.state === "PORTADO") {
    if (toMovistar) {
      return { ...base, outcome: "DISCARD_ALREADY_ACTIVE" };
    }

    return scheduleFromWindow(base, input);
  }

  if (input.state === "PROGRAMADO") {
    if (toMovistar) {
      return input.windowDate
        ? { ...base, outcome: "WAIT_IN_PROGRESS" }
        : { ...base, outcome: "WAIT_REVALIDATE", needsRevalidation: true };
    }

    return scheduleFromWindow(base, input);
  }

  if (input.state === "NO_PORTADO") {
    if (!input.windowDate) {
      return { ...base, outcome: "PLANT_LINE", isPlantLine: true };
    }

    return scheduleFromWindow(base, input);
  }

  return base;
}

function scheduleFromWindow(
  base: RecoveryPortabilityDecision,
  input: RecoveryPortabilityDecisionInput,
): RecoveryPortabilityDecision {
  if (!input.windowDate) {
    return base;
  }

  const eligibleAt = addPortabilityLock(input.windowDate);

  if (eligibleAt.getTime() <= input.now.getTime()) {
    return { ...base, outcome: "OPPORTUNITY", eligibleAt: null };
  }

  return { ...base, outcome: "SCHEDULE_UNTIL_ELIGIBLE", eligibleAt };
}
