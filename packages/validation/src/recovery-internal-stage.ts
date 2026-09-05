/**
 * Etapa de la cadencia del recupero de ventas — SPEC-041 fase 3 (REC-05).
 *
 * La bandeja y la ficha mostraban una fecha de próxima acción sin decir qué
 * es: ¿el primer contacto que vence a las dos horas, el toque D3 de la
 * cadencia, una cita acordada con el cliente, una pausa por rechazo? Aquí se
 * nombra la etapa con las mismas reglas que la fijan (SPEC-026, SPEC-030
 * BR-066), para que la interfaz explique qué acción vence y por qué. La
 * cadencia de Campañas (tres intentos al día) no aplica a este carril.
 */
import { classifyInternalRecoveryDue } from "./recovery-internal-due.js";
import {
  getInternalRecoveryFirstActionAt,
  getInternalRecoveryNextTouchAt,
  internalRecoveryCadenceDays,
} from "./recovery-internal-gate.js";

import type { InternalRecoveryDue } from "./recovery-internal-due.js";

export type InternalRecoveryStageKey =
  | "primer_contacto"
  | "toque"
  | "agenda"
  | "pausa"
  | "verificacion"
  | "resolver"
  | "seguimiento";

export interface InternalRecoveryStageInput {
  status: string;
  firstContactAt: Date | null;
  nextActionAt: Date | null;
  /** Cuándo se cayó la venta: arranca el plazo de dos horas. */
  noveltyAt: Date;
  /** Desde cuándo lo gestiona su responsable: arranca la cadencia D1/D3/D7. */
  claimedAt: Date | null;
  /** Resultado del último intento, si lo hay. */
  lastResult: string | null;
}

export interface InternalRecoveryStage {
  key: InternalRecoveryStageKey;
  /** Qué toca: «Primer contacto», «Toque D3», «Agenda acordada»… */
  label: string;
  /** Por qué, en una frase para el asesor. */
  detail: string;
  /** Qué venció, si algo venció (BR-095). */
  due: InternalRecoveryDue | null;
  /** Día de la cadencia al que corresponde la próxima acción, si es un toque. */
  touchDay: (typeof internalRecoveryCadenceDays)[number] | null;
}

const pausingResults = new Set(["RECHAZA", "CANCELADO"]);
/** Un toque se reconoce si cae a menos de un minuto del día exacto. */
const touchToleranceMs = 60 * 1000;

/** A qué día de la cadencia corresponde una fecha, contada desde la toma. */
export function resolveInternalRecoveryTouchDay(
  claimedAt: Date | null,
  nextActionAt: Date | null,
): (typeof internalRecoveryCadenceDays)[number] | null {
  if (!claimedAt || !nextActionAt) return null;

  for (const day of internalRecoveryCadenceDays) {
    const expected = claimedAt.getTime() + day * 24 * 60 * 60 * 1000;

    if (Math.abs(nextActionAt.getTime() - expected) <= touchToleranceMs) {
      return day;
    }
  }

  return null;
}

/**
 * Nombra la etapa. El orden importa: verificación y agenda suspenden la
 * cadencia; sin primer contacto manda el plazo de dos horas; con contacto,
 * la próxima acción es una pausa, un toque o el fin de la cadencia.
 */
export function describeInternalRecoveryStage(
  input: InternalRecoveryStageInput,
  now: Date,
): InternalRecoveryStage {
  const due = classifyInternalRecoveryDue(input, now);

  if (input.status === "WAITING") {
    return {
      key: "verificacion",
      label: "En verificación",
      detail:
        "El cliente dijo que ya está activo; el caso espera la confirmación del reporte o del supervisor.",
      due,
      touchDay: null,
    };
  }

  if (input.status === "SCHEDULED") {
    return {
      key: "agenda",
      label: due === "agenda" ? "Agenda vencida" : "Agenda acordada",
      detail:
        due === "agenda"
          ? "La cita con el cliente ya pasó: llámalo y registra qué pasó."
          : "Cita acordada con el cliente; la cadencia queda suspendida hasta entonces.",
      due,
      touchDay: null,
    };
  }

  if (input.firstContactAt === null) {
    const limit = getInternalRecoveryFirstActionAt(input.noveltyAt);

    return {
      key: "primer_contacto",
      label:
        due === "primer_contacto"
          ? "Primer contacto vencido"
          : "Primer contacto",
      detail:
        due === "primer_contacto"
          ? "Pasaron las dos horas desde que la venta se cayó y nadie ha llamado."
          : `Hay que llamar antes de las ${formatLimaTime(limit)}: son dos horas desde que la venta se cayó.`,
      due,
      touchDay: null,
    };
  }

  if (input.lastResult && pausingResults.has(input.lastResult)) {
    return {
      key: "pausa",
      label: due === "seguimiento" ? "Pausa terminada" : "En pausa",
      detail:
        due === "seguimiento"
          ? "La pausa por rechazo terminó: toca volver a intentar."
          : "El cliente rechazó; el caso reaparece solo cuando termine la pausa.",
      due,
      touchDay: null,
    };
  }

  const touchDay = resolveInternalRecoveryTouchDay(
    input.claimedAt,
    input.nextActionAt,
  );

  if (touchDay !== null) {
    return {
      key: "toque",
      label: `Toque D${touchDay}`,
      detail:
        due === "seguimiento"
          ? `El toque del día ${touchDay} de la cadencia quedó atrás.`
          : `Cadencia D1 / D3 / D7 desde que se tomó el caso; este es el del día ${touchDay}.`,
      due,
      touchDay,
    };
  }

  if (
    input.claimedAt &&
    getInternalRecoveryNextTouchAt(input.claimedAt, now) === null &&
    (input.nextActionAt === null ||
      input.nextActionAt.getTime() <= now.getTime())
  ) {
    return {
      key: "resolver",
      label: "Cadencia agotada",
      detail:
        "Pasaron los siete días de la cadencia: este caso entra en resolución obligatoria.",
      due,
      touchDay: null,
    };
  }

  return {
    key: "seguimiento",
    label: due === "seguimiento" ? "Seguimiento vencido" : "Seguimiento",
    detail:
      due === "seguimiento"
        ? "La próxima acción quedó atrás."
        : "Ya hubo contacto; la próxima acción está programada.",
    due,
    touchDay: null,
  };
}

const limaTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatLimaTime(moment: Date): string {
  return limaTimeFormatter.format(moment);
}
