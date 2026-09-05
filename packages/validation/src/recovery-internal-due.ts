/**
 * Vencimientos y orden de la bandeja de recupero de ventas — SPEC-030 BR-095
 * (fase 1 del plan de Pedidos y Recupero, 05/09/2026).
 *
 * La bandeja rotulaba «Primer contacto vencido» a cualquier caso con la
 * próxima acción en el pasado, sin mirar si alguien había llamado ya. Y
 * ordenaba por una etiqueta `dd/mm HH:mm`, con lo que «01/09» quedaba antes
 * que «31/08». Aquí viven las dos decisiones, puras y probadas, para que el
 * indicador y la lista que abre cuenten exactamente lo mismo (SPEC-040
 * BR-001) y para que el orden use fechas reales.
 */
import { getInternalRecoveryFirstActionAt } from "./recovery-internal-gate.js";

export type InternalRecoveryDue = "primer_contacto" | "seguimiento" | "agenda";

export const internalRecoveryDueOptions: ReadonlyArray<{
  value: InternalRecoveryDue;
  label: string;
  hint: string;
}> = [
  {
    value: "primer_contacto",
    label: "Primer contacto vencido",
    hint: "Nadie lo ha llamado y pasaron las 2 horas desde que la venta se cayó",
  },
  {
    value: "seguimiento",
    label: "Seguimiento vencido",
    hint: "Ya hubo contacto y el siguiente toque de la cadencia quedó atrás",
  },
  {
    value: "agenda",
    label: "Agenda vencida",
    hint: "Una cita acordada con el cliente cuya fecha ya pasó",
  },
];

export function parseInternalRecoveryDue(
  value: string | null | undefined,
): InternalRecoveryDue | null {
  const text = String(value ?? "").trim();

  return internalRecoveryDueOptions.some((option) => option.value === text)
    ? (text as InternalRecoveryDue)
    : null;
}

export interface InternalRecoveryDueInput {
  status: string;
  /** Primer intento registrado; `null` si nadie ha llamado. */
  firstContactAt: Date | null;
  nextActionAt: Date | null;
  /** Cuándo se cayó la venta: arranca el plazo de dos horas (SPEC-026). */
  noveltyAt: Date;
}

/**
 * Qué venció, si algo venció. Tres estados excluyentes:
 * - **agenda**: el caso está agendado y la cita ya pasó. Una agenda futura no
 *   vence nada: la promesa de contacto suspende la cadencia (SPEC-026).
 * - **primer_contacto**: nadie ha llamado y pasaron las dos horas desde la
 *   novedad. Corre aunque el caso siga sin responsable: el Día 0 es del
 *   asesor original, y si no actúa, escala.
 * - **seguimiento**: ya hubo contacto y el siguiente toque quedó atrás.
 * Un caso en espera de confirmación no vence: está en verificación.
 */
export function classifyInternalRecoveryDue(
  input: InternalRecoveryDueInput,
  now: Date,
): InternalRecoveryDue | null {
  if (input.status === "WAITING") return null;

  if (input.status === "SCHEDULED") {
    return input.nextActionAt !== null &&
      input.nextActionAt.getTime() < now.getTime()
      ? "agenda"
      : null;
  }

  if (input.firstContactAt === null) {
    return getInternalRecoveryFirstActionAt(input.noveltyAt).getTime() <
      now.getTime()
      ? "primer_contacto"
      : null;
  }

  return input.nextActionAt !== null &&
    input.nextActionAt.getTime() < now.getTime()
    ? "seguimiento"
    : null;
}

/** SPEC-026: crítica, alta, media, condicionada. */
export const internalRecoveryPriorityRank: Record<string, number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  CONDICIONADA: 1,
};

export interface InternalRecoveryOrderInput {
  priority: string | null;
  due: InternalRecoveryDue | null;
  nextActionAt: Date | null;
  noveltyAt: Date;
}

/**
 * Orden de negocio de la cola (SPEC-030 BR-064): primero la prioridad; dentro
 * de ella lo vencido antes que lo que aún no vence; luego lo más próximo a
 * vencer; y al final lo que se cayó hace más tiempo. Todo con fechas, nunca
 * con etiquetas.
 */
export function compareInternalRecoveryCases(
  left: InternalRecoveryOrderInput,
  right: InternalRecoveryOrderInput,
): number {
  const byPriority =
    (internalRecoveryPriorityRank[right.priority ?? ""] ?? 0) -
    (internalRecoveryPriorityRank[left.priority ?? ""] ?? 0);

  if (byPriority !== 0) return byPriority;

  const byDue = Number(right.due !== null) - Number(left.due !== null);

  if (byDue !== 0) return byDue;

  const leftNext = left.nextActionAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightNext = right.nextActionAt?.getTime() ?? Number.POSITIVE_INFINITY;

  if (leftNext !== rightNext) return leftNext - rightNext;

  return left.noveltyAt.getTime() - right.noveltyAt.getTime();
}
