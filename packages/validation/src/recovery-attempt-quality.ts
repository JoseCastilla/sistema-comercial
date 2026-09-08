/**
 * Calidad de las tipificaciones — SPEC-049 BR-019.
 *
 * Una observación puede contradecir al resultado: «interesado, llamar
 * mañana» registrado como «no contesta»; «problema de huella» como «no
 * interesado». Aquí solo se **detecta** la posible discrepancia para que
 * un supervisor la revise caso por caso; nada cambia solo y ningún caso se
 * cierra ni se pausa desde texto libre.
 */

export type RecoveryAttemptDiscrepancyKind =
  | "contacto_como_no_contesta"
  | "interes_como_rechazo"
  | "impedimento_como_rechazo"
  | "movistar_sin_verificar"
  | "numero_errado_sin_marcar"
  | "agenda_sin_fecha";

export const recoveryAttemptDiscrepancyLabels: Record<
  RecoveryAttemptDiscrepancyKind,
  string
> = {
  contacto_como_no_contesta:
    "La observación describe una conversación, pero se registró «No contesta»",
  interes_como_rechazo:
    "La observación sugiere interés, pero se registró «No interesado»",
  impedimento_como_rechazo:
    "La observación describe un impedimento, pero se registró «No interesado»",
  movistar_sin_verificar:
    "La observación dice que ya es Movistar, pero no se envió a verificación",
  numero_errado_sin_marcar:
    "La observación describe un número equivocado, pero no se marcó el teléfono",
  agenda_sin_fecha:
    "La observación acuerda una llamada, pero no se agendó con fecha y hora",
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function hasAny(text: string, needles: ReadonlyArray<string>): boolean {
  return needles.some((needle) => text.includes(needle));
}

const conversationWords = [
  "interesad",
  "quiere",
  "acepto",
  "acepta",
  "dijo",
  "me dice",
  "pide",
  "cotiz",
  "le explique",
  "conversamos",
  "hable con",
  "hablamos",
];
const interestWords = ["interesad", "quiere", "acepto", "acepta", "le gusto", "cotiz"];
const impedimentWords = ["huella", "deuda", "no puede", "sistema", "problema", "error", "no procede", "rechaz"];
const movistarWords = ["ya es movistar", "ya tiene movistar", "ya esta en movistar", "ya activo", "ya porto", "ya migro"];
const wrongNumberWords = ["equivocad", "numero errado", "no es el", "otra persona", "no conoce", "no lo conoce"];
const appointmentWords = [
  "llamar manana",
  "llame manana",
  "llamar mas tarde",
  "llamar a las",
  "volver a llamar",
  "manana",
  "agend",
  "cita",
];

/** «No quiere», «no le interesa», «no acepta» no son interés. */
function withoutNegatedInterest(text: string): string {
  return text
    .replace(/\bno (le |me )?(quiere|quiso|interesa|acepta|acepto)\w*/g, " ")
    .replace(/\bno (esta |estaba )?interesad\w*/g, " ");
}

/**
 * Devuelve la posible discrepancia entre resultado y observación, o nulo.
 * Trabaja sobre el resultado **efectivo**: un intento ya rectificado no
 * vuelve a señalarse.
 */
export function detectRecoveryAttemptDiscrepancy(input: {
  result: string;
  observation: string | null | undefined;
}): { kind: RecoveryAttemptDiscrepancyKind; label: string } | null {
  const text = withoutNegatedInterest(
    normalize(input.observation ?? ""),
  ).trim();
  if (text.length < 4) return null;

  const found = (kind: RecoveryAttemptDiscrepancyKind) => ({
    kind,
    label: recoveryAttemptDiscrepancyLabels[kind],
  });

  if (input.result !== "YA_ACTIVO" && hasAny(text, movistarWords)) {
    return found("movistar_sin_verificar");
  }
  if (input.result !== "NUMERO_ERRADO" && hasAny(text, wrongNumberWords)) {
    return found("numero_errado_sin_marcar");
  }
  if (input.result === "SIN_RESPUESTA") {
    if (hasAny(text, appointmentWords)) return found("agenda_sin_fecha");
    if (hasAny(text, conversationWords)) return found("contacto_como_no_contesta");
    return null;
  }
  if (input.result === "RECHAZA") {
    if (hasAny(text, impedimentWords)) return found("impedimento_como_rechazo");
    if (hasAny(text, interestWords)) return found("interes_como_rechazo");
    return null;
  }
  return null;
}
