/**
 * Origen y antigüedad de una línea — SPEC-030 BR-037 y el reporte completo
 * de portabilidad (BR-018). El cruce guarda quién es el operador actual y
 * cuándo portó por última vez; esta regla lo convierte en lo que el asesor
 * necesita leer antes de marcar: "CLARO · portó hace 23 días" o
 * "BITEL · línea de planta".
 */

export interface RecoveryLineOriginInput {
  /** Cedente según la base consolidada (CLARO, ENTEL, BITEL, 27). */
  carrierRaw: string | null;
  portabilityState: "PORTADO" | "NO_PORTADO" | "PROGRAMADO" | "DESCONOCIDO" | null;
  /** Receptor según el reporte completo, cuando la línea portó. */
  portabilityReceiver: string | null;
  /** Fecha de la última portación según el reporte. */
  portabilityWindowAt: Date | null;
  isPlantLine: boolean;
  now: Date;
}

export interface RecoveryLineOrigin {
  /** Operador actual más confiable: el del reporte si portó; si no, el cedente. */
  operator: string;
  /** Antigüedad legible, o null cuando no hay nada que decir. */
  detail: string | null;
  portedDaysAgo: number | null;
}

/** La base y el reporte nombran a los operadores de formas distintas. */
function shortOperatorName(value: string): string {
  const normalized = value.toUpperCase();

  if (/TELEFONICA|TELEFÓNICA|MOVISTAR|\(22\)/.test(normalized)) return "MOVISTAR";
  if (/CLARO|AMERICA MOVIL|AMÉRICA MÓVIL/.test(normalized)) return "CLARO";
  if (/ENTEL/.test(normalized)) return "ENTEL";
  if (/BITEL|VIETTEL|\(24\)/.test(normalized)) return "BITEL";
  if (/GUINEA|^27$|\(27\)/.test(normalized)) return "GUINEA";

  return value;
}

export function describeRecoveryLineOrigin(
  input: RecoveryLineOriginInput,
): RecoveryLineOrigin {
  const portedDaysAgo = input.portabilityWindowAt
    ? Math.max(
        0,
        Math.floor(
          (input.now.getTime() - input.portabilityWindowAt.getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  // Si el reporte dice que portó, el receptor es el operador actual real;
  // mientras no, el cedente de la base es la mejor información disponible.
  const reportKnowsOperator =
    (input.portabilityState === "PORTADO" ||
      input.portabilityState === "PROGRAMADO") &&
    input.portabilityReceiver !== null;
  const operatorSource = reportKnowsOperator
    ? (input.portabilityReceiver as string)
    : (input.carrierRaw ?? "Desconocido");

  const detail = input.isPlantLine
    ? "línea de planta: nunca portó"
    : portedDaysAgo !== null
      ? `portó hace ${portedDaysAgo} día${portedDaysAgo === 1 ? "" : "s"}`
      : input.portabilityState === null ||
          input.portabilityState === "DESCONOCIDO"
        ? "sin consulta de portabilidad"
        : null;

  return {
    operator: shortOperatorName(operatorSource),
    detail,
    portedDaysAgo,
  };
}
