/**
 * Vistas de trabajo de la bandeja del asesor — SPEC-049 BR-012 a BR-015.
 *
 * Cada caso abierto cae en exactamente una de tres vistas —Trabajar ahora,
 * Por completar, En espera— a partir del elemento que le da el selector de
 * SPEC-048 («un caso, un elemento»); los resueltos van a Historial. Las
 * vistas se calculan con estado y reglas, nunca con el último resultado a
 * secas (BR-007).
 */
import type { RecoveryAgendaItem } from "./recovery-agenda.js";

export type RecoveryWorkViewKey = "ahora" | "completar" | "espera" | "historial";

export const recoveryWorkViewOptions: ReadonlyArray<{
  value: RecoveryWorkViewKey;
  label: string;
  hint: string;
}> = [
  {
    value: "ahora",
    label: "Trabajar ahora",
    hint: "Lo que toca llamar o resolver en este momento",
  },
  {
    value: "completar",
    label: "Por completar",
    hint: "Aceptaciones sin orden y cierres pendientes",
  },
  {
    value: "espera",
    label: "En espera",
    hint: "Pausas, citas futuras, habilitaciones y verificaciones",
  },
  {
    value: "historial",
    label: "Historial",
    hint: "Resueltos en los últimos 30 días, solo lectura",
  },
];

export function parseRecoveryWorkView(
  value: string | null | undefined,
): RecoveryWorkViewKey {
  const text = String(value ?? "").trim();

  return recoveryWorkViewOptions.some((option) => option.value === text)
    ? (text as RecoveryWorkViewKey)
    : "ahora";
}

/** BR-012: un caso abierto, una vista. */
export function classifyRecoveryWorkItem(
  item: RecoveryAgendaItem,
  now: Date,
): Exclude<RecoveryWorkViewKey, "historial"> {
  switch (item.kind) {
    case "VERIFICACION":
      return "espera";
    case "COMPLETAR_VENTA":
    case "CERRAR":
    case "RESOLVER_DATOS":
      return "completar";
    case "SIN_FECHA":
      return "ahora";
    default:
      return item.at === null || item.at.getTime() <= now.getTime()
        ? "ahora"
        : "espera";
  }
}

/**
 * BR-013: exigibles primero. 0 llamadas acordadas vencidas, 1 habilitaciones
 * vencidas, 2 devueltos de verificación, 3 el resto (recientes primero).
 */
export function recoveryWorkNowRank(item: RecoveryAgendaItem): number {
  if (item.kind === "CITA_ACORDADA") return 0;
  if (item.kind === "HABILITACION") return 1;
  if (item.origin === "devuelto") return 2;

  return 3;
}

export interface RecoveryWorkNowCandidate {
  item: RecoveryAgendaItem;
  /** Fecha del último registro del pedido en la base (BR-004: recencia). */
  lastSightingAt: Date;
}

/** Orden de Trabajar ahora: rango, lo más reciente primero, próxima acción. */
export function compareRecoveryWorkNow(
  left: RecoveryWorkNowCandidate,
  right: RecoveryWorkNowCandidate,
): number {
  const rank = recoveryWorkNowRank(left.item) - recoveryWorkNowRank(right.item);
  if (rank !== 0) return rank;

  const recency =
    right.lastSightingAt.getTime() - left.lastSightingAt.getTime();
  if (recency !== 0) return recency;

  return (
    (left.item.at?.getTime() ?? Number.MAX_SAFE_INTEGER) -
    (right.item.at?.getTime() ?? Number.MAX_SAFE_INTEGER)
  );
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

/** BR-015: cada espera dice por qué existe y cómo termina. */
export function describeRecoveryWait(item: RecoveryAgendaItem): {
  reason: string;
  ends: string;
} {
  const when = item.at ? limaShort.format(item.at) : null;

  switch (item.kind) {
    case "VERIFICACION":
      return {
        reason: "En verificación: reportado como ya activo en Movistar",
        ends: "Termina con el reporte de portabilidad o cuando tu supervisor confirme o desmienta",
      };
    case "CITA_ACORDADA":
      return {
        reason: "Llamada acordada con el cliente",
        ends: when ? `Vuelve a tu cola el ${when}; también está en Mi agenda` : "",
      };
    case "HABILITACION":
      return {
        reason: "Aún no cumple los 30 días desde su última portación",
        ends: when ? `Podrá portar desde el ${when}` : "",
      };
    case "SEGUIMIENTO":
      return {
        reason: "Tiene un pedido ajeno en curso; el cruce lo vigila",
        ends: when ? `Vuelve a tu cola el ${when}` : "",
      };
    case "REINTENTO":
      switch (item.origin) {
        case "pausa":
          return {
            reason: "Pausado porque dijo que no le interesa",
            ends: when ? `Vuelve a tu cola el ${when}` : "",
          };
        case "impedimento":
          return {
            reason: "Impedimento comercial en seguimiento",
            ends: when ? `Vuelve a tu cola el ${when}` : "",
          };
        case "seguimiento":
          return {
            reason: "Seguimiento acordado con el cliente",
            ends: when ? `Vuelve a tu cola el ${when}` : "",
          };
        default:
          return {
            reason: "Cadencia del día cumplida",
            ends: when ? `Vuelve a tu cola el ${when}` : "",
          };
      }
    default:
      return { reason: "", ends: when ? `Vuelve a tu cola el ${when}` : "" };
  }
}
